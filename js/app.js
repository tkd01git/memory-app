const STORAGE_KEY = 'shared-memory-app-local';
const weekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const today = new Date();
const MAX_UPLOAD_BYTES = 4_200_000;
const JPEG_QUALITY_STEPS = [0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64, 0.6, 0.56, 0.52];
const MAX_DIMENSION_STEPS = [2200, 2000, 1800, 1600, 1440, 1280, 1152, 1024, 960, 896, 820];

const state = {
  cursorYear: today.getFullYear(),
  cursorMonth: today.getMonth(),
  selectedDate: toDateKey(today),
  activeTab: 'done',
  pendingPhotos: [],
  editingEventId: null,
  data: loadLocalData()
};

const el = {
  doneTabBtn: document.getElementById('doneTabBtn'),
  wishTabBtn: document.getElementById('wishTabBtn'),
  doneTab: document.getElementById('doneTab'),
  wishTab: document.getElementById('wishTab'),
  wishForm: document.getElementById('wishForm'),
  wishInput: document.getElementById('wishInput'),
  wishCommentInput: document.getElementById('wishCommentInput'),
  wishList: document.getElementById('wishList'),
  wishCount: document.getElementById('wishCount'),
  doneList: document.getElementById('doneList'),
  doneCount: document.getElementById('doneCount'),
  driveConnectBtn: document.getElementById('driveConnectBtn'),
  monthLabel: document.getElementById('monthLabel'),
  weekdayRow: document.getElementById('weekdayRow'),
  calendarGrid: document.getElementById('calendarGrid'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  detailDateLabel: document.getElementById('detailDateLabel'),
  dayEntryForm: document.getElementById('dayEntryForm'),
  dayTitleInput: document.getElementById('dayTitleInput'),
  dayNoteInput: document.getElementById('dayNoteInput'),
  photoInput: document.getElementById('photoInput'),
  photoPreviewGrid: document.getElementById('photoPreviewGrid'),
  photoEmpty: document.getElementById('photoEmpty'),
  clearDayEntryBtn: document.getElementById('clearDayEntryBtn'),
  newEventBtn: document.getElementById('newEventBtn'),
  dayEventList: document.getElementById('dayEventList'),
  editingBadge: document.getElementById('editingBadge'),
  dayModal: document.getElementById('dayModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  modalDateLabel: document.getElementById('modalDateLabel'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  modalEventList: document.getElementById('modalEventList')
};

function loadLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const fallback = { wishes: [], dayEntries: {} };
  if (!raw) return fallback;
  try {
    return normalizeData(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function normalizeData(data) {
  const wishes = Array.isArray(data.wishes) ? data.wishes.map(normalizeWish).filter(Boolean) : [];
  const dayEntries = data.dayEntries && typeof data.dayEntries === 'object'
    ? Object.fromEntries(
        Object.entries(data.dayEntries)
          .map(([dateKey, entry]) => [dateKey, normalizeDayEntry(entry)])
          .filter(([, entry]) => entry)
      )
    : {};

  return { wishes, dayEntries };
}

function normalizeWish(item) {
  if (!item) return null;
  const text = typeof item === 'string' ? item : item.text;
  if (!text) return null;
  return {
    id: item.id || uid('wish'),
    text: String(text),
    comment: item.comment || '',
    createdAt: item.createdAt || new Date().toISOString()
  };
}

function normalizeDayEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  let events = [];
  if (Array.isArray(entry.events)) {
    events = entry.events.map(normalizeEvent).filter(Boolean);
  } else {
    const legacy = normalizeEvent({
      id: entry.id || uid('event'),
      title: entry.title || '',
      note: entry.note || '',
      photos: Array.isArray(entry.photos) ? entry.photos : entry.photo ? [entry.photo] : [],
      updatedAt: entry.updatedAt || new Date().toISOString()
    });
    if (legacy) events = [legacy];
  }

  return {
    events,
    updatedAt: entry.updatedAt || new Date().toISOString()
  };
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const photos = Array.isArray(event.photos)
    ? event.photos.filter(photo => photo && photo.fileId)
    : [];
  return {
    id: event.id || uid('event'),
    title: event.title || '',
    note: event.note || '',
    photos,
    updatedAt: event.updatedAt || new Date().toISOString()
  };
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getDayEntry(dateKey) {
  return state.data.dayEntries[dateKey] || null;
}

function getEventsForDate(dateKey) {
  return getDayEntry(dateKey)?.events || [];
}

function getEditingEvent() {
  return getEventsForDate(state.selectedDate).find(event => event.id === state.editingEventId) || null;
}

function hasEventContent(event) {
  if (!event) return false;
  return Boolean(event.title?.trim() || event.note?.trim() || (event.photos && event.photos.length));
}

function hasDayContent(entry) {
  if (!entry) return false;
  return Array.isArray(entry.events) && entry.events.some(hasEventContent);
}

function buildPhotoUrl(fileId) {
  return `/api/drive/photos/load?fileId=${encodeURIComponent(fileId)}`;
}

async function startDriveAuth() {
  const response = await fetch('/api/drive/auth');
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Google Drive連携に失敗しました。');
  }
  const data = await response.json();
  if (!data.url) throw new Error('認証URLを取得できませんでした。');
  window.location.href = data.url;
}

async function loadFromDrive() {
  try {
    const response = await fetch('/api/drive/memories/load');
    if (!response.ok) return;
    const remote = await response.json();
    if (!remote || !remote.data) return;
    state.data = normalizeData(remote.data);
    saveLocalData();
    renderAll();
  } catch (error) {
    console.warn('Drive load skipped:', error);
  }
}

async function persistToDriveSilently() {
  try {
    await fetch('/api/drive/memories/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: state.data })
    });
  } catch (error) {
    console.warn('Drive save skipped:', error);
  }
}

async function uploadDayPhoto(dateKey, pendingPhoto) {
  if (!dateKey) throw new Error('保存先の日付がありません。');
  if (!pendingPhoto?.dataUrl) throw new Error('画像データがありません。');

  const payload = {
    date: dateKey,
    base64DataUrl: pendingPhoto.dataUrl,
    originalFileName: pendingPhoto.originalFileName,
    mimeType: pendingPhoto.mimeType
  };

  const response = await fetch('/api/drive/photos/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || text || '写真アップロードに失敗しました。');
  }

  return data.file || data;
}

function setActiveTab(tab) {
  state.activeTab = tab;
  el.doneTabBtn.classList.toggle('active', tab === 'done');
  el.wishTabBtn.classList.toggle('active', tab === 'wish');
  el.doneTab.classList.toggle('active', tab === 'done');
  el.wishTab.classList.toggle('active', tab === 'wish');
}

function renderWeekdays() {
  el.weekdayRow.innerHTML = weekNames
    .map(name => `<div class="weekday-cell">${name}</div>`)
    .join('');
}

function renderCalendar() {
  const firstDay = new Date(state.cursorYear, state.cursorMonth, 1);
  const lastDay = new Date(state.cursorYear, state.cursorMonth + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  el.monthLabel.textContent = `${state.cursorYear}年 ${state.cursorMonth + 1}月`;

  const cells = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push('<div class="calendar-spacer"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(state.cursorYear, state.cursorMonth, day);
    const dateKey = toDateKey(date);
    const entry = getDayEntry(dateKey);
    const selected = dateKey === state.selectedDate;
    const hasContent = hasDayContent(entry);
    const todayMatch = dateKey === toDateKey(today);

    cells.push(`
      <button
        type="button"
        class="calendar-cell${selected ? ' selected' : ''}${hasContent ? ' has-entry' : ''}${todayMatch ? ' today' : ''}"
        data-date="${dateKey}"
      >
        <span class="calendar-day-number">${day}</span>
        ${hasContent ? '<span class="calendar-dot"></span>' : ''}
      </button>
    `);
  }

  el.calendarGrid.innerHTML = cells.join('');
}

function renderDayEventList() {
  const events = getEventsForDate(state.selectedDate);

  if (!events.length) {
    el.dayEventList.innerHTML = '<div class="empty-state">まだイベントがありません。</div>';
    return;
  }

  el.dayEventList.innerHTML = events.map((event, index) => `
    <div class="mini-card${event.id === state.editingEventId ? ' active' : ''}">
      <div class="mini-card-main">
        <div class="mini-card-title">${escapeHtml(event.title || `イベント ${index + 1}`)}</div>
        <div class="mini-card-meta">
          ${event.photos?.length ? `${event.photos.length}枚` : '写真なし'}
        </div>
      </div>
      <button class="small-btn" type="button" data-action="edit-event" data-event-id="${event.id}">
        編集
      </button>
    </div>
  `).join('');
}

function renderPhotoPreviewGrid() {
  const event = getEditingEvent();
  const storedPhotos = event?.photos || [];
  const pendingPhotos = state.pendingPhotos || [];

  const tiles = [
    ...storedPhotos.map(photo => ({
      kind: 'stored',
      id: photo.fileId,
      src: buildPhotoUrl(photo.fileId),
      name: photo.name || 'photo'
    })),
    ...pendingPhotos.map(photo => ({
      kind: 'pending',
      id: photo.tempId,
      src: photo.dataUrl,
      name: photo.originalFileName || 'photo'
    }))
  ];

  if (!tiles.length) {
    el.photoPreviewGrid.innerHTML = '';
    el.photoEmpty.style.display = 'block';
    return;
  }

  el.photoPreviewGrid.innerHTML = tiles.map(tile => `
    <div class="photo-tile">
      <img src="${escapeHtml(tile.src)}" alt="${escapeHtml(tile.name)}" />
      <button class="remove-photo-btn" type="button" data-action="remove-photo" data-kind="${tile.kind}" data-id="${escapeHtml(tile.id)}">×</button>
    </div>
  `).join('');

  el.photoEmpty.style.display = 'none';
}

function renderSelectedDay() {
  el.detailDateLabel.textContent = formatDateLabel(state.selectedDate);

  const editingEvent = getEditingEvent();
  if (editingEvent) {
    el.editingBadge.textContent = '既存イベントを編集中';
    el.dayTitleInput.value = editingEvent.title || '';
    el.dayNoteInput.value = editingEvent.note || '';
  } else {
    el.editingBadge.textContent = '新しいイベントを作成中';
    el.dayTitleInput.value = '';
    el.dayNoteInput.value = '';
  }

  renderDayEventList();
  renderPhotoPreviewGrid();
}

function getDoneEntries() {
  return Object.entries(state.data.dayEntries)
    .filter(([, entry]) => hasDayContent(entry))
    .sort((a, b) => b[0].localeCompare(a[0]));
}

function renderDoneList() {
  const doneEntries = getDoneEntries();
  el.doneCount.textContent = doneEntries.reduce((sum, [, entry]) => sum + entry.events.length, 0);

  el.doneList.innerHTML = doneEntries.length
    ? doneEntries.map(([dateKey, entry]) => `
      <div class="card-item">
        <div class="card-main">
          <div class="card-title">${formatDateLabel(dateKey)}</div>
          <div class="card-meta">
            <span>${entry.events.length}件のイベント</span>
          </div>
          <div class="card-note">
            ${entry.events.map((event, i) => `${i + 1}. ${escapeHtml(event.title || 'タイトル未設定')}`).join('<br>')}
          </div>
        </div>
        <div class="card-actions">
          <button class="small-btn" type="button" data-action="open-day" data-date="${dateKey}">見る</button>
          <button class="small-btn" type="button" data-action="delete-day" data-date="${dateKey}">削除</button>
        </div>
      </div>
    `).join('')
    : '<div class="empty-state">まだ記録がありません。</div>';
}

function renderWishList() {
  el.wishCount.textContent = state.data.wishes.length;
  el.wishList.innerHTML = state.data.wishes.length
    ? state.data.wishes.map(item => `
      <div class="card-item">
        <div class="card-main">
          <div class="card-title">${escapeHtml(item.text)}</div>
          ${item.comment ? `<div class="card-note">${escapeHtml(item.comment)}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="small-btn" type="button" data-action="delete-wish" data-id="${item.id}">削除</button>
        </div>
      </div>
    `).join('')
    : '<div class="empty-state">まだ登録がありません。</div>';
}

function renderAll() {
  renderWishList();
  renderCalendar();
  renderSelectedDay();
  renderDoneList();
}

function ensureDayEntry(dateKey) {
  if (!state.data.dayEntries[dateKey]) {
    state.data.dayEntries[dateKey] = {
      events: [],
      updatedAt: new Date().toISOString()
    };
  }
  return state.data.dayEntries[dateKey];
}

function dataUrlSizeBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = (base64.match(/=*$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
}

function drawCompressedJpeg(img, maxDimension, quality) {
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function compressImageForUpload(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageFromDataUrl(originalDataUrl);

  for (const maxDimension of MAX_DIMENSION_STEPS) {
    for (const quality of JPEG_QUALITY_STEPS) {
      const compressedDataUrl = drawCompressedJpeg(img, maxDimension, quality);
      if (dataUrlSizeBytes(compressedDataUrl) <= MAX_UPLOAD_BYTES) {
        return {
          tempId: uid('pending_photo'),
          dataUrl: compressedDataUrl,
          originalFileName: `${(file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo'}.jpg`,
          mimeType: 'image/jpeg'
        };
      }
    }
  }

  throw new Error('写真が大きすぎます。別の写真で試してください。');
}

function startNewEventDraft() {
  state.editingEventId = null;
  state.pendingPhotos = [];
  el.photoInput.value = '';
  renderSelectedDay();
}

function startEditEvent(eventId) {
  state.editingEventId = eventId;
  state.pendingPhotos = [];
  el.photoInput.value = '';
  renderSelectedDay();
}

async function handleDayEntrySave(event) {
  event.preventDefault();

  const dayEntry = ensureDayEntry(state.selectedDate);
  let targetEvent = getEditingEvent();

  if (!targetEvent) {
    targetEvent = {
      id: uid('event'),
      title: '',
      note: '',
      photos: [],
      updatedAt: new Date().toISOString()
    };
    dayEntry.events.unshift(targetEvent);
    state.editingEventId = targetEvent.id;
  }

  targetEvent.title = el.dayTitleInput.value.trim();
  targetEvent.note = el.dayNoteInput.value.trim();
  targetEvent.updatedAt = new Date().toISOString();
  dayEntry.updatedAt = new Date().toISOString();

  if (state.pendingPhotos.length) {
    try {
      const uploaded = [];
      for (const pendingPhoto of state.pendingPhotos) {
        const file = await uploadDayPhoto(state.selectedDate, pendingPhoto);
        uploaded.push({
          fileId: file.id,
          mimeType: file.mimeType,
          name: file.name,
          updatedAt: file.modifiedTime || new Date().toISOString()
        });
      }
      targetEvent.photos = [...(targetEvent.photos || []), ...uploaded];
      state.pendingPhotos = [];
      el.photoInput.value = '';
    } catch (error) {
      alert(`写真の保存に失敗しました: ${error.message}`);
      return;
    }
  }

  dayEntry.events = dayEntry.events.filter(hasEventContent);

  if (!dayEntry.events.length) {
    delete state.data.dayEntries[state.selectedDate];
    state.editingEventId = null;
  }

  saveLocalData();
  renderAll();
  await persistToDriveSilently();
}

function clearDayEntryInputs() {
  el.dayTitleInput.value = '';
  el.dayNoteInput.value = '';
  el.photoInput.value = '';
  state.pendingPhotos = [];
  renderSelectedDay();
}

async function handlePhotoChange(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  try {
    const compressedList = [];
    for (const file of files) {
      const compressed = await compressImageForUpload(file);
      compressedList.push(compressed);
    }
    state.pendingPhotos = [...state.pendingPhotos, ...compressedList];
    renderPhotoPreviewGrid();
    event.target.value = '';
  } catch (error) {
    alert(error.message);
    event.target.value = '';
  }
}

function removeWish(id) {
  state.data.wishes = state.data.wishes.filter(item => item.id !== id);
  saveLocalData();
  renderWishList();
  persistToDriveSilently();
}

function removeDay(dateKey) {
  delete state.data.dayEntries[dateKey];
  if (dateKey === state.selectedDate) {
    state.pendingPhotos = [];
    state.editingEventId = null;
    el.photoInput.value = '';
  }
  saveLocalData();
  renderAll();
  persistToDriveSilently();
}

function handleRemovePhoto(kind, id) {
  if (kind === 'pending') {
    state.pendingPhotos = state.pendingPhotos.filter(photo => photo.tempId !== id);
    renderPhotoPreviewGrid();
    return;
  }

  const targetEvent = getEditingEvent();
  if (!targetEvent?.photos?.length) return;
  targetEvent.photos = targetEvent.photos.filter(photo => photo.fileId !== id);
  saveLocalData();
  renderPhotoPreviewGrid();
  renderDoneList();
  renderCalendar();
  persistToDriveSilently();
}

function openDayModal(dateKey) {
  const entry = getDayEntry(dateKey);

  state.selectedDate = dateKey;
  state.pendingPhotos = [];
  el.photoInput.value = '';
  renderCalendar();
  renderSelectedDay();

  el.modalDateLabel.textContent = formatDateLabel(dateKey);

  if (!entry || !hasDayContent(entry)) {
    el.modalSubtitle.textContent = '';
    el.modalEventList.innerHTML = '<div class="empty-state">まだ記録がありません。</div>';
  } else {
    el.modalSubtitle.textContent = `${entry.events.length}件のイベント`;
    el.modalEventList.innerHTML = entry.events.map((event, index) => `
      <div class="modal-event-card">
        <div class="modal-event-title">${escapeHtml(event.title || `イベント ${index + 1}`)}</div>
        <div class="modal-event-note">${escapeHtml(event.note || '')}</div>
        <div class="photo-grid modal-photo-grid">
          ${(event.photos || []).map(photo => `
            <div class="photo-tile">
              <img src="${escapeHtml(buildPhotoUrl(photo.fileId))}" alt="${escapeHtml(photo.name || 'photo')}" />
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  if (typeof el.dayModal.showModal === 'function') {
    el.dayModal.showModal();
  }
}

function bindEvents() {
  el.doneTabBtn.addEventListener('click', () => setActiveTab('done'));
  el.wishTabBtn.addEventListener('click', () => setActiveTab('wish'));

  el.newEventBtn.addEventListener('click', () => startNewEventDraft());

  el.wishForm.addEventListener('submit', async event => {
    event.preventDefault();
    const text = el.wishInput.value.trim();
    if (!text) return;

    state.data.wishes.unshift({
      id: uid('wish'),
      text,
      comment: el.wishCommentInput.value.trim(),
      createdAt: new Date().toISOString()
    });

    el.wishInput.value = '';
    el.wishCommentInput.value = '';
    saveLocalData();
    renderWishList();
    await persistToDriveSilently();
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;

    const { action, id, date, kind, eventId } = button.dataset;

    if (action === 'delete-wish' && id) removeWish(id);
    if (action === 'open-day' && date) openDayModal(date);
    if (action === 'delete-day' && date) removeDay(date);
    if (action === 'remove-photo' && id) handleRemovePhoto(kind, id);
    if (action === 'edit-event' && eventId) startEditEvent(eventId);

    if (date && button.classList.contains('calendar-cell')) {
      openDayModal(date);
    }
  });

  el.prevMonthBtn.addEventListener('click', () => {
    const prev = new Date(state.cursorYear, state.cursorMonth - 1, 1);
    state.cursorYear = prev.getFullYear();
    state.cursorMonth = prev.getMonth();
    renderCalendar();
  });

  el.nextMonthBtn.addEventListener('click', () => {
    const next = new Date(state.cursorYear, state.cursorMonth + 1, 1);
    state.cursorYear = next.getFullYear();
    state.cursorMonth = next.getMonth();
    renderCalendar();
  });

  el.dayEntryForm.addEventListener('submit', handleDayEntrySave);
  el.photoInput.addEventListener('change', handlePhotoChange);
  el.clearDayEntryBtn.addEventListener('click', clearDayEntryInputs);

  el.driveConnectBtn.addEventListener('click', async () => {
    try {
      await startDriveAuth();
    } catch (error) {
      alert(error.message);
    }
  });

  el.closeModalBtn.addEventListener('click', () => el.dayModal.close());

  el.dayModal.addEventListener('click', event => {
    const card = el.dayModal.querySelector('.day-modal-card');
    const rect = card.getBoundingClientRect();
    const isInside =
      rect.top <= event.clientY &&
      event.clientY <= rect.bottom &&
      rect.left <= event.clientX &&
      event.clientX <= rect.right;

    if (!isInside) {
      el.dayModal.close();
    }
  });
}

renderWeekdays();
bindEvents();
renderAll();
loadFromDrive();

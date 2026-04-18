const STORAGE_KEY = 'shared-memory-app-local';
const weekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const today = new Date();

const state = {
  cursorYear: today.getFullYear(),
  cursorMonth: today.getMonth(),
  selectedDate: toDateKey(today),
  activeTab: 'done',
  pendingPhotos: [],
  data: loadLocalData()
};

const el = {
  doneTabBtn: document.getElementById('doneTabBtn'),
  wishTabBtn: document.getElementById('wishTabBtn'),
  doneTab: document.getElementById('doneTab'),
  wishTab: document.getElementById('wishTab'),
  wishForm: document.getElementById('wishForm'),
  wishInput: document.getElementById('wishInput'),
  wishDateInput: document.getElementById('wishDateInput'),
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
  dayModal: document.getElementById('dayModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  modalDateLabel: document.getElementById('modalDateLabel'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  modalTitle: document.getElementById('modalTitle'),
  modalNote: document.getElementById('modalNote'),
  modalPhotoGrid: document.getElementById('modalPhotoGrid')
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
          .map(([dateKey, entry]) => [dateKey, normalizeDayEntry(dateKey, entry)])
          .filter(([, entry]) => entry)
      )
    : {};

  if (Array.isArray(data.dones)) {
    data.dones.forEach(item => {
      const dateKey = normalizeDateKey(item.date || item.doneDate || item.movedAt || item.createdAt);
      if (!dateKey) return;
      if (!dayEntries[dateKey]) {
        dayEntries[dateKey] = normalizeDayEntry(dateKey, {
          title: item.text || '記録',
          note: item.note || '',
          updatedAt: item.movedAt || item.createdAt || new Date().toISOString(),
          photos: []
        });
      }
    });
  }

  return { wishes, dayEntries };
}

function normalizeWish(item) {
  if (!item) return null;
  const text = typeof item === 'string' ? item : item.text;
  if (!text) return null;
  return {
    id: item.id || uid('wish'),
    text: String(text),
    targetDate: item.targetDate || normalizeDateKey(item.date) || '',
    comment: item.comment || '',
    createdAt: item.createdAt || new Date().toISOString()
  };
}

function normalizeDayEntry(dateKey, entry) {
  if (!entry || typeof entry !== 'object') return null;
  const singlePhoto = entry.photo?.fileId ? [{ ...entry.photo }] : [];
  const photos = Array.isArray(entry.photos)
    ? entry.photos.filter(photo => photo && photo.fileId)
    : singlePhoto;

  return {
    title: entry.title || '',
    note: entry.note || entry.doneItems || '',
    photos,
    updatedAt: entry.updatedAt || new Date().toISOString()
  };
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeDateKey(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toDateKey(date);
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateShort(dateKey) {
  if (!dateKey) return '日付未設定';
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
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

function getEntry(dateKey) {
  return state.data.dayEntries[dateKey] || null;
}

function hasDayContent(entry) {
  if (!entry) return false;
  return Boolean(entry.title?.trim() || entry.note?.trim() || (entry.photos && entry.photos.length));
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
  const response = await fetch('/api/drive/photos/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateKey,
      dataUrl: pendingPhoto.dataUrl,
      originalFileName: pendingPhoto.originalFileName,
      mimeType: pendingPhoto.mimeType
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '写真アップロードに失敗しました。');
  }

  return response.json();
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
    const entry = getEntry(dateKey);
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

function renderPhotoPreviewGrid() {
  const entry = getEntry(state.selectedDate);
  const storedPhotos = entry?.photos || [];
  const pendingPhotos = state.pendingPhotos || [];

  const tiles = [
    ...storedPhotos.map(photo => ({
      kind: 'stored',
      fileId: photo.fileId,
      name: photo.name || '',
      src: buildPhotoUrl(photo.fileId)
    })),
    ...pendingPhotos.map(photo => ({
      kind: 'pending',
      tempId: photo.tempId,
      name: photo.originalFileName || '',
      src: photo.dataUrl
    }))
  ];

  el.photoPreviewGrid.innerHTML = tiles.map(tile => `
    <div class="photo-tile">
      <img src="${escapeHtml(tile.src)}" alt="${escapeHtml(tile.name || 'photo')}" />
      <button class="remove-photo-btn" type="button" data-action="remove-photo" data-kind="${tile.kind}" data-id="${escapeHtml(tile.fileId || tile.tempId)}">×</button>
    </div>
  `).join('');

  el.photoEmpty.style.display = tiles.length ? 'none' : 'block';
}

function renderSelectedDay() {
  const entry = getEntry(state.selectedDate) || { title: '', note: '' };
  el.detailDateLabel.textContent = formatDateLabel(state.selectedDate);
  el.dayTitleInput.value = entry.title || '';
  el.dayNoteInput.value = entry.note || '';
  renderPhotoPreviewGrid();
}

function getDoneEntries() {
  return Object.entries(state.data.dayEntries)
    .filter(([, entry]) => hasDayContent(entry))
    .sort((a, b) => b[0].localeCompare(a[0]));
}

function renderDoneList() {
  const doneEntries = getDoneEntries();
  el.doneCount.textContent = doneEntries.length;
  el.doneList.innerHTML = doneEntries.length
    ? doneEntries.map(([dateKey, entry]) => `
      <div class="card-item">
        <div class="card-main">
          <div class="card-title">${escapeHtml(entry.title || 'タイトル未設定')}</div>
          <div class="card-meta">
            <span>${formatDateLabel(dateKey)}</span>
            ${entry.photos?.length ? `<span>${entry.photos.length}枚の写真</span>` : ''}
          </div>
          ${entry.note ? `<div class="card-note">${escapeHtml(entry.note)}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="small-btn" type="button" data-action="open-day" data-date="${dateKey}">見る</button>
          <button class="small-btn" type="button" data-action="delete-day" data-date="${dateKey}">削除</button>
        </div>
      </div>`).join('')
    : '<div class="empty-state">まだ記録がありません。</div>';
}

function renderWishList() {
  el.wishCount.textContent = state.data.wishes.length;
  el.wishList.innerHTML = state.data.wishes.length
    ? state.data.wishes.map(item => `
      <div class="card-item">
        <div class="card-main">
          <div class="card-title">${escapeHtml(item.text)}</div>
          <div class="card-meta">
            <span>追加日 ${new Date(item.createdAt).toLocaleDateString('ja-JP')}</span>
            ${item.targetDate ? `<span>候補日 ${formatDateShort(item.targetDate)}</span>` : ''}
          </div>
          ${item.comment ? `<div class="card-note">${escapeHtml(item.comment)}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="small-btn" type="button" data-action="delete-wish" data-id="${item.id}">削除</button>
        </div>
      </div>`).join('')
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
      title: '',
      note: '',
      photos: [],
      updatedAt: new Date().toISOString()
    };
  }
  return state.data.dayEntries[dateKey];
}

async function handleDayEntrySave(event) {
  event.preventDefault();
  const entry = ensureDayEntry(state.selectedDate);
  entry.title = el.dayTitleInput.value.trim();
  entry.note = el.dayNoteInput.value.trim();
  entry.updatedAt = new Date().toISOString();

  if (state.pendingPhotos.length) {
    try {
      const uploadedPhotos = [];
      for (const pendingPhoto of state.pendingPhotos) {
        const file = await uploadDayPhoto(state.selectedDate, pendingPhoto);
        uploadedPhotos.push({
          fileId: file.id,
          mimeType: file.mimeType,
          name: file.name,
          updatedAt: file.modifiedTime || new Date().toISOString()
        });
      }
      entry.photos = [...(entry.photos || []), ...uploadedPhotos];
      state.pendingPhotos = [];
      el.photoInput.value = '';
    } catch (error) {
      alert(`写真の保存に失敗しました: ${error.message}`);
      return;
    }
  }

  if (!hasDayContent(entry)) {
    delete state.data.dayEntries[state.selectedDate];
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

  const reads = files.map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      tempId: uid('pending_photo'),
      dataUrl: reader.result,
      originalFileName: file.name || '',
      mimeType: file.type || ''
    });
    reader.readAsDataURL(file);
  }));

  const loadedPhotos = await Promise.all(reads);
  state.pendingPhotos = [...state.pendingPhotos, ...loadedPhotos];
  renderPhotoPreviewGrid();
  el.photoInput.value = '';
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

  const entry = getEntry(state.selectedDate);
  if (!entry) return;
  entry.photos = (entry.photos || []).filter(photo => photo.fileId !== id);
  saveLocalData();
  renderPhotoPreviewGrid();
  renderDoneList();
  renderCalendar();
  persistToDriveSilently();
}

function openDayModal(dateKey) {
  const entry = getEntry(dateKey);
  if (!entry) return;
  state.selectedDate = dateKey;
  renderCalendar();
  renderSelectedDay();

  el.modalDateLabel.textContent = formatDateLabel(dateKey);
  el.modalSubtitle.textContent = entry.updatedAt ? `最終更新 ${new Date(entry.updatedAt).toLocaleString('ja-JP')}` : '';
  el.modalTitle.textContent = entry.title || 'タイトル未設定';
  el.modalNote.textContent = entry.note || 'メモはありません。';
  el.modalPhotoGrid.innerHTML = (entry.photos || []).length
    ? entry.photos.map(photo => `
      <div class="photo-tile">
        <img src="${escapeHtml(buildPhotoUrl(photo.fileId))}" alt="${escapeHtml(photo.name || 'photo')}" />
      </div>
    `).join('')
    : '<div class="empty-state">写真はありません。</div>';

  if (typeof el.dayModal.showModal === 'function') {
    el.dayModal.showModal();
  }
}

function bindEvents() {
  el.doneTabBtn.addEventListener('click', () => setActiveTab('done'));
  el.wishTabBtn.addEventListener('click', () => setActiveTab('wish'));

  el.wishForm.addEventListener('submit', async event => {
    event.preventDefault();
    const text = el.wishInput.value.trim();
    if (!text) return;

    state.data.wishes.unshift({
      id: uid('wish'),
      text,
      targetDate: el.wishDateInput.value,
      comment: el.wishCommentInput.value.trim(),
      createdAt: new Date().toISOString()
    });

    el.wishInput.value = '';
    el.wishDateInput.value = '';
    el.wishCommentInput.value = '';
    saveLocalData();
    renderWishList();
    await persistToDriveSilently();
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;

    const { action, id, date, kind, tab } = button.dataset;
    if (tab) setActiveTab(tab);
    if (action === 'delete-wish' && id) removeWish(id);
    if (action === 'open-day' && date) openDayModal(date);
    if (action === 'delete-day' && date) removeDay(date);
    if (action === 'remove-photo' && id) handleRemovePhoto(kind, id);

    if (date && button.classList.contains('calendar-cell')) {
      state.selectedDate = date;
      state.pendingPhotos = [];
      el.photoInput.value = '';
      renderCalendar();
      renderSelectedDay();
      if (hasDayContent(getEntry(date))) openDayModal(date);
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
    const rect = el.dayModal.querySelector('.day-modal-card').getBoundingClientRect();
    const isInside = rect.top <= event.clientY && event.clientY <= rect.bottom && rect.left <= event.clientX && event.clientX <= rect.right;
    if (!isInside) el.dayModal.close();
  });
}

renderWeekdays();
bindEvents();
renderAll();
loadFromDrive();

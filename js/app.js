const STORAGE_KEY = 'shared-memory-app-local';
const weekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const today = new Date();

const state = {
  cursorYear: today.getFullYear(),
  cursorMonth: today.getMonth(),
  selectedDate: toDateKey(today),
  pendingPhotoDataUrl: null,
  data: loadLocalData()
};

const el = {
  wishForm: document.getElementById('wishForm'),
  wishInput: document.getElementById('wishInput'),
  wishList: document.getElementById('wishList'),
  wishCount: document.getElementById('wishCount'),
  doneForm: document.getElementById('doneForm'),
  doneInput: document.getElementById('doneInput'),
  doneList: document.getElementById('doneList'),
  doneCount: document.getElementById('doneCount'),
  driveConnectBtn: document.getElementById('driveConnectBtn'),
  driveSyncBtn: document.getElementById('driveSyncBtn'),
  monthLabel: document.getElementById('monthLabel'),
  weekdayRow: document.getElementById('weekdayRow'),
  calendarGrid: document.getElementById('calendarGrid'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  detailDateLabel: document.getElementById('detailDateLabel'),
  dayStatusBadge: document.getElementById('dayStatusBadge'),
  dayEntryForm: document.getElementById('dayEntryForm'),
  dayTitleInput: document.getElementById('dayTitleInput'),
  dayNoteInput: document.getElementById('dayNoteInput'),
  dayDoneItemsInput: document.getElementById('dayDoneItemsInput'),
  photoInput: document.getElementById('photoInput'),
  photoPreview: document.getElementById('photoPreview'),
  photoEmpty: document.getElementById('photoEmpty'),
  clearDayEntryBtn: document.getElementById('clearDayEntryBtn')
};

function loadLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const fallback = { wishes: [], dones: [], dayEntries: {} };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return {
      wishes: Array.isArray(parsed.wishes) ? parsed.wishes : [],
      dones: Array.isArray(parsed.dones) ? parsed.dones : [],
      dayEntries: parsed.dayEntries && typeof parsed.dayEntries === 'object' ? parsed.dayEntries : {}
    };
  } catch {
    return fallback;
  }
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; 
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function startDriveAuth() {
  const res = await fetch('/api/drive/auth', { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Drive auth failed');
  window.location.href = data.authUrl;
}

async function syncToDrive() {
  el.driveSyncBtn.disabled = true;
  el.driveSyncBtn.textContent = '保存中...';

  const dayEntry = state.data.dayEntries[state.selectedDate];
  if (state.pendingPhotoDataUrl && dayEntry) {
    const uploaded = await uploadDayPhoto(state.selectedDate, state.pendingPhotoDataUrl);
    dayEntry.photo = {
      fileId: uploaded.file.id,
      mimeType: uploaded.file.mimeType,
      name: uploaded.file.name,
      updatedAt: uploaded.file.modifiedTime || new Date().toISOString()
    };
    state.pendingPhotoDataUrl = null;
    saveLocalData();
  }

  const res = await fetch('/api/drive/memories/save', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: state.data })
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Drive save failed');

  el.driveSyncBtn.textContent = '保存完了';
  setTimeout(() => {
    el.driveSyncBtn.disabled = false;
    el.driveSyncBtn.textContent = 'Driveに保存';
  }, 1200);
}

async function loadFromDrive() {
  const res = await fetch('/api/drive/memories/load', { credentials: 'include' });
  const result = await res.json();
  if (!res.ok) return;
  if (result.data) {
    state.data = normalizeData(result.data);
    saveLocalData();
    renderAll();
  }
}

function normalizeData(data) {
  return {
    wishes: Array.isArray(data.wishes) ? data.wishes : [],
    dones: Array.isArray(data.dones) ? data.dones : [],
    dayEntries: data.dayEntries && typeof data.dayEntries === 'object' ? data.dayEntries : {}
  };
}

async function uploadDayPhoto(date, base64DataUrl) {
  const res = await fetch('/api/drive/photos/upload', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, base64DataUrl })
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Photo upload failed');
  return result;
}

function buildPhotoUrl(fileId) {
  return `/api/drive/photos/load?fileId=${encodeURIComponent(fileId)}`;
}

function addWish(text) {
  state.data.wishes.unshift({ id: uid('wish'), text, createdAt: new Date().toISOString() });
  saveLocalData();
  renderLists();
}

function addDone(text) {
  state.data.dones.unshift({ id: uid('done'), text, createdAt: new Date().toISOString() });
  saveLocalData();
  renderLists();
}

function removeItem(type, id) {
  state.data[type] = state.data[type].filter(item => item.id !== id);
  saveLocalData();
  renderLists();
}

function moveWishToDone(id) {
  const item = state.data.wishes.find(entry => entry.id === id);
  if (!item) return;
  state.data.wishes = state.data.wishes.filter(entry => entry.id !== id);
  state.data.dones.unshift({ ...item, id: uid('done'), movedAt: new Date().toISOString() });
  saveLocalData();
  renderLists();
}

function renderLists() {
  el.wishCount.textContent = state.data.wishes.length;
  el.doneCount.textContent = state.data.dones.length;

  el.wishList.innerHTML = state.data.wishes.length
    ? state.data.wishes.map(item => `
      <div class="list-item">
        <div class="list-item-main">
          <div>${escapeHtml(item.text)}</div>
          <div class="list-item-sub">${new Date(item.createdAt).toLocaleDateString('ja-JP')}</div>
        </div>
        <div class="list-actions">
          <button class="small-btn" data-action="complete-wish" data-id="${item.id}">達成</button>
          <button class="small-btn" data-action="delete-wish" data-id="${item.id}">削除</button>
        </div>
      </div>`).join('')
    : '<div class="list-item-sub">まだ登録がありません。</div>';

  el.doneList.innerHTML = state.data.dones.length
    ? state.data.dones.map(item => `
      <div class="list-item">
        <div class="list-item-main">
          <div>${escapeHtml(item.text)}</div>
          <div class="list-item-sub">${new Date(item.movedAt || item.createdAt).toLocaleDateString('ja-JP')}</div>
        </div>
        <div class="list-actions">
          <button class="small-btn" data-action="delete-done" data-id="${item.id}">削除</button>
        </div>
      </div>`).join('')
    : '<div class="list-item-sub">まだ登録がありません。</div>';
}

function renderWeekdays() {
  el.weekdayRow.innerHTML = weekNames.map(name => `<div class="calendar-weekday">${name}</div>`).join('');
}

function getMonthMatrix(year, month) {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const startDate = new Date(year, month, 1 - firstWeekday);
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + i);
    days.push(current);
  }
  return days;
}

function renderCalendar() {
  el.monthLabel.textContent = `${state.cursorYear}年${state.cursorMonth + 1}月`;
  const days = getMonthMatrix(state.cursorYear, state.cursorMonth);

  el.calendarGrid.innerHTML = days.map(date => {
    const dateKey = toDateKey(date);
    const entry = state.data.dayEntries[dateKey];
    const isOther = date.getMonth() !== state.cursorMonth;
    const isSelected = dateKey === state.selectedDate;
    return `
      <button class="calendar-cell ${isOther ? 'other-month' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateKey}" type="button">
        <div class="calendar-day-number">${date.getDate()}</div>
        ${entry ? '<div class="calendar-chip">記録あり</div>' : ''}
        <div class="calendar-title">${entry?.title ? escapeHtml(entry.title) : ''}</div>
      </button>
    `;
  }).join('');
}

function renderSelectedDay() {
  const entry = state.data.dayEntries[state.selectedDate] || {};
  el.detailDateLabel.textContent = formatDateLabel(state.selectedDate);
  el.dayStatusBadge.textContent = entry.title || entry.note || entry.doneItems ? '記録済み' : '未記録';
  el.dayStatusBadge.className = `badge ${entry.title || entry.note || entry.doneItems ? '' : 'muted'}`;

  el.dayTitleInput.value = entry.title || '';
  el.dayNoteInput.value = entry.note || '';
  el.dayDoneItemsInput.value = entry.doneItems || '';

  if (entry.photo?.fileId) {
    el.photoPreview.src = buildPhotoUrl(entry.photo.fileId);
    el.photoPreview.classList.remove('hidden');
    el.photoEmpty.classList.add('hidden');
  } else if (state.pendingPhotoDataUrl) {
    el.photoPreview.src = state.pendingPhotoDataUrl;
    el.photoPreview.classList.remove('hidden');
    el.photoEmpty.classList.add('hidden');
  } else {
    el.photoPreview.removeAttribute('src');
    el.photoPreview.classList.add('hidden');
    el.photoEmpty.classList.remove('hidden');
  }
}

function renderAll() {
  renderLists();
  renderCalendar();
  renderSelectedDay();
}

function ensureDayEntry(dateKey) {
  if (!state.data.dayEntries[dateKey]) {
    state.data.dayEntries[dateKey] = {
      title: '',
      note: '',
      doneItems: '',
      photo: null,
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
  entry.doneItems = el.dayDoneItemsInput.value.trim();
  entry.updatedAt = new Date().toISOString();

  if (state.pendingPhotoDataUrl) {
    try {
      const uploaded = await uploadDayPhoto(state.selectedDate, state.pendingPhotoDataUrl);
      entry.photo = {
        fileId: uploaded.file.id,
        mimeType: uploaded.file.mimeType,
        name: uploaded.file.name,
        updatedAt: uploaded.file.modifiedTime || new Date().toISOString()
      };
      state.pendingPhotoDataUrl = null;
    } catch (error) {
      alert(`写真の保存に失敗しました: ${error.message}`);
      return;
    }
  }

  saveLocalData();
  renderAll();
}

function clearDayEntryInputs() {
  el.dayTitleInput.value = '';
  el.dayNoteInput.value = '';
  el.dayDoneItemsInput.value = '';
  el.photoInput.value = '';
  state.pendingPhotoDataUrl = null;
  renderSelectedDay();
}

async function handlePhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.pendingPhotoDataUrl = reader.result;
    renderSelectedDay();
  };
  reader.readAsDataURL(file);
}

function bindEvents() {
  el.wishForm.addEventListener('submit', event => {
    event.preventDefault();
    const value = el.wishInput.value.trim();
    if (!value) return;
    addWish(value);
    el.wishInput.value = '';
  });

  el.doneForm.addEventListener('submit', event => {
    event.preventDefault();
    const value = el.doneInput.value.trim();
    if (!value) return;
    addDone(value);
    el.doneInput.value = '';
  });

  document.addEventListener('click', event => {
    const action = event.target.dataset.action;
    const id = event.target.dataset.id;
    if (action === 'complete-wish') moveWishToDone(id);
    if (action === 'delete-wish') removeItem('wishes', id);
    if (action === 'delete-done') removeItem('dones', id);

    const date = event.target.dataset.date;
    if (date) {
      state.selectedDate = date;
      state.pendingPhotoDataUrl = null;
      renderCalendar();
      renderSelectedDay();
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
  el.driveSyncBtn.addEventListener('click', async () => {
    try {
      await syncToDrive();
    } catch (error) {
      alert(`Drive保存に失敗しました: ${error.message}`);
      el.driveSyncBtn.disabled = false;
      el.driveSyncBtn.textContent = 'Driveに保存';
    }
  });
}

renderWeekdays();
bindEvents();
renderAll();
loadFromDrive();

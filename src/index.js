import './styles/styles.css';
import 'sweetalert2/dist/sweetalert2.min.css';
import './components/NoteInput.js';
import './components/NoteList.js';
import {
  getNotes,
  addNote,
  deleteNote,
  archiveNote,
  unarchiveNote,
  getArchivedNotes,
} from './utils/api.js';
import { showLoading, hideLoading } from './utils/helpers.js';
import Swal from 'sweetalert2';

const NOTE_INPUT_SECTION_ID = 'noteInputSection';
const NOTE_DISPLAY_SECTION_ID = 'noteDisplaySection';
const NOTES_LIST_CONTAINER_ID = 'notes-list-container';
const LOADING_ID = 'notes-loading';
const OFFLINE_STATUS_ID = 'offline-status';
const CACHE_STATUS_ID = 'cache-status';
const SYNC_STATUS_ID = 'sync-status';
const SEARCH_INPUT_ID = 'searchNote';
const THEME_TOGGLE_BUTTON_ID = 'theme-toggle-button';
const BODY_ELEMENT = document.body;
const FILTER_BUTTONS_SELECTOR = '.filter-button';
const SORT_SELECT_ID = 'sort-select';
const LIST_HEADING_ID = 'list-heading';
const ACTIVE_CLASS = 'active';

const ACTIVE_NOTES_CACHE_KEY = 'activeNotesCache';
const ARCHIVED_NOTES_CACHE_KEY = 'archivedNotesCache';
const OFFLINE_ACTION_QUEUE_KEY = 'offlineActionQueue';
const THEME_PREFERENCE_KEY = 'themePreference';
const FILTER_PREFERENCE_KEY = 'filterPreference';
const SORT_PREFERENCE_KEY = 'sortPreference';

const ACTION_ADD = 'add';
const ACTION_DELETE = 'delete';
const ACTION_ARCHIVE = 'archive';
const ACTION_UNARCHIVE = 'unarchive';

const MSG_OFFLINE_ACTION_QUEUED =
  'Offline: Action queued. Syncing when online.';
const MSG_OFFLINE_LOAD_FAILED = 'Offline: Cannot load fresh notes.';
const MSG_CACHE_DISPLAYED = 'Showing potentially outdated cached data.';
const MSG_SYNCING_ACTIONS = 'Syncing offline actions...';
const MSG_SYNC_COMPLETE = 'Offline actions synced successfully.';
const MSG_SYNC_FAILED_DETAILS = (count) =>
  `${count} offline action(s) failed to sync. Please check connection and try again later.`;
const MSG_LOAD_ERROR_TITLE = 'Failed to Load Notes';
const MSG_ADD_ERROR_TITLE = 'Failed to Add Note';
const MSG_DELETE_ERROR_TITLE = 'Failed to Delete Note';
const MSG_ARCHIVE_ERROR_TITLE = 'Failed to Archive Note';
const MSG_UNARCHIVE_ERROR_TITLE = 'Failed to Unarchive Note';
const MSG_GENERIC_API_ERROR = 'An API error occurred.';
const MSG_NETWORK_ERROR = 'Network error. Check connection or try again.';
const MSG_CLIENT_ERROR = 'An unexpected client error occurred.';
const MSG_CACHE_SAVE_FAIL = 'Could not save data locally.';

const DEFAULT_FILTER = 'active';
const DEFAULT_SORT = 'date-desc';
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_COUNT = 4;
const SYNC_RETRY_DELAY_MS = 1500;

let currentSearchTerm = '';
let searchDebounceTimeout = null;
let isSyncing = false;
let currentFilter =
  localStorage.getItem(FILTER_PREFERENCE_KEY) || DEFAULT_FILTER;
let currentSort = localStorage.getItem(SORT_PREFERENCE_KEY) || DEFAULT_SORT;

let allActiveNotes = [];
let allArchivedNotes = [];

const noteInputSection = document.getElementById(NOTE_INPUT_SECTION_ID);
const noteDisplaySection = document.getElementById(NOTE_DISPLAY_SECTION_ID);
const notesListContainer = document.getElementById(NOTES_LIST_CONTAINER_ID);
const loadingIndicator = document.getElementById(LOADING_ID);
const offlineStatusBanner = document.getElementById(OFFLINE_STATUS_ID);
const cacheStatusBanner = document.getElementById(CACHE_STATUS_ID);
const syncStatusBanner = document.getElementById(SYNC_STATUS_ID);
const searchInputElement = document.getElementById(SEARCH_INPUT_ID);
const themeToggleButton = document.getElementById(THEME_TOGGLE_BUTTON_ID);
const filterButtons = document.querySelectorAll(FILTER_BUTTONS_SELECTOR);
const sortSelectElement = document.getElementById(SORT_SELECT_ID);
const listHeadingElement = document.getElementById(LIST_HEADING_ID);
let noteInputElement = null;
let noteListElement = null;
let isInitialized = false;
let onlineStatusListenerAttached = false;
let themeMediaListenerAttached = false;

const showAlert = (type, title, text) => {
  Swal.fire({
    icon: type,
    title: title,
    text: text,
    timer: type === 'success' ? 1500 : undefined,
    showConfirmButton: type !== 'success',
    customClass: { popup: 'swal-popup-custom' },
    background: getComputedStyle(BODY_ELEMENT)
      .getPropertyValue('--bg-secondary')
      .trim(),
    color: getComputedStyle(BODY_ELEMENT)
      .getPropertyValue('--text-primary')
      .trim(),
  });
};

function createSkeletonItemHTML() {
  return `<div class="skeleton-item" aria-hidden="true"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line text"></div><div class="skeleton-line text" style="width: 40%;"></div></div>`;
}
function createMultipleSkeletonsHTML(count) {
  if (count <= 0) return '';
  return createSkeletonItemHTML().repeat(count);
}
function saveToCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data || []));
  } catch (error) {
    console.error(`Cache Save Err ('${key}'):`, error);
    showAlert('warning', 'Cache Warning', MSG_CACHE_SAVE_FAIL);
  }
}
function loadFromCache(key) {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : [];
  } catch (error) {
    console.error(`Cache Load Err ('${key}'):`, error);
    return [];
  }
}
function getOfflineActionQueue() {
  return loadFromCache(OFFLINE_ACTION_QUEUE_KEY) || [];
}
function saveOfflineActionQueue(q) {
  saveToCache(OFFLINE_ACTION_QUEUE_KEY, q);
}

function generateTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

function applyOptimisticUpdate(action) {
  let note;
  switch (action.type) {
    case ACTION_ADD:
      note = {
        ...action.payload,
        id: action.tempId,
        createdAt: new Date().toISOString(),
        isOptimistic: true,
      };
      allActiveNotes = [note, ...allActiveNotes];
      saveToCache(ACTIVE_NOTES_CACHE_KEY, allActiveNotes);
      break;
    case ACTION_DELETE:
      allActiveNotes = allActiveNotes.filter((n) => n.id !== action.payload.id);
      allArchivedNotes = allArchivedNotes.filter(
        (n) => n.id !== action.payload.id
      );
      saveToCache(ACTIVE_NOTES_CACHE_KEY, allActiveNotes);
      saveToCache(ARCHIVED_NOTES_CACHE_KEY, allArchivedNotes);
      break;
    case ACTION_ARCHIVE:
      note = allActiveNotes.find((n) => n.id === action.payload.id);
      if (note) {
        allActiveNotes = allActiveNotes.filter(
          (n) => n.id !== action.payload.id
        );
        allArchivedNotes = [
          { ...note, archived: true, isOptimistic: true },
          ...allArchivedNotes,
        ];
        saveToCache(ACTIVE_NOTES_CACHE_KEY, allActiveNotes);
        saveToCache(ARCHIVED_NOTES_CACHE_KEY, allArchivedNotes);
      }
      break;
    case ACTION_UNARCHIVE:
      note = allArchivedNotes.find((n) => n.id === action.payload.id);
      if (note) {
        allArchivedNotes = allArchivedNotes.filter(
          (n) => n.id !== action.payload.id
        );
        allActiveNotes = [
          { ...note, archived: false, isOptimistic: true },
          ...allActiveNotes,
        ];
        saveToCache(ACTIVE_NOTES_CACHE_KEY, allActiveNotes);
        saveToCache(ARCHIVED_NOTES_CACHE_KEY, allArchivedNotes);
      }
      break;
  }
  const sourceNotes =
    currentFilter === 'active' ? allActiveNotes : allArchivedNotes;
  const sortedNotes = sortNotes(sourceNotes, currentSort);
  const finalNotesToRender = filterNotes(sortedNotes, currentSearchTerm);
  renderNotesToDOM(finalNotesToRender, false);
}

function enqueueOfflineAction(action) {
  if (!action || !action.type || !action.payload) {
    console.error('Invalid action:', action);
    return;
  }
  if (action.type === ACTION_ADD) action.tempId = generateTempId();
  const queue = getOfflineActionQueue();
  action.timestamp = Date.now();
  queue.push(action);
  saveOfflineActionQueue(queue);
  applyOptimisticUpdate(action);
  showAlert('info', 'Action Queued', MSG_OFFLINE_ACTION_QUEUED);
}

function isNetworkError(error) {
  const msg = error?.message?.toLowerCase() || '';
  return msg.includes('network') || msg.includes('fetch');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processSingleOfflineAction(action) {
  if (!action || !action.type) return { success: false };
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    attempt++;
    if (!navigator.onLine)
      return {
        success: false,
        error: new Error('Connection lost during attempt'),
      };

    try {
      console.log(`Attempt ${attempt} sync:`, action);
      let response;
      switch (action.type) {
        case ACTION_ADD:
          response = await addNote(action.payload.title, action.payload.body);
          return {
            success: true,
            responseData: response.data,
            tempId: action.tempId,
          };
        case ACTION_DELETE:
          await deleteNote(action.payload.id);
          return { success: true };
        case ACTION_ARCHIVE:
          await archiveNote(action.payload.id);
          return { success: true };
        case ACTION_UNARCHIVE:
          await unarchiveNote(action.payload.id);
          return { success: true };
        default:
          console.warn('Unknown action type:', action.type);
          return { success: false };
      }
    } catch (error) {
      console.error(`Sync attempt ${attempt} failed:`, action, error);
      if (attempt === maxAttempts || !isNetworkError(error)) {
        return { success: false, error: error };
      }
      await delay(SYNC_RETRY_DELAY_MS);
    }
  }
  return { success: false, error: new Error('Sync failed after retries') };
}

async function syncOfflineActions() {
  if (!navigator.onLine || isSyncing) return;
  let queue = getOfflineActionQueue();
  if (queue.length === 0) return;
  isSyncing = true;
  if (syncStatusBanner) {
    syncStatusBanner.textContent = `${MSG_SYNCING_ACTIONS} (${queue.length})`;
    syncStatusBanner.style.display = 'block';
  }
  console.log(`Syncing ${queue.length} actions...`);

  let remainingQueue = [];
  let syncErrors = false;
  let syncedCount = 0;
  let needFullReload = false;
  const initialQueueLength = queue.length;

  for (const action of queue) {
    if (!navigator.onLine) {
      syncErrors = true;
      console.warn('Offline during sync.');
      break;
    }
    if (syncStatusBanner)
      syncStatusBanner.textContent = `${MSG_SYNCING_ACTIONS} (${initialQueueLength - syncedCount - remainingQueue.length})`;

    const result = await processSingleOfflineAction(action);

    if (result.success) {
      syncedCount++;
      if (
        action.type === ACTION_ADD &&
        result.tempId &&
        result.responseData?.id
      ) {
        const noteIndex = allActiveNotes.findIndex(
          (n) => n.id === result.tempId
        );
        if (noteIndex !== -1) {
          allActiveNotes[noteIndex].id = result.responseData.id;
          delete allActiveNotes[noteIndex].isOptimistic;
          delete allActiveNotes[noteIndex].tempId;
        }
        needFullReload = true;
      } else if (action.type !== ACTION_ADD) {
        needFullReload = true;
      }
    } else {
      syncErrors = true;
      remainingQueue.push(action);
      if (action.type === ACTION_ADD && action.tempId) {
        allActiveNotes = allActiveNotes.filter((n) => n.id !== action.tempId);
        needFullReload = true;
      }
      needFullReload = true;
    }
  }

  saveToCache(ACTIVE_NOTES_CACHE_KEY, allActiveNotes);
  saveOfflineActionQueue(remainingQueue);
  isSyncing = false;
  if (syncStatusBanner) syncStatusBanner.style.display = 'none';

  if (remainingQueue.length === 0 && !syncErrors && syncedCount > 0)
    showAlert('success', 'Sync Complete', MSG_SYNC_COMPLETE);
  else if (syncErrors)
    showAlert(
      'warning',
      'Sync Issue',
      MSG_SYNC_FAILED_DETAILS(remainingQueue.length)
    );

  if (needFullReload || syncedCount > 0) {
    console.log('Reloading notes after sync...');
    await loadNotes(true);
  }
}

function filterNotes(notes, term) {
  const lowerCaseTerm = term.toLowerCase().trim();
  if (!lowerCaseTerm) return notes;
  if (!Array.isArray(notes)) return [];
  return notes.filter(
    (note) =>
      note.title?.toLowerCase().includes(lowerCaseTerm) ||
      note.body?.toLowerCase().includes(lowerCaseTerm)
  );
}

function sortNotes(notes, sortKey) {
  if (!Array.isArray(notes)) return [];
  const sortedNotes = [...notes];
  try {
    switch (sortKey) {
      case 'date-desc':
        sortedNotes.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        break;
      case 'date-asc':
        sortedNotes.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        break;
      case 'title-asc':
        sortedNotes.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        sortedNotes.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }
  } catch (e) {
    console.error('Sort Err:', e);
  }
  return sortedNotes;
}

function getFriendlyErrorMessage(error) {
  const message = error?.message || MSG_GENERIC_API_ERROR;
  if (error instanceof TypeError && message.toLowerCase().includes('fetch')) {
    return MSG_NETWORK_ERROR;
  }
  if (error?.status === 404 || message.includes('404'))
    return 'Note not found.';
  if (error?.status === 500 || message.includes('500')) return 'Server error.';
  if (message.toLowerCase().includes('network')) return MSG_NETWORK_ERROR;
  return message || MSG_CLIENT_ERROR;
}

const updateOnlineStatus = async () => {
  const isOnline = navigator.onLine;
  if (offlineStatusBanner)
    offlineStatusBanner.style.display = isOnline ? 'none' : 'block';
  if (noteInputElement) noteInputElement.disabled = !isOnline;
  if (isOnline) {
    console.log('Online.');
    if (cacheStatusBanner) cacheStatusBanner.style.display = 'none';
    await syncOfflineActions();
  } else {
    console.log('Offline.');
  }
};

function attachOnlineStatusListeners() {
  if (onlineStatusListenerAttached) return;
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  onlineStatusListenerAttached = true;
}

function renderNotesToDOM(notesToRender, isLoading) {
  if (!notesListContainer || !loadingIndicator) return;

  if (isLoading) {
    showLoading(loadingIndicator);
    loadingIndicator.innerHTML = createMultipleSkeletonsHTML(SKELETON_COUNT);
    if (noteListElement) noteListElement.remove();
    noteListElement = null;
    return;
  }

  hideLoading(loadingIndicator);

  if (!noteListElement) {
    noteListElement = document.createElement('note-list');
    notesListContainer.appendChild(noteListElement);
  }

  noteListElement.setOnDelete(noteActionCallbacks.handleDelete);
  if (currentFilter === 'active') {
    noteListElement.setOnArchive(noteActionCallbacks.handleArchive);
    noteListElement.setOnUnarchive(null);
  } else {
    noteListElement.setOnUnarchive(noteActionCallbacks.handleUnarchive);
    noteListElement.setOnArchive(null);
  }

  if (listHeadingElement)
    listHeadingElement.textContent = `${currentFilter === 'active' ? 'Active' : 'Archived'} Notes List`;

  const notesWithDelay = notesToRender.map((note, index) => ({
    ...note,
    style: `--animation-order: ${index}`,
  }));
  noteListElement.notes = notesWithDelay;
}

const noteActionCallbacks = {
  handleDelete: async (id) => {
    if (!navigator.onLine) {
      enqueueOfflineAction({ type: ACTION_DELETE, payload: { id } });
      return;
    }
    const result = await Swal.fire({
      title: 'Delete Note?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--action-danger, #d33)',
      cancelButtonColor: 'var(--text-tertiary, #6c757d)',
      confirmButtonText: 'Yes, delete',
      customClass: { popup: 'swal-popup-custom' },
      background: getComputedStyle(BODY_ELEMENT)
        .getPropertyValue('--bg-secondary')
        .trim(),
      color: getComputedStyle(BODY_ELEMENT)
        .getPropertyValue('--text-primary')
        .trim(),
    });
    if (result.isConfirmed) {
      renderNotesToDOM([], true);
      try {
        await deleteNote(id);
        showAlert('success', 'Note Deleted', 'Note successfully deleted.');
        await loadNotes(true);
      } catch (error) {
        console.error(`Del Err ${id}:`, error);
        showAlert(
          'error',
          MSG_DELETE_ERROR_TITLE,
          getFriendlyErrorMessage(error)
        );
        await loadNotes(false);
      }
    }
  },
  handleArchive: async (id) => {
    if (!navigator.onLine) {
      enqueueOfflineAction({ type: ACTION_ARCHIVE, payload: { id } });
      return;
    }
    const result = await Swal.fire({
      title: 'Archive Note?',
      text: 'Move this note to the archive?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--action-success, #5d9c59)',
      cancelButtonColor: 'var(--text-tertiary, #6c757d)',
      confirmButtonText: 'Yes, archive',
      customClass: { popup: 'swal-popup-custom' },
      background: getComputedStyle(BODY_ELEMENT)
        .getPropertyValue('--bg-secondary')
        .trim(),
      color: getComputedStyle(BODY_ELEMENT)
        .getPropertyValue('--text-primary')
        .trim(),
    });
    if (result.isConfirmed) {
      renderNotesToDOM([], true);
      try {
        await archiveNote(id);
        showAlert('success', 'Note Archived', 'Note moved to archive.');
        await loadNotes(true);
      } catch (error) {
        console.error(`Arch Err ${id}:`, error);
        showAlert(
          'error',
          MSG_ARCHIVE_ERROR_TITLE,
          getFriendlyErrorMessage(error)
        );
        await loadNotes(false);
      }
    }
  },
  handleUnarchive: async (id) => {
    if (!navigator.onLine) {
      enqueueOfflineAction({ type: ACTION_UNARCHIVE, payload: { id } });
      return;
    }
    const result = await Swal.fire({
      title: 'Unarchive Note?',
      text: 'Move this note back to active notes?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--action-secondary, #6c757d)',
      cancelButtonColor: 'var(--text-tertiary, #aaa)',
      confirmButtonText: 'Yes, unarchive',
      customClass: { popup: 'swal-popup-custom' },
      background: getComputedStyle(BODY_ELEMENT)
        .getPropertyValue('--bg-secondary')
        .trim(),
      color: getComputedStyle(BODY_ELEMENT)
        .getPropertyValue('--text-primary')
        .trim(),
    });
    if (result.isConfirmed) {
      renderNotesToDOM([], true);
      try {
        await unarchiveNote(id);
        showAlert('success', 'Note Unarchived', 'Note moved to active.');
        await loadNotes(true);
      } catch (error) {
        console.error(`Unarch Err ${id}:`, error);
        showAlert(
          'error',
          MSG_UNARCHIVE_ERROR_TITLE,
          getFriendlyErrorMessage(error)
        );
        await loadNotes(false);
      }
    }
  },
};

async function fetchAndCacheAllNotes() {
  console.log('Fetching fresh data...');
  try {
    const [notesResult, archivedNotesResult] = await Promise.all([
      getNotes(),
      getArchivedNotes(),
    ]);
    const activeN = notesResult.data || [];
    const archivedN = archivedNotesResult.data || [];
    saveToCache(ACTIVE_NOTES_CACHE_KEY, activeN);
    saveToCache(ARCHIVED_NOTES_CACHE_KEY, archivedN);
    console.log('Fetched & cached.');
    return { activeNotes: activeN, archivedNotes: archivedN, error: null };
  } catch (error) {
    console.error('API Load Err:', error);
    return { activeNotes: [], archivedNotes: [], error: error };
  }
}

async function loadNotesFromSource() {
  const isOnline = navigator.onLine;
  let activeN = [];
  let archivedN = [];
  let error = null;
  let displayedCache = false;
  const cachedActive = loadFromCache(ACTIVE_NOTES_CACHE_KEY);
  const cachedArchived = loadFromCache(ARCHIVED_NOTES_CACHE_KEY);

  if (isOnline) {
    const result = await fetchAndCacheAllNotes();
    activeN = result.activeNotes;
    archivedN = result.archivedNotes;
    error = result.error;
    if (error) {
      activeN = cachedActive || [];
      archivedN = cachedArchived || [];
      const friendlyMsg = getFriendlyErrorMessage(error);
      if (activeN.length > 0 || archivedN.length > 0) {
        if (!isSyncing)
          showAlert(
            'error',
            MSG_LOAD_ERROR_TITLE,
            `${friendlyMsg}. Displaying cache.`
          );
        displayedCache = true;
      } else {
        if (!isSyncing) showAlert('error', MSG_LOAD_ERROR_TITLE, friendlyMsg);
      }
    }
  } else {
    console.log('Offline: Loading from cache...');
    if (!isSyncing) showAlert('info', 'Offline Mode', MSG_OFFLINE_LOAD_FAILED);
    activeN = cachedActive || [];
    archivedN = cachedArchived || [];
    if (activeN.length > 0 || archivedN.length > 0) displayedCache = true;
  }
  if (cacheStatusBanner)
    cacheStatusBanner.style.display = displayedCache ? 'block' : 'none';
  allActiveNotes = activeN;
  allArchivedNotes = archivedN;
  return { activeNotes: activeN, archivedNotes: archivedN };
}

async function loadNotes(showFullLoadingIndicator = true) {
  if (showFullLoadingIndicator && loadingIndicator) renderNotesToDOM([], true);
  if (cacheStatusBanner) cacheStatusBanner.style.display = 'none';
  const { activeNotes, archivedNotes } = await loadNotesFromSource();
  const sourceNotes = currentFilter === 'active' ? activeNotes : archivedNotes;
  const sortedNotes = sortNotes(sourceNotes, currentSort);
  const finalNotesToRender = filterNotes(sortedNotes, currentSearchTerm);
  renderNotesToDOM(finalNotesToRender, false);
}

function setupNoteInput() {
  if (!noteInputSection) return;
  noteInputSection.innerHTML = '';
  noteInputElement = document.createElement('note-input');
  const handleAddNoteSubmit = async (title, body) => {
    if (!navigator.onLine) {
      enqueueOfflineAction({ type: ACTION_ADD, payload: { title, body } });
      if (noteInputElement?.noteTitleInput)
        noteInputElement.noteTitleInput.value = '';
      if (noteInputElement?.noteBodyInput)
        noteInputElement.noteBodyInput.value = '';
      noteInputElement?.noteTitleInput?.focus();
      return;
    }
    renderNotesToDOM([], true);
    try {
      await addNote(title, body);
      showAlert('success', 'Note Added', 'Note added successfully.');
      if (searchInputElement) searchInputElement.value = '';
      currentSearchTerm = '';
      currentFilter = 'active';
      updateFilterControls();
      currentSort = DEFAULT_SORT;
      updateSortControl();
      await loadNotes(true);
    } catch (error) {
      console.error('Add Err:', error);
      showAlert('error', MSG_ADD_ERROR_TITLE, getFriendlyErrorMessage(error));
      await loadNotes(false);
    }
  };
  noteInputElement.setOnAddNote(handleAddNoteSubmit);
  noteInputSection.appendChild(noteInputElement);
  noteInputElement.disabled = !navigator.onLine;
}

function handleSearchInput() {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(async () => {
    currentSearchTerm = searchInputElement?.value || '';
    console.log(`Searching: "${currentSearchTerm}"`);
    await loadNotes(false);
  }, SEARCH_DEBOUNCE_MS);
}

function setupSearch() {
  if (searchInputElement)
    searchInputElement.addEventListener('input', handleSearchInput);
  else console.warn('Search input not found.');
}

function applyTheme(theme) {
  BODY_ELEMENT.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  localStorage.setItem(THEME_PREFERENCE_KEY, theme);
}

function toggleTheme() {
  const newTheme = BODY_ELEMENT.classList.contains('dark-theme')
    ? 'light'
    : 'dark';
  applyTheme(newTheme);
}

function setupTheme() {
  const savedTheme = localStorage.getItem(THEME_PREFERENCE_KEY);
  const prefersDark = window.matchMedia?.(
    '(prefers-color-scheme: dark)'
  ).matches;
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  if (themeToggleButton)
    themeToggleButton.addEventListener('click', toggleTheme);
  else console.warn('Theme toggle button not found.');
  if (!themeMediaListenerAttached && window.matchMedia) {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!localStorage.getItem(THEME_PREFERENCE_KEY))
          applyTheme(e.matches ? 'dark' : 'light');
      });
    themeMediaListenerAttached = true;
  }
}

function updateFilterControls() {
  filterButtons.forEach((button) => {
    if (button.dataset.filter === currentFilter)
      button.classList.add(ACTIVE_CLASS);
    else button.classList.remove(ACTIVE_CLASS);
  });
  localStorage.setItem(FILTER_PREFERENCE_KEY, currentFilter);
}

function updateSortControl() {
  if (sortSelectElement) sortSelectElement.value = currentSort;
  localStorage.setItem(SORT_PREFERENCE_KEY, currentSort);
}

function setupControls() {
  filterButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const newFilter = button.dataset.filter;
      if (newFilter && newFilter !== currentFilter) {
        currentFilter = newFilter;
        updateFilterControls();
        await loadNotes(false);
      }
    });
  });
  if (sortSelectElement) {
    sortSelectElement.value = currentSort;
    sortSelectElement.addEventListener('change', async (event) => {
      currentSort = event.target.value;
      updateSortControl();
      await loadNotes(false);
    });
  } else {
    console.warn('Sort select not found.');
  }
  updateFilterControls();
}

async function initializeApp() {
  if (isInitialized) return;
  isInitialized = true;
  console.log('Init App...');
  setupNoteInput();
  setupSearch();
  setupTheme();
  setupControls();
  attachOnlineStatusListeners();
  updateOnlineStatus();
  await syncOfflineActions();
  await loadNotes();
  console.log('App Initialized.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

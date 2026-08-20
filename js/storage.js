/* IndexedDB-backed persistence. Photos are stored as data URLs inside the
   card record, which is why this uses IDB instead of localStorage (5MB cap). */
const DB_NAME = 'newyear-bingo';
const DB_VERSION = 1;
const STORE = 'cards';
const CARD_KEY = 'current';

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadCard() {
  try {
    return await idbGet(CARD_KEY);
  } catch (err) {
    console.warn('Could not read saved card:', err);
    return null;
  }
}

/* Saves are debounced: tile edits fire rapidly while typing a note. */
let _saveTimer = null;
let _pendingCard = null;

function saveCard(card, { immediate = false } = {}) {
  _pendingCard = card;
  if (_saveTimer) clearTimeout(_saveTimer);
  if (immediate) return flushSave();
  return new Promise(resolve => {
    _saveTimer = setTimeout(() => resolve(flushSave()), 250);
  });
}

async function flushSave() {
  _saveTimer = null;
  if (!_pendingCard) return;
  const card = _pendingCard;
  _pendingCard = null;
  try {
    await idbSet(CARD_KEY, card);
  } catch (err) {
    console.error('Save failed:', err);
    throw err;
  }
}

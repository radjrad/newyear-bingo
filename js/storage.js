/* Persistence with a fallback chain.

   IndexedDB is the first choice: it holds many megabytes, which matters
   because photos are stored as data URLs inside the card record. Browsers
   block IndexedDB when a page is opened straight off the filesystem
   (file://), which is exactly how someone opens a copy sent to them, so we
   fall back to localStorage there and warn if the photos overflow its ~5MB. */

const DB_NAME = 'newyear-bingo';
const DB_VERSION = 1;
const STORE = 'cards';
const CARD_KEY = 'current';
const LS_KEY = 'newyear-bingo-card';

let _dbPromise = null;
let _mode = null;              // 'idb' | 'ls', decided on first use

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('no indexedDB'));
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      return reject(err);     // file:// throws synchronously in some browsers
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('indexedDB blocked'));
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });
  return _dbPromise;
}

async function storageMode() {
  if (_mode) return _mode;
  try {
    await openDB();
    _mode = 'idb';
  } catch {
    _mode = 'ls';
  }
  return _mode;
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
    if (await storageMode() === 'idb') return await idbGet(CARD_KEY);
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Could not read saved card:', err);
    return null;
  }
}

/* The goal bank lives outside the card so Reset never touches it. */
const BANK_KEY = 'goalbank';
const LS_BANK_KEY = 'newyear-bingo-goalbank';

async function loadGoalBank() {
  try {
    if (await storageMode() === 'idb') return (await idbGet(BANK_KEY)) || [];
    const raw = localStorage.getItem(LS_BANK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveGoalBank(bank) {
  try {
    if (await storageMode() === 'idb') await idbSet(BANK_KEY, bank);
    else localStorage.setItem(LS_BANK_KEY, JSON.stringify(bank));
  } catch (err) {
    console.error('Goal bank save failed:', err);
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
    if (await storageMode() === 'idb') {
      await idbSet(CARD_KEY, card);
    } else {
      localStorage.setItem(LS_KEY, JSON.stringify(card));
    }
  } catch (err) {
    console.error('Save failed:', err);
    // app.js defines this to surface the problem instead of failing silently.
    if (typeof onStorageError === 'function') onStorageError(err);
  }
}

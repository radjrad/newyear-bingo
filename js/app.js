/* App controller: card state, rendering, editing, and export wiring. */

const $ = sel => document.querySelector(sel);
const MAX_PHOTO_EDGE = 1400;   // px, longest side after downscale
const PHOTO_QUALITY = 0.85;

let card = null;
let activeIndex = null;        // tile currently open in the editor
let activeCategory = 'All';

/* ---------- Card model ---------- */

function makeTile(overrides = {}) {
  return {
    text: '',
    category: '',
    done: false,
    doneAt: '',
    note: '',
    photo: null,
    free: false,
    ...overrides
  };
}

function defaultYear() {
  const now = new Date();
  // From November on, people are planning the year ahead.
  return now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
}

function createCard(size = 5) {
  const tiles = Array.from({ length: size * size }, () => makeTile());
  const c = {
    version: 1,
    title: `${defaultYear()} Bingo`,
    subtitle: 'A year worth checking off',
    size,
    tiles,
    createdAt: new Date().toISOString()
  };
  applyFreeCenter(c);
  return c;
}

/* Odd grids get a free centre square; even grids don't have one. */
function applyFreeCenter(c) {
  c.tiles.forEach(t => { if (t.free) { t.free = false; t.text = ''; } });
  if (c.size % 2 === 1) {
    const mid = Math.floor(c.tiles.length / 2);
    c.tiles[mid] = makeTile({ free: true, done: true, text: 'FREE' });
  }
}

/* Resizes the grid, keeping as much existing content as possible. */
function resizeCard(newSize) {
  const old = card.size;
  if (newSize === old) return;
  const kept = card.tiles.filter(t => !t.free && (t.text || t.photo));

  // Shrinking can push filled tiles off the card, so confirm before losing them.
  const capacity = newSize * newSize - (newSize % 2 === 1 ? 1 : 0);
  const willDrop = Math.max(0, kept.length - capacity);
  if (willDrop > 0 &&
      !confirm(`Switching to ${newSize}×${newSize} drops ${willDrop} filled tile${willDrop > 1 ? 's' : ''} (photos and notes included). Continue?`)) {
    render();
    return;
  }

  const tiles = Array.from({ length: newSize * newSize }, () => makeTile());
  card.size = newSize;
  card.tiles = tiles;
  applyFreeCenter(card);
  let k = 0;
  for (let i = 0; i < card.tiles.length && k < kept.length; i++) {
    if (card.tiles[i].free) continue;
    card.tiles[i] = kept[k++];
  }
  const dropped = kept.length - k;
  persist();
  render();
  toast(dropped > 0 ? `Resized to ${newSize}×${newSize} — ${dropped} tile${dropped > 1 ? 's' : ''} didn't fit`
                    : `Resized to ${newSize}×${newSize}`);
}

/* ---------- Stats ---------- */

function countBingos() {
  const n = card.size;
  const done = i => !!card.tiles[i].done;
  let lines = 0;
  for (let r = 0; r < n; r++) {
    let all = true;
    for (let c = 0; c < n; c++) if (!done(r * n + c)) { all = false; break; }
    if (all) lines++;
  }
  for (let c = 0; c < n; c++) {
    let all = true;
    for (let r = 0; r < n; r++) if (!done(r * n + c)) { all = false; break; }
    if (all) lines++;
  }
  let diag = true, anti = true;
  for (let i = 0; i < n; i++) {
    if (!done(i * n + i)) diag = false;
    if (!done(i * n + (n - 1 - i))) anti = false;
  }
  if (diag) lines++;
  if (anti) lines++;
  return lines;
}

/* Indexes belonging to a completed line, for the gold highlight. */
function bingoIndexes() {
  const n = card.size;
  const set = new Set();
  const done = i => !!card.tiles[i].done;
  for (let r = 0; r < n; r++) {
    const row = Array.from({ length: n }, (_, c) => r * n + c);
    if (row.every(done)) row.forEach(i => set.add(i));
  }
  for (let c = 0; c < n; c++) {
    const col = Array.from({ length: n }, (_, r) => r * n + c);
    if (col.every(done)) col.forEach(i => set.add(i));
  }
  const d1 = Array.from({ length: n }, (_, i) => i * n + i);
  if (d1.every(done)) d1.forEach(i => set.add(i));
  const d2 = Array.from({ length: n }, (_, i) => i * n + (n - 1 - i));
  if (d2.every(done)) d2.forEach(i => set.add(i));
  return set;
}

function stats() {
  const total = card.tiles.length;
  const done = card.tiles.filter(t => t.done).length;
  const bingos = countBingos();
  const photos = card.tiles.filter(t => t.photo).length;
  const parts = [`${done} of ${total} complete`];
  if (bingos) parts.push(bingos === 1 ? '1 bingo' : `${bingos} bingos`);
  if (photos) parts.push(`${photos} photo${photos > 1 ? 's' : ''}`);
  return { total, done, bingos, photos, caption: parts.join('  ·  ') };
}

/* ---------- Rendering ---------- */

function render() {
  const grid = $('#grid');
  grid.style.setProperty('--size', card.size);
  grid.innerHTML = '';
  const highlight = bingoIndexes();

  card.tiles.forEach((tile, i) => {
    const el = document.createElement('button');
    el.className = 'tile';
    el.type = 'button';
    el.dataset.index = i;
    el.setAttribute('role', 'gridcell');

    if (tile.free) el.classList.add('free');
    if (tile.done) el.classList.add('done');
    if (tile.photo) el.classList.add('has-photo');
    if (!tile.text && !tile.free) el.classList.add('empty');
    if (highlight.has(i)) el.classList.add('bingo');

    if (tile.photo) {
      const img = document.createElement('img');
      img.className = 'tile-photo';
      img.src = tile.photo;
      img.alt = '';
      el.appendChild(img);
    }

    if (tile.category && !tile.free) {
      const cat = document.createElement('span');
      cat.className = 'tile-cat';
      cat.textContent = tile.category;
      el.appendChild(cat);
    }

    const text = document.createElement('span');
    text.className = 'tile-text';
    text.textContent = tile.free ? 'FREE' : (tile.text || '+ Add a goal');
    el.appendChild(text);

    if (tile.doneAt) {
      const d = document.createElement('span');
      d.className = 'tile-date';
      d.textContent = prettyDate(tile.doneAt);
      el.appendChild(d);
    }

    if (tile.done) {
      const stamp = document.createElement('span');
      stamp.className = 'stamp';
      stamp.textContent = '✓';
      el.appendChild(stamp);
    }

    el.setAttribute('aria-label',
      `${tile.free ? 'Free space' : tile.text || 'Empty tile'}${tile.done ? ', completed' : ''}`);

    el.addEventListener('click', () => openEditor(i));
    wireTileDrop(el, i);
    grid.appendChild(el);
  });

  const s = stats();
  $('#progressText').textContent = `${s.done} of ${s.total}`;
  $('#bingoCount').textContent = s.bingos
    ? (s.bingos === 1 ? '1 bingo! 🎉' : `${s.bingos} bingos! 🎉`)
    : 'No bingos yet';
  $('#progressFill').style.width = `${s.total ? (s.done / s.total) * 100 : 0}%`;

  document.querySelectorAll('.btn-size').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === card.size);
  });
}

function prettyDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}`;
}

function persist() {
  saveCard(card);
}

/* ---------- Tile editor ---------- */

function openEditor(i) {
  const tile = card.tiles[i];
  if (tile.free) {
    toast('That one is free — it counts automatically 🎁');
    return;
  }
  activeIndex = i;
  $('#tileText').value = tile.text;
  $('#tileCategory').value = tile.category || '';
  $('#tileNote').value = tile.note || '';
  $('#tileDate').value = tile.doneAt || '';
  $('#tileDone').checked = tile.done;
  setPhotoPreview(tile.photo);
  syncDateField();
  $('#tileModal').hidden = false;
  setTimeout(() => $('#tileText').focus(), 30);
}

function closeEditor() {
  commitEditor();
  $('#tileModal').hidden = true;
  activeIndex = null;
}

/* Pulls the modal fields back into the tile. */
function commitEditor() {
  if (activeIndex === null) return;
  const tile = card.tiles[activeIndex];
  tile.text = $('#tileText').value.trim();
  tile.category = $('#tileCategory').value;
  tile.note = $('#tileNote').value.trim();
  tile.done = $('#tileDone').checked;
  tile.doneAt = tile.done ? $('#tileDate').value : '';
  persist();
  render();
}

function setPhotoPreview(src) {
  const img = $('#tilePhotoPreview');
  const empty = $('#tilePhotoEmpty');
  const remove = $('#btnRemovePhoto');
  if (src) {
    img.src = src;
    img.hidden = false;
    empty.hidden = true;
    remove.hidden = false;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
    empty.hidden = false;
    remove.hidden = true;
  }
}

function syncDateField() {
  $('#dateField').style.display = $('#tileDone').checked ? '' : 'none';
}

/* ---------- Photos ---------- */

/* Downscales and re-encodes so a 12MP phone photo doesn't blow up storage. */
function processPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('That file is not an image'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode that image'));
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function attachPhoto(index, file) {
  try {
    const dataUrl = await processPhoto(file);
    const tile = card.tiles[index];
    tile.photo = dataUrl;
    // A photo is usually proof it happened — offer the check automatically.
    if (!tile.done) {
      tile.done = true;
      tile.doneAt = tile.doneAt || todayISO();
    }
    await saveCard(card, { immediate: true });
    if (activeIndex === index) {
      setPhotoPreview(dataUrl);
      $('#tileDone').checked = tile.done;
      $('#tileDate').value = tile.doneAt;
      syncDateField();
    }
    render();
    toast('Photo added ✓');
  } catch (err) {
    toast(err.message || 'Could not add that photo');
  }
}

function todayISO() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* Drag a photo from the desktop straight onto a tile. */
function wireTileDrop(el, index) {
  el.addEventListener('dragover', e => {
    e.preventDefault();
    el.classList.add('dragover');
  });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) attachPhoto(index, file);
  });
}

/* ---------- Suggestions ---------- */

function buildCategorySelect() {
  const sel = $('#tileCategory');
  sel.innerHTML = '<option value="">No category</option>' +
    CATEGORY_ORDER.map(c => `<option value="${c}">${c}</option>`).join('');
}

function buildCategoryChips() {
  const wrap = $('#suggestCats');
  wrap.innerHTML = '';
  ['All', ...CATEGORY_ORDER].forEach(cat => {
    const b = document.createElement('button');
    b.className = 'chip' + (cat === activeCategory ? ' active' : '');
    b.textContent = cat;
    b.addEventListener('click', () => {
      activeCategory = cat;
      buildCategoryChips();
      renderSuggestions();
    });
    wrap.appendChild(b);
  });
}

function usedTexts() {
  return new Set(card.tiles.map(t => t.text.toLowerCase()).filter(Boolean));
}

function renderSuggestions() {
  const list = $('#suggestList');
  const query = $('#suggestSearch').value.trim().toLowerCase();
  const used = usedTexts();
  const items = allSuggestions().filter(s =>
    (activeCategory === 'All' || s.category === activeCategory) &&
    (!query || s.text.toLowerCase().includes(query))
  );

  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<p class="suggest-empty">Nothing matches that search.</p>';
    return;
  }

  items.forEach(s => {
    const b = document.createElement('button');
    b.className = 'suggest-item';
    const already = used.has(s.text.toLowerCase());
    b.disabled = already;
    b.innerHTML = `<span>${escapeHtml(s.text)}</span><span class="s-cat">${already ? 'on card' : s.category}</span>`;
    b.addEventListener('click', () => placeSuggestion(s));
    list.appendChild(b);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function firstEmptyIndex() {
  return card.tiles.findIndex(t => !t.free && !t.text);
}

function placeSuggestion(s) {
  const i = firstEmptyIndex();
  if (i === -1) {
    toast('Every tile is filled — clear one first');
    return;
  }
  card.tiles[i] = makeTile({ text: s.text, category: s.category });
  persist();
  render();
  renderSuggestions();
  toast(`Added "${s.text}"`);
}

function fillEmptyTiles() {
  const empties = card.tiles.map((t, i) => i).filter(i => !card.tiles[i].free && !card.tiles[i].text);
  if (!empties.length) {
    toast('No empty tiles to fill');
    return;
  }
  const used = usedTexts();
  const pool = allSuggestions().filter(s => !used.has(s.text.toLowerCase()));
  // Fisher-Yates, so repeated fills don't favour the top of the list.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let filled = 0;
  for (const i of empties) {
    const s = pool.pop();
    if (!s) break;
    card.tiles[i] = makeTile({ text: s.text, category: s.category });
    filled++;
  }
  persist();
  render();
  renderSuggestions();
  toast(`Filled ${filled} tile${filled > 1 ? 's' : ''} 🎲`);
}

function openDrawer(open) {
  $('#suggestPanel').classList.toggle('open', open);
  $('#suggestPanel').setAttribute('aria-hidden', String(!open));
  $('#drawerScrim').hidden = !open;
  if (open) renderSuggestions();
}

/* ---------- Export / backup ---------- */

async function exportCard() {
  toast('Rendering your card…');
  const canvas = await renderCardPNG(card, stats(), bingoIndexes());
  downloadCanvas(canvas, `${slug(card.title)}-bingo.png`);
  toast('Card PNG downloaded ✓');
}

async function exportCollage() {
  const canvas = await renderCollagePNG(card, stats());
  if (!canvas) {
    toast('Add a photo to a tile first 📸');
    return;
  }
  downloadCanvas(canvas, `${slug(card.title)}-photos.png`);
  toast('Collage PNG downloaded ✓');
}

function slug(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'newyear';
}

function backup() {
  const blob = new Blob([JSON.stringify(card)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(card.title)}-bingo-backup.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup saved — photos included');
}

function restore(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.tiles) || !data.size) throw new Error('bad shape');
      card = { ...createCard(data.size), ...data };
      card.tiles = card.tiles.map(t => makeTile(t));
      await saveCard(card, { immediate: true });
      syncHeaderInputs();
      render();
      toast('Card restored ✓');
    } catch {
      toast('That file is not a valid backup');
    }
  };
  reader.readAsText(file);
}

/* ---------- Misc UI ---------- */

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

function syncHeaderInputs() {
  $('#cardTitle').value = card.title;
  $('#cardSubtitle').value = card.subtitle || '';
}

function paintSparkles() {
  const wrap = $('.sparkles');
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 44; i++) {
    const s = document.createElement('i');
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 4}s`;
    s.style.opacity = String(0.2 + Math.random() * 0.6);
    frag.appendChild(s);
  }
  wrap.appendChild(frag);
}

/* ---------- Wiring ---------- */

function wireEvents() {
  $('#cardTitle').addEventListener('input', e => {
    card.title = e.target.value;
    persist();
  });
  $('#cardSubtitle').addEventListener('input', e => {
    card.subtitle = e.target.value;
    persist();
  });

  $('#btnSuggestions').addEventListener('click', () => openDrawer(true));
  $('#btnCloseSuggest').addEventListener('click', () => openDrawer(false));
  $('#drawerScrim').addEventListener('click', () => openDrawer(false));
  $('#suggestSearch').addEventListener('input', renderSuggestions);
  $('#btnFill').addEventListener('click', fillEmptyTiles);

  document.querySelectorAll('.btn-size').forEach(b => {
    b.addEventListener('click', () => resizeCard(Number(b.dataset.size)));
  });

  $('#btnExport').addEventListener('click', exportCard);
  $('#btnExportPhotos').addEventListener('click', exportCollage);
  $('#btnBackup').addEventListener('click', backup);
  $('#btnRestoreLabel').addEventListener('click', () => $('#btnRestore').click());
  $('#btnRestore').addEventListener('change', e => {
    if (e.target.files[0]) restore(e.target.files[0]);
    e.target.value = '';
  });
  $('#btnReset').addEventListener('click', async () => {
    if (!confirm('Clear this card and start over? Photos and notes will be deleted.')) return;
    card = createCard(card.size);
    await saveCard(card, { immediate: true });
    syncHeaderInputs();
    render();
    toast('Fresh card ready');
  });

  // Modal
  $('#btnCloseModal').addEventListener('click', closeEditor);
  $('#btnSaveTile').addEventListener('click', closeEditor);
  $('#tileModal').addEventListener('click', e => {
    if (e.target === $('#tileModal')) closeEditor();
  });
  $('#tileDone').addEventListener('change', () => {
    if ($('#tileDone').checked && !$('#tileDate').value) $('#tileDate').value = todayISO();
    syncDateField();
    commitEditor();
  });
  $('#btnClearTile').addEventListener('click', () => {
    if (activeIndex === null) return;
    card.tiles[activeIndex] = makeTile();
    persist();
    render();
    $('#tileModal').hidden = true;
    activeIndex = null;
    renderSuggestions();
    toast('Tile cleared');
  });

  // Photo controls
  $('#btnPickPhoto').addEventListener('click', () => $('#tilePhoto').click());
  $('#tilePhoto').addEventListener('change', e => {
    if (e.target.files[0] && activeIndex !== null) attachPhoto(activeIndex, e.target.files[0]);
    e.target.value = '';
  });
  $('#btnRemovePhoto').addEventListener('click', () => {
    if (activeIndex === null) return;
    card.tiles[activeIndex].photo = null;
    setPhotoPreview(null);
    persist();
    render();
  });
  const drop = $('#tilePhotoDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && activeIndex !== null) attachPhoto(activeIndex, file);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#tileModal').hidden) closeEditor();
    else if ($('#suggestPanel').classList.contains('open')) openDrawer(false);
  });

  window.addEventListener('beforeunload', () => flushSave());
}

async function init() {
  paintSparkles();
  buildCategorySelect();
  buildCategoryChips();
  const saved = await loadCard();
  card = saved && Array.isArray(saved.tiles) ? saved : createCard(5);
  card.tiles = card.tiles.map(t => makeTile(t));
  syncHeaderInputs();
  render();
  wireEvents();
  if (!saved) persist();
}

init();

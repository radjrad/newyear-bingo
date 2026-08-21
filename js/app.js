/* App controller: card state, rendering, editing, and export wiring. */

const $ = sel => document.querySelector(sel);
const MAX_PHOTO_EDGE = 1400;   // px, longest side after downscale
const PHOTO_QUALITY = 0.85;
const POP_COLORS = ['#ff3b30', '#ffd429', '#00cfd6', '#9b5cff', '#ff4fa3', '#7ed321'];

let card = null;
let activeIndex = null;        // tile currently open in the editor
let activeCategory = 'All';
let drawerTarget = null;       // tile a drawer pick should land on (null = first empty)
let freshStamps = new Set();   // tiles that should play the stamp animation on next render
let stampMode = false;         // stamper button armed: clicks stamp instead of edit

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
    stampRot: randomRotation(),
    ...overrides
  };
}

/* Each stamp sits at its own angle, stored so the PNG matches the screen. */
function randomRotation() {
  return Math.round((Math.random() * 26 - 13) * 10) / 10;
}

function defaultYear() {
  const now = new Date();
  // From November on, people are planning the year ahead.
  return now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
}

function createCard(size = 5) {
  const tiles = Array.from({ length: size * size }, () => makeTile());
  const c = {
    version: 2,
    title: `${defaultYear()} BINGO`,
    subtitle: '',
    size,
    tiles,
    setupCollapsed: false,
    shareCollapsed: false,
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

/* An in-page confirm, because embedded pages block the browser's confirm(). */
function ask(text, okLabel = 'Yes, do it') {
  return new Promise(resolve => {
    const modal = $('#askModal');
    $('#askText').textContent = text;
    $('#askOk').textContent = okLabel;
    modal.hidden = false;

    const done = answer => {
      modal.hidden = true;
      $('#askOk').onclick = null;
      $('#askCancel').onclick = null;
      modal.onclick = null;
      resolve(answer);
    };
    $('#askOk').onclick = () => done(true);
    $('#askCancel').onclick = () => done(false);
    modal.onclick = e => { if (e.target === modal) done(false); };
  });
}

/* Resizes the grid, keeping as much existing content as possible. */
async function resizeCard(newSize) {
  const old = card.size;
  if (newSize === old) return;
  const kept = card.tiles.filter(t => !t.free && (t.text || t.photo));

  // Shrinking can push filled tiles off the card, so confirm before losing them.
  const capacity = newSize * newSize - (newSize % 2 === 1 ? 1 : 0);
  const willDrop = Math.max(0, kept.length - capacity);
  if (willDrop > 0) {
    const ok = await ask(
      `Switching to ${newSize}×${newSize} drops ${willDrop} filled tile${willDrop > 1 ? 's' : ''}, photos and notes included.`,
      `Switch to ${newSize}×${newSize}`);
    if (!ok) {
      render();
      return;
    }
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
  toast(dropped > 0 ? `${newSize}×${newSize}! ${dropped} tile${dropped > 1 ? 's' : ''} didn't fit`
                    : `${newSize}×${newSize} it is!`);
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

const STAMP_SVG =
  '<svg class="stamp" viewBox="0 0 100 100" aria-hidden="true">' +
  '<circle cx="50" cy="50" r="46" fill="#ff3b30"/>' +
  '<circle cx="50" cy="50" r="46" fill="none" stroke="#d81f16" stroke-width="5"/>' +
  '<path fill="#fff" d="M50 16 L60.6 41.4 L88 43.5 L67.1 61.4 L73.5 88 L50 73.6 L26.5 88 L32.9 61.4 L12 43.5 L39.4 41.4 Z"/>' +
  '</svg>';

function render() {
  const grid = $('#grid');
  grid.style.setProperty('--size', card.size);
  grid.dataset.size = card.size;   // lets CSS scale tile type to the column count
  grid.innerHTML = '';
  const highlight = bingoIndexes();

  card.tiles.forEach((tile, i) => {
    const el = document.createElement('button');
    el.className = 'tile';
    el.type = 'button';
    el.dataset.index = i;
    el.setAttribute('role', 'gridcell');
    el.style.setProperty('--rot', `${tile.stampRot || -12}deg`);

    if (tile.free) el.classList.add('free');
    if (tile.done) el.classList.add('done');
    if (tile.photo) el.classList.add('has-photo');
    if (!tile.text && !tile.free) el.classList.add('empty');
    if (highlight.has(i)) el.classList.add('bingo');
    if (freshStamps.has(i)) el.classList.add('just-stamped');

    if (tile.photo) {
      const img = document.createElement('img');
      img.className = 'tile-photo';
      img.src = tile.photo;
      img.alt = '';
      el.appendChild(img);
    }

    if (tile.done) el.insertAdjacentHTML('beforeend', STAMP_SVG);

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

    el.setAttribute('aria-label',
      `${tile.free ? 'Free space' : tile.text || 'Empty tile'}${tile.done ? ', completed' : ''}`);

    // Tap-to-stamp: the tile itself is the stamper; the ✎ badge edits.
    el.addEventListener('click', () => handleTileClick(i));
    if (!tile.free) {
      const edit = document.createElement('span');
      edit.className = 'tile-edit';
      edit.setAttribute('role', 'button');
      edit.setAttribute('tabindex', '0');
      edit.setAttribute('aria-label', 'Edit this tile');
      edit.title = 'Edit this tile';
      edit.textContent = '✎';
      const openIt = e => { e.stopPropagation(); openEditor(i); };
      edit.addEventListener('click', openIt);
      edit.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') openIt(e);
      });
      el.appendChild(edit);
    }
    wireTileDrop(el, i);
    grid.appendChild(el);

    if (freshStamps.has(i)) {
      const splat = document.createElement('span');
      splat.className = 'splat';
      el.appendChild(splat);
      burstConfetti(el);
    }
  });

  freshStamps.clear();

  const s = stats();
  $('#progressText').textContent = `${s.done} of ${s.total}`;
  $('#progressFill').style.width = `${s.total ? (s.done / s.total) * 100 : 0}%`;

  document.querySelectorAll('.btn-size').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === card.size);
  });

  updateSetupSummary();
}

/* Burst of paper bits when a tile gets stamped — squares, dots and stars. */
const STAR_CLIP = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';

function burstConfetti(el) {
  for (let i = 0; i < 18; i++) {
    const bit = document.createElement('span');
    bit.className = 'pop';
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const dist = 30 + Math.random() * 38;
    const size = 7 + Math.random() * 7;
    bit.style.width = `${size}px`;
    bit.style.height = `${size}px`;
    const shape = i % 3;
    if (shape === 0) bit.style.borderRadius = '50%';
    else if (shape === 1) bit.style.clipPath = STAR_CLIP;
    bit.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    bit.style.background = POP_COLORS[i % POP_COLORS.length];
    bit.style.animationDelay = `${Math.random() * 0.1}s`;
    el.appendChild(bit);
    setTimeout(() => bit.remove(), 1000);
  }
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

/* ---------- Accordion panels ---------- */

function setPanel(panelId, collapsed) {
  const panel = $(panelId);
  panel.classList.toggle('collapsed', collapsed);
  panel.querySelector('.panel-head').setAttribute('aria-expanded', String(!collapsed));
}

function syncPanels() {
  setPanel('#setupPanel', !!card.setupCollapsed);
  setPanel('#sharePanel', !!card.shareCollapsed);
}

function updateSetupSummary() {
  const empty = card.tiles.filter(t => !t.free && !t.text).length;
  $('#setupSummary').textContent = empty
    ? `${empty} tile${empty > 1 ? 's' : ''} still empty · ${card.size}×${card.size}`
    : `All filled · ${card.size}×${card.size}`;
}

/* Once every tile has a goal, the setup box has done its job — tuck it away. */
function maybeAutoCollapseSetup() {
  if (card.setupCollapsed) return;
  if (card.tiles.some(t => !t.free && !t.text)) return;
  card.setupCollapsed = true;
  setPanel('#setupPanel', true);
  persist();
  toast('Card is full — setup tucked away 👌');
}

/* ---------- Stamping ---------- */

/* On mouse machines the armed cursor is a life-size dauber element that
   follows the pointer; its ink tip sits exactly on the click point. */
const FINE_POINTER = matchMedia('(pointer: fine)').matches;
const DAUBER_TIP = { x: 75, y: 175 };   // element pixels, matches the CSS note

function moveDauber(e) {
  const d = $('#dauber');
  d.style.transform = `translate(${e.clientX - DAUBER_TIP.x}px, ${e.clientY - DAUBER_TIP.y}px)`;
  // Only show it while hovering the board, so buttons keep a normal cursor.
  d.hidden = !e.target.closest || !e.target.closest('.grid');
}

function pressDauber() {
  const d = $('#dauber');
  if (d.hidden) return;
  d.classList.remove('pressing');
  void d.offsetWidth;               // restart the animation
  d.classList.add('pressing');
}

/* The stamper button arms the board for a stamping spree — tiles jiggle and
   every click stamps. A plain tap on a goal tile stamps it too. */
function setStampMode(on) {
  stampMode = on;
  document.body.classList.toggle('stamping', on);
  const btn = $('#btnStampMode');
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));
  $('#stampModeLabel').textContent = on ? 'Done stamping' : 'Stamp!';
  if (FINE_POINTER) {
    if (on) {
      document.addEventListener('pointermove', moveDauber);
    } else {
      document.removeEventListener('pointermove', moveDauber);
      $('#dauber').hidden = true;
    }
  }
  if (on) toast('Stamp mode! Tap every goal you finished 🔴');
}

function handleTileClick(i) {
  const tile = card.tiles[i];
  if (tile.free) {
    toast('That one is free — it counts automatically 🎁');
    return;
  }
  if (!tile.text) {
    if (stampMode) {
      toast('Nothing to stamp here yet');
    } else {
      openEditor(i);
    }
    return;
  }
  toggleStamp(i);
}

function toggleStamp(i) {
  const tile = card.tiles[i];
  tile.done = !tile.done;
  if (tile.done) {
    tile.doneAt = tile.doneAt || todayISO();
    freshStamps.add(i);
    if (stampMode) pressDauber();
  } else {
    tile.doneAt = '';
  }
  persist();
  render();
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
  // A tile that already has a goal usually brought its category with it —
  // hide the dropdown and keep the editor short.
  $('#catField').style.display = tile.text ? 'none' : '';
  $('#tileDate').value = tile.doneAt || '';
  $('#tileDone').checked = tile.done;
  setPhotoPreview(tile.photo);
  syncDateField();
  $('#tileModal').hidden = false;
  $('#tileModal').querySelector('.modal-card').scrollTop = 0;
  // On touch screens focusing would pop the keyboard over half the sheet
  // before the person has even decided what to change.
  if (!isTouchScreen()) {
    setTimeout(() => $('#tileText').focus({ preventScroll: true }), 30);
  }
}

function closeEditor() {
  commitEditor();
  $('#tileModal').hidden = true;
  activeIndex = null;
  maybeAutoCollapseSetup();
}

/* Pulls the modal fields back into the tile. */
function commitEditor() {
  if (activeIndex === null) return;
  const tile = card.tiles[activeIndex];
  const wasDone = tile.done;
  tile.text = $('#tileText').value.trim();
  tile.category = $('#tileCategory').value;
  tile.done = $('#tileDone').checked;
  tile.doneAt = tile.done ? $('#tileDate').value : '';
  if (tile.done && !wasDone) freshStamps.add(activeIndex);
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
    // A photo is usually proof it happened — offer the stamp automatically.
    if (!tile.done) {
      tile.done = true;
      tile.doneAt = tile.doneAt || todayISO();
      freshStamps.add(index);
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

  const verb = isTouchScreen() ? 'Tap' : 'Click';
  $('#drawerNote').textContent = drawerTarget === null
    ? `${verb} a suggestion to drop it into the first empty tile.`
    : `${verb} a suggestion to use it for the tile you are editing.`;

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
  // When the editor is open the pick belongs to that tile, not the first blank one.
  if (drawerTarget !== null) {
    $('#tileText').value = s.text;
    $('#tileCategory').value = s.category;
    commitEditor();
    openDrawer(false);
    toast('Goal set ✨');
    return;
  }
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
  maybeAutoCollapseSetup();
}

/* Unused suggestions in random order. */
function shuffledPool() {
  const used = usedTexts();
  const pool = allSuggestions().filter(s => !used.has(s.text.toLowerCase()));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function fillEmptyTiles() {
  const empties = card.tiles.map((t, i) => i).filter(i => !card.tiles[i].free && !card.tiles[i].text);
  if (!empties.length) {
    toast('No empty tiles to fill');
    return;
  }
  const pool = shuffledPool();
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
  maybeAutoCollapseSetup();
}

/* Drops one random unused suggestion into the tile being edited. */
function randomiseActiveTile() {
  if (activeIndex === null) return;
  const pick = shuffledPool()[0];
  if (!pick) {
    toast('You have used every suggestion!');
    return;
  }
  $('#tileText').value = pick.text;
  $('#tileCategory').value = pick.category;
  commitEditor();
  toast('Rolled a new goal 🎲');
}

function openDrawer(open) {
  $('#suggestPanel').classList.toggle('open', open);
  $('#suggestPanel').setAttribute('aria-hidden', String(!open));
  $('#drawerScrim').hidden = !open;
  if (open) renderSuggestions();
  else drawerTarget = null;
}

/* ---------- Export / backup ---------- */

let shareBlobUrl = null;

/* Renders the card, then offers it every way a browser might allow:
   the native share sheet, a direct download, or a long-press on the image.
   The picture itself is always shown because embedded viewers (and some
   phone browsers) silently block downloads a page starts on its own. */
async function exportCard() {
  toast('Making your picture…');
  const canvas = await renderCardPNG(card, stats(), bingoIndexes());
  const filename = `${slug(card.title)}.png`;

  canvas.toBlob(async blob => {
    if (!blob) {
      toast('Could not build the picture');
      return;
    }
    if (shareBlobUrl) URL.revokeObjectURL(shareBlobUrl);
    shareBlobUrl = URL.createObjectURL(blob);

    $('#shareImage').src = shareBlobUrl;
    $('#shareModal').hidden = false;

    const file = new File([blob], filename, { type: 'image/png' });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const shareBtn = $('#btnShareNative');
    shareBtn.hidden = !canShare;
    shareBtn.onclick = async () => {
      try {
        await navigator.share({ files: [file], title: card.title || 'My bingo card' });
      } catch (err) {
        if (err && err.name !== 'AbortError') toast('Sharing was blocked — try press and hold');
      }
    };

    // Hosted viewers (claude.ai) block a page's own downloads and hand saving
    // to the platform instead; a plain browser uses a normal download link.
    const hosted = !!(window.claude && typeof window.claude.use === 'function');
    const downloads = hosted ? await window.claude.use('downloads') : null;
    const saveBtn = $('#btnSaveImage');
    saveBtn.hidden = hosted && !downloads;

    saveBtn.onclick = async () => {
      if (downloads) {
        try {
          await downloads.save({ filename, data: blob });
          toast('Saved ✓');
        } catch (err) {
          const code = err && err.code;
          if (code === 'declined') return;
          toast(code === 'too_large'
            ? 'Picture is too big to save — try removing a photo'
            : 'Could not save — press and hold the picture instead');
        }
        return;
      }
      const a = document.createElement('a');
      a.href = shareBlobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Check your Downloads folder 📁');
    };
  }, 'image/png');
}

function closeShare() {
  $('#shareModal').hidden = true;
}

function slug(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'newyear';
}

function backup() {
  const blob = new Blob([JSON.stringify(card)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(card.title)}-backup.json`;
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
      syncPanels();
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

/* Scattered Memphis-style geometry: discs, rings, triangles, bars, crosses,
   half-discs, checkerboards, squiggles and zigzags. */
const CONFETTI_SHAPES = [
  'c-dot', 'c-ring', 'c-tri', 'c-bar', 'c-plus',
  'c-half', 'c-quarter', 'c-check', 'c-diamond', 'squiggle', 'zigzag'
];

function squiggleSVG(color, w) {
  const h = w * 0.42;
  return `<svg width="${w}" height="${h}" viewBox="0 0 100 42" fill="none">` +
    `<path d="M2 21 C 14 -3, 26 45, 38 21 S 62 -3, 74 21 S 92 45, 98 21" ` +
    `stroke="${color}" stroke-width="9" stroke-linecap="round"/></svg>`;
}

function zigzagSVG(color, w) {
  const h = w * 0.4;
  return `<svg width="${w}" height="${h}" viewBox="0 0 100 40" fill="none">` +
    `<path d="M3 30 L 20 10 L 37 30 L 54 10 L 71 30 L 88 10 L 97 22" ` +
    `stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function isTouchScreen() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function paintConfetti() {
  const wrap = $('.confetti');
  const colors = POP_COLORS.concat(['#ffffff', '#ffb400', '#2bd9c8']);
  const frag = document.createDocumentFragment();

  // Phones get a lighter shower — 78 animated bits make older ones stutter.
  const bits = window.matchMedia('(max-width: 640px)').matches ? 42 : 78;
  for (let i = 0; i < bits; i++) {
    const bit = document.createElement('i');
    const shape = CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 14 + Math.random() * 40;

    bit.style.color = color;
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.top = `${Math.random() * 100}%`;
    bit.style.opacity = String(0.28 + Math.random() * 0.42);
    bit.style.animationDelay = `${Math.random() * 11}s`;
    bit.style.animationDuration = `${8 + Math.random() * 7}s`;
    bit.style.setProperty('--spin', `${Math.round(Math.random() * 360)}deg`);
    bit.style.transform = `rotate(${Math.round(Math.random() * 360)}deg)`;

    if (shape === 'squiggle' || shape === 'zigzag') {
      const w = size * 2.2;
      bit.innerHTML = shape === 'squiggle' ? squiggleSVG(color, w) : zigzagSVG(color, w);
    } else {
      bit.className = shape;
      bit.style.width = `${size}px`;
      bit.style.height = `${shape === 'c-bar' ? Math.max(6, size * 0.28) : size}px`;
      // Outline shapes paint with currentColor; solid ones need a background.
      if (!['c-ring', 'c-tri', 'c-plus', 'c-check'].includes(shape)) {
        bit.style.background = color;
      }
      if (shape === 'c-diamond') bit.style.transform += ' rotate(45deg)';
    }
    frag.appendChild(bit);
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

  $('#setupHead').addEventListener('click', () => {
    card.setupCollapsed = !card.setupCollapsed;
    setPanel('#setupPanel', card.setupCollapsed);
    persist();
  });
  $('#shareHead').addEventListener('click', () => {
    card.shareCollapsed = !card.shareCollapsed;
    setPanel('#sharePanel', card.shareCollapsed);
    persist();
  });

  $('#btnStampMode').addEventListener('click', () => setStampMode(!stampMode));

  $('#btnSuggestions').addEventListener('click', () => {
    drawerTarget = null;
    openDrawer(true);
  });
  $('#btnCloseSuggest').addEventListener('click', () => openDrawer(false));
  $('#drawerScrim').addEventListener('click', () => openDrawer(false));
  $('#suggestSearch').addEventListener('input', renderSuggestions);
  $('#btnFill').addEventListener('click', fillEmptyTiles);

  document.querySelectorAll('.btn-size').forEach(b => {
    b.addEventListener('click', () => resizeCard(Number(b.dataset.size)));
  });

  $('#btnExport').addEventListener('click', exportCard);
  $('#btnBackup').addEventListener('click', backup);
  $('#btnRestoreLabel').addEventListener('click', () => $('#btnRestore').click());
  $('#btnRestore').addEventListener('change', e => {
    if (e.target.files[0]) restore(e.target.files[0]);
    e.target.value = '';
  });
  $('#btnReset').addEventListener('click', async () => {
    const ok = await ask('This clears the whole card and starts over. Your goals, photos and notes will be deleted.',
                         'Yes, clear it');
    if (!ok) return;
    card = createCard(card.size);
    await saveCard(card, { immediate: true });
    syncHeaderInputs();
    syncPanels();
    render();
    toast('Fresh card ready');
  });

  // Modal
  $('#btnCloseModal').addEventListener('click', closeEditor);
  $('#btnSaveTile').addEventListener('click', closeEditor);
  $('#tileModal').addEventListener('click', e => {
    if (e.target === $('#tileModal')) closeEditor();
  });
  $('#btnTileSuggest').addEventListener('click', () => {
    drawerTarget = activeIndex;
    openDrawer(true);
  });
  $('#btnTileRandom').addEventListener('click', randomiseActiveTile);
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

  $('#btnCloseShare').addEventListener('click', closeShare);
  $('#shareModal').addEventListener('click', e => {
    if (e.target === $('#shareModal')) closeShare();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#askModal').hidden) $('#askCancel').click();
    else if (!$('#shareModal').hidden) closeShare();
    else if ($('#suggestPanel').classList.contains('open')) openDrawer(false);
    else if (!$('#tileModal').hidden) closeEditor();
    else if (stampMode) setStampMode(false);
  });

  window.addEventListener('beforeunload', () => flushSave());
}

/* storage.js calls this when a save fails — usually localStorage filling up
   with photos on a copy opened straight from the filesystem. */
function onStorageError(err) {
  const full = err && /quota/i.test(err.name + ' ' + err.message);
  toast(full
    ? 'Storage is full — remove a photo, or use Backup to save your card'
    : 'Could not save — use Backup to keep your card safe');
}

async function init() {
  paintConfetti();
  buildCategorySelect();
  buildCategoryChips();
  const saved = await loadCard();
  card = saved && Array.isArray(saved.tiles) ? saved : createCard(5);
  card.tiles = card.tiles.map(t => makeTile(t));
  // The subtitle is now the owner's name; clear the old stock tagline.
  if (card.subtitle === 'A year worth checking off') card.subtitle = '';
  syncHeaderInputs();
  syncPanels();
  render();
  wireEvents();
  if (!saved) persist();
}

init();

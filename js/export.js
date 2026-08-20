/* Canvas renderers that turn a card into shareable PNGs. */

const FONT_STACK = '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif';

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

/* Greedy word wrap; returns the lines that fit within maxLines. */
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.length) {
    // Ellipsize if we ran out of room mid-sentence.
    const joined = lines.join(' ');
    if (joined.split(/\s+/).length < words.length) {
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = last + '…';
    }
  }
  return lines;
}

/* Draws an image cropped to fill the destination box (CSS object-fit: cover). */
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function paintBackdrop(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#161042');
  bg.addColorStop(0.5, '#0a0e23');
  bg.addColorStop(1, '#0b2440');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.18, 0, 0, w * 0.18, 0, w * 0.7);
  glow.addColorStop(0, 'rgba(120, 90, 255, 0.22)');
  glow.addColorStop(1, 'rgba(120, 90, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}`;
}

/* ---------- Bingo card PNG ---------- */
async function renderCardPNG(card, stats, bingoSet = new Set()) {
  const size = card.size;
  const cell = 250;
  const gap = 14;
  const pad = 46;
  const gridSide = size * cell + (size - 1) * gap;
  const headerH = 190;
  const footerH = 92;
  const W = gridSide + pad * 2;
  const H = headerH + gridSide + footerH + pad;

  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.textBaseline = 'top';

  paintBackdrop(ctx, W, H);

  // Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4c95d';
  ctx.font = `800 54px ${FONT_STACK}`;
  ctx.fillText(card.title || 'New Year Bingo', W / 2, pad + 6, W - pad * 2);

  if (card.subtitle) {
    ctx.fillStyle = '#9aa3ca';
    ctx.font = `500 21px ${FONT_STACK}`;
    ctx.fillText(card.subtitle, W / 2, pad + 72, W - pad * 2);
  }

  // Progress bar under the header
  const barW = Math.min(520, gridSide);
  const barX = (W - barW) / 2;
  const barY = pad + 116;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, barX, barY, barW, 12, 6);
  ctx.fill();
  const pct = stats.total ? stats.done / stats.total : 0;
  if (pct > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#d99e2b');
    grad.addColorStop(0.6, '#f4c95d');
    grad.addColorStop(1, '#5ce0b0');
    ctx.fillStyle = grad;
    roundRect(ctx, barX, barY, Math.max(12, barW * pct), 12, 6);
    ctx.fill();
  }
  ctx.fillStyle = '#eef1ff';
  ctx.font = `700 19px ${FONT_STACK}`;
  const bingoLabel = stats.bingos === 1 ? '1 bingo' : `${stats.bingos} bingos`;
  ctx.fillText(`${stats.done} of ${stats.total} complete  ·  ${bingoLabel}`, W / 2, barY + 26);

  // Tiles
  const gridTop = headerH + pad * 0.4;
  const images = await Promise.all(card.tiles.map(t => loadImage(t.photo)));

  card.tiles.forEach((tile, i) => {
    const col = i % size;
    const row = Math.floor(i / size);
    const x = pad + col * (cell + gap);
    const y = gridTop + row * (cell + gap);
    const img = images[i];
    const isFree = tile.free;
    const empty = !tile.text && !isFree;

    ctx.save();
    roundRect(ctx, x, y, cell, cell, 18);
    ctx.clip();

    // Base fill
    if (isFree) {
      ctx.fillStyle = 'rgba(244,201,93,0.18)';
    } else if (empty) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
    } else {
      const g = ctx.createLinearGradient(x, y, x + cell, y + cell);
      g.addColorStop(0, '#1c2450');
      g.addColorStop(1, '#131936');
      ctx.fillStyle = g;
    }
    ctx.fillRect(x, y, cell, cell);

    if (img) {
      ctx.globalAlpha = 0.88;
      drawCover(ctx, img, x, y, cell, cell);
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, y, 0, y + cell);
      shade.addColorStop(0, 'rgba(6,9,26,0.18)');
      shade.addColorStop(0.45, 'rgba(6,9,26,0.5)');
      shade.addColorStop(1, 'rgba(6,9,26,0.86)');
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, cell, cell);
    }
    ctx.restore();

    // Border — gold for tiles sitting on a completed line
    const inLine = bingoSet.has(i);
    ctx.lineWidth = inLine ? 4 : tile.done ? 3 : 1.5;
    ctx.strokeStyle = inLine ? '#f4c95d'
      : tile.done ? 'rgba(92,224,176,0.75)'
      : isFree ? 'rgba(244,201,93,0.5)'
      : 'rgba(255,255,255,0.14)';
    roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, 16);
    ctx.stroke();

    // Text block
    const inner = cell - 34;
    ctx.textAlign = 'center';
    const label = isFree ? 'FREE' : (tile.text || '');
    ctx.font = isFree ? `800 30px ${FONT_STACK}` : `600 21px ${FONT_STACK}`;
    const lines = wrapLines(ctx, label, inner, 5);
    const lineH = isFree ? 34 : 27;
    const hasMeta = !!(tile.category && !isFree) ;
    const blockH = lines.length * lineH + (hasMeta ? 22 : 0) + (tile.doneAt ? 22 : 0);
    let ty = y + (cell - blockH) / 2;

    if (hasMeta) {
      ctx.fillStyle = 'rgba(154,163,202,0.9)';
      ctx.font = `700 12px ${FONT_STACK}`;
      ctx.fillText(tile.category.toUpperCase(), x + cell / 2, ty);
      ty += 22;
      ctx.font = `600 21px ${FONT_STACK}`;
    }

    ctx.fillStyle = isFree ? '#f4c95d' : tile.done ? '#dffaef' : '#eef1ff';
    if (img) {
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 8;
    }
    for (const line of lines) {
      ctx.fillText(line, x + cell / 2, ty);
      ty += lineH;
    }
    ctx.shadowBlur = 0;

    if (tile.doneAt) {
      ctx.fillStyle = '#5ce0b0';
      ctx.font = `700 14px ${FONT_STACK}`;
      ctx.fillText(formatDate(tile.doneAt), x + cell / 2, ty + 2);
    }

    // Completion stamp
    if (tile.done) {
      const cx = x + cell - 30;
      const cy = y + 30;
      ctx.beginPath();
      ctx.arc(cx, cy, 17, 0, Math.PI * 2);
      ctx.fillStyle = '#5ce0b0';
      ctx.fill();
      ctx.strokeStyle = '#04301f';
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy);
      ctx.lineTo(cx - 2, cy + 6);
      ctx.lineTo(cx + 8, cy - 6);
      ctx.stroke();
    }
  });

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(154,163,202,0.85)';
  ctx.font = `500 16px ${FONT_STACK}`;
  ctx.fillText(stats.caption, W / 2, gridTop + gridSide + 34);

  return canvas;
}

/* ---------- Photo collage PNG ---------- */
async function renderCollagePNG(card, stats) {
  const entries = card.tiles.filter(t => t.photo);
  if (!entries.length) return null;

  const cols = Math.min(4, Math.ceil(Math.sqrt(entries.length)));
  const rows = Math.ceil(entries.length / cols);
  const cellW = 400;
  const photoH = 300;
  const captionH = 96;
  const cellH = photoH + captionH;
  const gap = 16;
  const pad = 46;
  const headerH = 150;
  const W = cols * cellW + (cols - 1) * gap + pad * 2;
  const H = headerH + rows * cellH + (rows - 1) * gap + pad;

  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.textBaseline = 'top';

  paintBackdrop(ctx, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4c95d';
  ctx.font = `800 46px ${FONT_STACK}`;
  ctx.fillText(card.title || 'New Year Bingo', W / 2, pad, W - pad * 2);
  ctx.fillStyle = '#9aa3ca';
  ctx.font = `500 19px ${FONT_STACK}`;
  ctx.fillText(stats.caption, W / 2, pad + 60, W - pad * 2);

  const images = await Promise.all(entries.map(t => loadImage(t.photo)));

  entries.forEach((tile, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * (cellW + gap);
    const y = headerH + row * (cellH + gap);

    ctx.save();
    roundRect(ctx, x, y, cellW, cellH, 16);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, cellW, cellH);
    const img = images[i];
    if (img) drawCover(ctx, img, x, y, cellW, photoH);
    ctx.restore();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = tile.done ? 'rgba(92,224,176,0.6)' : 'rgba(255,255,255,0.14)';
    roundRect(ctx, x + 1, y + 1, cellW - 2, cellH - 2, 15);
    ctx.stroke();

    // Caption block
    ctx.textAlign = 'left';
    let ty = y + photoH + 16;
    const inner = cellW - 36;

    ctx.fillStyle = '#eef1ff';
    ctx.font = `700 18px ${FONT_STACK}`;
    for (const line of wrapLines(ctx, tile.text, inner, 2)) {
      ctx.fillText(line, x + 18, ty);
      ty += 23;
    }

    const meta = [tile.done ? '✓ Done' : 'In progress', formatDate(tile.doneAt)].filter(Boolean).join('  ·  ');
    ctx.fillStyle = tile.done ? '#5ce0b0' : '#9aa3ca';
    ctx.font = `600 13px ${FONT_STACK}`;
    ctx.fillText(meta, x + 18, ty + 2);
    ty += 22;

    if (tile.note) {
      ctx.fillStyle = 'rgba(238,241,255,0.72)';
      ctx.font = `400 13.5px ${FONT_STACK}`;
      for (const line of wrapLines(ctx, tile.note, inner, 1)) {
        ctx.fillText(line, x + 18, ty);
      }
    }
  });

  return canvas;
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

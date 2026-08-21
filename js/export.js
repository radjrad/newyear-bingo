/* Canvas renderer that turns a card into a shareable PNG. */

const FONT_FUN = '"Poppins", "Avenir Next", "Futura", "Century Gothic", "Segoe UI", sans-serif';
const FONT_UI = '"Poppins", "Avenir Next", "Futura", "Segoe UI", system-ui, sans-serif';

const NAVY = '#16267a';
const NAVY_2 = '#0e1a5c';
const YELLOW = '#ffd429';
const RED = '#ff3b30';
const RED_2 = '#d81f16';
const PURPLE = '#6d33d6';
const LIME = '#7ed321';

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

/* Bright gradient plus scattered 90s shapes, seeded so it never re-rolls. */
function paintBackdrop(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#29d3e6');
  bg.addColorStop(0.46, '#4f8bff');
  bg.addColorStop(1, '#9b5cff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const warm = ctx.createRadialGradient(w * 0.12, 0, 0, w * 0.12, 0, w * 0.6);
  warm.addColorStop(0, 'rgba(255, 227, 110, 0.75)');
  warm.addColorStop(1, 'rgba(255, 227, 110, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);

  const pink = ctx.createRadialGradient(w * 0.94, h * 0.04, 0, w * 0.94, h * 0.04, w * 0.55);
  pink.addColorStop(0, 'rgba(255, 126, 196, 0.7)');
  pink.addColorStop(1, 'rgba(255, 126, 196, 0)');
  ctx.fillStyle = pink;
  ctx.fillRect(0, 0, w, h);

  const colors = ['#ff3b30', '#ffd429', '#00cfd6', '#9b5cff', '#ff4fa3', '#ffffff', '#ffb400', '#2bd9c8'];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  ctx.save();
  for (let i = 0; i < 190; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const c = colors[Math.floor(rand() * colors.length)];
    const kind = Math.floor(rand() * 9);
    const s = 16 + rand() * 52;
    ctx.globalAlpha = 0.26 + rand() * 0.32;
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);

    if (kind === 0) {                                   // disc
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 1) {                            // ring
      ctx.lineWidth = Math.max(4, s * 0.16);
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 2) {                            // triangle
      ctx.beginPath();
      ctx.moveTo(0, -s / 2);
      ctx.lineTo(s / 2, s / 2);
      ctx.lineTo(-s / 2, s / 2);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 3) {                            // bar
      ctx.fillRect(-s / 2, -s * 0.13, s, s * 0.26);
    } else if (kind === 4) {                            // cross
      const t = s * 0.24;
      ctx.fillRect(-t / 2, -s / 2, t, s);
      ctx.fillRect(-s / 2, -t / 2, s, t);
    } else if (kind === 5) {                            // half disc
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 6) {                            // checkerboard
      const q = s / 2;
      ctx.fillRect(-q, -q, q, q);
      ctx.fillRect(0, 0, q, q);
    } else if (kind === 7) {                            // squiggle
      ctx.lineWidth = Math.max(5, s * 0.17);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.bezierCurveTo(-s * 0.6, -s * 0.75, -s * 0.15, s * 0.75, 0, 0);
      ctx.bezierCurveTo(s * 0.15, -s * 0.75, s * 0.6, s * 0.75, s, 0);
      ctx.stroke();
    } else {                                            // zigzag
      ctx.lineWidth = Math.max(5, s * 0.17);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.3);
      ctx.lineTo(-s * 0.5, -s * 0.3);
      ctx.lineTo(0, s * 0.3);
      ctx.lineTo(s * 0.5, -s * 0.3);
      ctx.lineTo(s, s * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/* Yellow bubble letters: red drop, navy outline, yellow fill. */
function drawBubbleText(ctx, text, x, y, fontPx) {
  ctx.font = `700 ${fontPx}px ${FONT_FUN}`;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  ctx.fillStyle = RED_2;
  ctx.fillText(text, x, y + fontPx * 0.13);
  ctx.fillStyle = RED;
  ctx.fillText(text, x, y + fontPx * 0.1);

  ctx.strokeStyle = NAVY;
  ctx.lineWidth = fontPx * 0.17;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = YELLOW;
  ctx.fillText(text, x, y);
}

/* The red dauber, drawn at the tile's own stored angle. */
function drawStamp(ctx, cx, cy, size, rotationDeg, alpha = 0.75) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  const s = size / 100;
  ctx.scale(s, s);

  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = RED_2;
  ctx.stroke();

  const pts = [
    [0, -34], [10.6, -8.6], [38, -6.5], [17.1, 11.4], [23.5, 38],
    [0, 23.6], [-23.5, 38], [-17.1, 11.4], [-38, -6.5], [-10.6, -8.6]
  ];
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
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
  const gap = 12;
  const pad = 44;
  const gridSide = size * cell + (size - 1) * gap;
  const boardPad = 20;
  const headerH = 244;   // must clear the score line under the progress bar
  const footerH = 96;
  const W = gridSide + boardPad * 2 + pad * 2;
  const H = headerH + gridSide + boardPad * 2 + footerH;

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
  drawBubbleText(ctx, (card.title || 'NEW YEAR BINGO').toUpperCase(), W / 2, pad - 6, 62);

  if (card.subtitle) {
    const subY = pad + 74;
    ctx.font = `700 21px ${FONT_FUN}`;
    const tw = ctx.measureText(card.subtitle).width;
    ctx.fillStyle = 'rgba(22, 38, 122, 0.55)';
    roundRect(ctx, W / 2 - tw / 2 - 18, subY - 6, tw + 36, 36, 18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(card.subtitle, W / 2, subY);
  }

  // Scoreboard bar
  const barW = Math.min(560, gridSide);
  const barX = (W - barW) / 2;
  const barY = pad + 124;
  const barH = 24;
  ctx.fillStyle = '#fff';
  roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fill();
  const pct = stats.total ? stats.done / stats.total : 0;
  if (pct > 0) {
    ctx.save();
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.clip();
    ctx.fillStyle = LIME;
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 8;
    for (let sx = barX - barH; sx < barX + barW * pct; sx += 16) {
      ctx.beginPath();
      ctx.moveTo(sx, barY + barH);
      ctx.lineTo(sx + barH, barY);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = NAVY;
  roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = `700 19px ${FONT_FUN}`;
  const bingoLabel = stats.bingos === 1 ? '1 BINGO! 🎉' : `${stats.bingos} BINGOS! 🎉`;
  const scoreLine = stats.bingos
    ? `${stats.done} of ${stats.total} complete  ·  ${bingoLabel}`
    : `${stats.done} of ${stats.total} complete`;
  ctx.save();
  ctx.shadowColor = 'rgba(14, 26, 92, 0.85)';
  ctx.shadowOffsetY = 2;
  ctx.fillText(scoreLine, W / 2, barY + barH + 12);
  ctx.restore();

  // Board panel
  const boardX = pad;
  const boardY = headerH;
  const boardW = gridSide + boardPad * 2;
  const boardH = gridSide + boardPad * 2;
  ctx.fillStyle = NAVY_2;
  roundRect(ctx, boardX, boardY + 8, boardW, boardH, 22);
  ctx.fill();
  ctx.fillStyle = '#fff';
  roundRect(ctx, boardX, boardY, boardW, boardH, 22);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = NAVY;
  roundRect(ctx, boardX + 3, boardY + 3, boardW - 6, boardH - 6, 20);
  ctx.stroke();

  // Tiles
  const gridTop = boardY + boardPad;
  const gridLeft = boardX + boardPad;
  const images = await Promise.all(card.tiles.map(t => loadImage(t.photo)));

  card.tiles.forEach((tile, i) => {
    const col = i % size;
    const row = Math.floor(i / size);
    const x = gridLeft + col * (cell + gap);
    const y = gridTop + row * (cell + gap);
    const img = images[i];
    const isFree = tile.free;
    const empty = !tile.text && !isFree;
    const inLine = bingoSet.has(i);

    ctx.save();
    roundRect(ctx, x, y, cell, cell, 14);
    ctx.clip();

    ctx.fillStyle = empty ? '#f2f5ff' : (isFree || inLine) ? '#fff3bd' : '#ffffff';
    ctx.fillRect(x, y, cell, cell);

    if (isFree) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 212, 41, 0.55)';
      ctx.lineWidth = 10;
      for (let s = -cell; s < cell * 2; s += 20) {
        ctx.beginPath();
        ctx.moveTo(x + s, y);
        ctx.lineTo(x + s - cell, y + cell);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (img) {
      // Keep the photo nearly full strength — only a light wash for text.
      drawCover(ctx, img, x, y, cell, cell);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(x, y, cell, cell);
    }
    ctx.restore();

    if (tile.done) {
      // Ghost the stamp on photo tiles so the picture stays the hero.
      drawStamp(ctx, x + cell / 2, y + cell / 2, cell * 0.76, tile.stampRot || -12,
                img ? 0.4 : 0.75);
    }

    // Border
    ctx.lineWidth = inLine ? 5 : 3;
    ctx.strokeStyle = inLine ? RED : NAVY;
    roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, 13);
    ctx.stroke();

    // Text block
    const inner = cell - 30;
    ctx.textAlign = 'center';
    const label = isFree ? 'FREE' : (tile.text || '');
    ctx.font = isFree ? `800 46px ${FONT_FUN}` : `700 26px ${FONT_FUN}`;
    const lines = wrapLines(ctx, label, inner, 5);
    const lineH = isFree ? 50 : 33;
    const hasCat = !!(tile.category && !isFree);
    const blockH = lines.length * lineH + (hasCat ? 24 : 0) + (tile.doneAt ? 26 : 0);
    let ty = y + (cell - blockH) / 2;

    // Over a photo or the red stamp, outline the text in white first — a hard
    // stroke rather than a blurred shadow, so the letters stay sharp.
    const needsHalo = !!img || tile.done;
    const stamped = (text, cx2, cy2) => {
      if (needsHalo) {
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(text, cx2, cy2);
        ctx.restore();
      }
      ctx.fillText(text, cx2, cy2);
    };

    if (hasCat) {
      ctx.fillStyle = PURPLE;
      ctx.font = `700 14px ${FONT_UI}`;
      stamped(tile.category.toUpperCase(), x + cell / 2, ty);
      ty += 24;
    }

    ctx.fillStyle = isFree ? RED_2 : NAVY;
    ctx.font = isFree ? `800 46px ${FONT_FUN}` : `700 26px ${FONT_FUN}`;
    for (const line of lines) {
      stamped(line, x + cell / 2, ty);
      ty += lineH;
    }

    if (tile.doneAt) {
      ctx.fillStyle = RED_2;
      ctx.font = `700 18px ${FONT_FUN}`;
      stamped(formatDate(tile.doneAt), x + cell / 2, ty + 2);
    }
  });

  // Footer credit — the score already sits under the progress bar up top.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `600 17px ${FONT_UI}`;
  ctx.save();
  ctx.shadowColor = 'rgba(14, 26, 92, 0.8)';
  ctx.shadowOffsetY = 2;
  ctx.fillText('Created by: Jared B. Fries, 2026.', W / 2, boardY + boardH + 32);
  ctx.restore();

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

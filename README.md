# New Year's Bingo

A bingo card for your year: pick goals, check them off, attach the photo that
proves it, and export the whole thing as a shareable PNG.

No build step, no dependencies, no accounts. Everything lives in your browser.

**Play it here: <https://radjrad.github.io/newyear-bingo/>**

Served by GitHub Pages from `main`, so anything merged there is live within a
minute or two.

## Running it locally

From the project directory:

```bash
python3 serve.py
```

Then open <http://localhost:8420>. To use a different port, pass it as an
argument — `python3 serve.py 9000`.

A local server is required rather than double-clicking `index.html`, because
browsers block IndexedDB (where your photos are stored) on `file://` URLs.

## What it does

The controls sit in two collapsible boxes above the card.

**Box 1 — Set up your card**

- **Suggestions** — 80 starter goals across 8 categories. Search or filter by
  category, click one to drop it into the first empty tile. Goals already on the
  card are marked "on card" so you don't duplicate them.
- **Fill empty tiles** — shuffles suggestions into every blank tile at once.
- **Grid size** — 3×3, 4×4, or 5×5. Odd sizes get a free centre square.
  Shrinking asks first if it would push filled tiles off the card.

This box collapses itself once every tile has a goal, since its job is done.
Clicking the header opens or closes either box by hand, and the state is saved.

**Box 2 — Save & share** holds Download card PNG, Backup, Restore, and Reset.

**On the card itself**

- **Custom tiles** — click any tile to write your own goal and tag a category.
  The editor also has ✨ Suggestions (picks land on *that* tile) and 🎲 Random
  (rolls one unused suggestion straight into the field).
- **Stamping** — ticking "Stamp it done!" slams a translucent red dauber onto
  the tile with a bounce and a confetti pop. The stamp sits *behind* the goal
  text, and the text carries a white halo, so the tile stays readable. Each
  tile's stamp gets its own slight rotation, stored with the card so the
  downloaded PNG matches the screen.
- **Photos** — drag an image onto a tile, or use the file picker in the editor.
  Adding a photo stamps the tile and dates it automatically. Photos are
  downscaled to 1400px and re-encoded as JPEG so a card of 25 phone photos
  stays a reasonable size.
- **Progress** — completed count, a striped progress bar, and live bingo
  detection (rows, columns, both diagonals). Tiles on a completed line turn
  yellow with a red border.

## Sharing

**Download Bingo Card** renders the whole card at 2× resolution — block-letter
title, photos showing through their tiles, red stamps at their real angles,
dates, and your score line. The picture opens in a panel with a Save button,
a native Share button on phones that support it, and instructions to press and
hold (or right-click) the image. That covers every case, because embedded
viewers and some phone browsers block downloads a page starts by itself.

## Giving it to someone else

`python3 build.py` bundles the whole app — markup, styles, scripts — into two
single self-contained files in `share/`:

| File | Use |
| --- | --- |
| `share/newyear-bingo.html` | Send over WhatsApp, email, or AirDrop. Opens by double-clicking; no server and no internet needed. |
| `share/artifact.html` | The same page as a fragment, ready to publish as a web page anyone can open with a link. |

Re-run `build.py` after editing anything in `css/` or `js/`, or the copies in
`share/` go stale.

Storage adapts to how the page was opened: IndexedDB when it's served over
`http://`, and localStorage when it's opened straight off the filesystem, where
browsers block IndexedDB. localStorage caps out around 5MB, so a file-opened
copy warns instead of failing silently if photos overflow it.

Everyone who opens the page gets their own card in their own browser — there's
no shared server. To send a card back, download the picture and share that.

## Backup

`Backup` writes a JSON file containing the whole card, photos included.
`Restore` reads it back. Use it to move a card between browsers or machines —
the browser's own storage is per-device and can be cleared by the browser.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Markup and layout |
| `css/styles.css` | 90s theme, grid, stamp animation, drawer, modal, responsive rules |
| `js/suggestions.js` | The suggestion library, grouped by category |
| `js/storage.js` | IndexedDB read/write with debounced saves |
| `js/export.js` | Canvas renderer for the card PNG |
| `js/app.js` | State, rendering, editing, and event wiring |
| `serve.py` | Tiny static server for local use |
| `build.py` | Bundles everything into the single files in `share/` |

## Notes

- Storage is per-browser and per-device. There's no sync — that's what Backup
  is for.
- Photos never leave your machine; nothing is uploaded anywhere.

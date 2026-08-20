# New Year's Bingo

A bingo card for your year: pick goals, check them off, attach the photo that
proves it, and export the whole thing as a shareable PNG.

No build step, no dependencies, no accounts. Everything lives in your browser.

## Running it

From the project directory:

```bash
python3 serve.py
```

Then open <http://localhost:8420>. To use a different port, pass it as an
argument — `python3 serve.py 9000`.

A local server is required rather than double-clicking `index.html`, because
browsers block IndexedDB (where your photos are stored) on `file://` URLs.

## What it does

- **Suggestions** — 80 starter goals across 8 categories. Search or filter by
  category, click one to drop it into the first empty tile. Goals already on the
  card are marked "on card" so you don't duplicate them.
- **Fill empty tiles** — shuffles suggestions into every blank tile at once.
- **Custom tiles** — click any tile to write your own goal and tag a category.
- **Photos** — drag an image onto a tile, or use the file picker in the editor.
  Adding a photo checks the tile off and dates it automatically. Photos are
  downscaled to 1400px and re-encoded as JPEG so a card of 25 phone photos
  stays a reasonable size.
- **Progress** — completed count, a progress bar, and live bingo detection
  (rows, columns, both diagonals). Tiles on a completed line get a gold ring.
- **Grid size** — 3×3, 4×4, or 5×5. Odd sizes get a free centre square.
  Shrinking asks first if it would push filled tiles off the card.

## Sharing

- **Download card PNG** — the full card at 2× resolution, with photos showing
  through each completed tile, check stamps, dates, and your progress line.
- **Photo collage PNG** — every tile that has a photo, laid out in a grid with
  its goal, completion date, and note underneath.

Both are plain PNGs, so they drop straight into Instagram, a group chat, or a
text message.

## Backup

`Backup` writes a JSON file containing the whole card, photos included.
`Restore` reads it back. Use it to move a card between browsers or machines —
the browser's own storage is per-device and can be cleared by the browser.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Markup and layout |
| `css/styles.css` | Theme, grid, drawer, modal, responsive rules |
| `js/suggestions.js` | The suggestion library, grouped by category |
| `js/storage.js` | IndexedDB read/write with debounced saves |
| `js/export.js` | Canvas renderers for both PNGs |
| `js/app.js` | State, rendering, editing, and event wiring |
| `serve.py` | Tiny static server for local use |

## Notes

- Storage is per-browser and per-device. There's no sync — that's what Backup
  is for.
- Photos never leave your machine; nothing is uploaded anywhere.

# Grocery Companion v0.2.3

A reliability-first local web app for planning and shopping Walmart and Sam's Club grocery trips.

## Included in this release

- Separate Walmart and Sam's Club trip profiles
- Budget and projected total tracking
- Screenshot-to-list import for Walmart and Sam's Club carts
- Multi-screenshot OCR with overlap deduplication
- Mandatory import review before list changes
- Add/edit/delete grocery items
- Quantity and unit-price math
- Category suggestions with local item memory
- Editable store-route ordering
- Shopping mode with large one-tap completion controls
- Picked-up and remaining-dollar totals
- Completed-trip history
- Optional actual checkout total
- Local JSON backup export/import
- Local-only browser storage
- Installable PWA/offline shell after first successful load

## Screenshot import

V0.2.3 keeps screenshot import a primary planning workflow. Select one or more Walmart or Sam's Club cart screenshots and the app runs OCR in the browser, uses the on-screen product layout to associate names with the right-side current price, verifies the price column in a separate OCR pass, removes likely duplicates caused by overlapping screenshots, and opens a mandatory review screen before saving anything.

This release specifically tightens Walmart screenshot parsing so unit prices, crossed-out old prices, savings amounts, header text, and quantity metadata are not imported as separate grocery items.

The first OCR run needs an internet connection to load the browser OCR engine. If OCR fails, the current trip is left unchanged. Manual entry and the paste importer remain available as fallbacks.

Supported paste formats include one item per line:

- `Milk | 2 | 3.48`
- `Bananas | 1 | 2.16`
- `Paper Towels - $18.98`

Every pasted import is shown in a review screen before it is saved.

## Deploy to GitHub Pages

Upload these files to the root of a GitHub repository:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `sw.js`
- `icon.svg`
- `icon-180.png`
- `icon-512.png`

Then enable GitHub Pages for the repository branch/folder containing the files.

## Data note

The app stores its data in the browser's localStorage. Use **Settings → Export backup** before clearing browser data or moving to another device.



## v0.2.3 iPhone OCR reliability fix

- Added a same-origin OCR bridge through the app service worker for iPhone Safari/WebKit.
- The OCR worker, WebAssembly core loader, and English traineddata are now requested from Grocery Companion's own origin; the service worker retrieves pinned upstream assets and caches them locally.
- The Tesseract worker no longer depends on a cross-origin `importScripts()` call on the primary iPhone path.
- Uses the smaller Tesseract English `4.0.0_best_int` language model first, reducing first-run transfer and memory pressure.
- Retains direct CDN fallbacks if the same-origin bridge cannot initialize.
- OCR assets are cached after the first successful import so later imports do not need to download them again unless app data/site storage is cleared or the OCR version changes.
- Trip data is still not changed until the import review is confirmed.

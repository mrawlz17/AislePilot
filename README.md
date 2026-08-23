# Grocery Companion v0.2.1

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

V0.2.1 makes screenshot import a primary planning workflow. Select one or more Walmart or Sam's Club cart screenshots and the app runs OCR in the browser, uses the on-screen product layout to associate names with the right-side current price, verifies the price column in a separate OCR pass, removes likely duplicates caused by overlapping screenshots, and opens a mandatory review screen before saving anything.

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

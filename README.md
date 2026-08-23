# Grocery Companion v0.1.0

A reliability-first local web app for planning and shopping Walmart and Sam's Club grocery trips.

## Included in this release

- Separate Walmart and Sam's Club trip profiles
- Budget and projected total tracking
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

## Import status

V0.1.0 intentionally uses manual item entry and a reviewable paste-text importer. Screenshot OCR is **not** part of the reliability-critical core yet. It can be added later as an isolated importer after the shopping workflow is proven stable.

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

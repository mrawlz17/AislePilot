# Grocery Companion v0.2.5

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
- Local-only grocery/trip storage
- Installable PWA/offline app shell

## Screenshot import

Select one or more Walmart or Sam's Club cart screenshots. Grocery Companion OCRs each screenshot in the browser, uses the on-screen product layout to associate names with the right-side current price, verifies the price column in a separate OCR pass, removes likely duplicates caused by overlapping screenshots, and opens a mandatory review screen before saving anything.

The parser is designed to ignore unit-price text, crossed-out old prices, savings amounts, order headers, and quantity metadata that should not become grocery items.

### v0.2.5 iPhone OCR startup change

V0.2.5 removes the remaining blob-script startup path that could fail with a generic `Load failed` on iPhone Safari:

- The Tesseract API is downloaded as data, stored under a Grocery Companion same-origin URL, verified, and then loaded through a normal same-origin `<script>` request. Safari is no longer asked to execute a dynamically-created `blob:` OCR library.
- GitHub Raw is the primary pinned source for the Tesseract API, worker, and LSTM core files; CDN sources are secondary fallbacks.
- The English model uses the official `tessdata_fast` LSTM model and is staged as an uncompressed `.traineddata` file with `gzip:false`.
- The OCR runtime stages the basic LSTM, SIMD LSTM, and relaxed-SIMD LSTM core variants and gives Tesseract the local core directory so it can select the compatible build.
- Every staged file is size-checked before `createWorker()` runs.
- The error dialog records both the **last setup stage** and the actual error. A future failure should therefore identify whether it occurred while downloading, verifying, loading the API, or starting the worker.
- Grocery/trip data remains untouched until the import review is confirmed.

The first OCR setup requires internet access to obtain the OCR runtime. After successful staging, the files are reused from browser Cache Storage until site data is cleared or the app changes OCR versions.

Manual entry and the paste importer remain available as fallbacks.

## Deploy to GitHub Pages

Upload these files to the root of the GitHub repository:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `sw.js`
- `icon.svg`
- `icon-180.png`
- `icon-512.png`
- `README.md`

Then enable GitHub Pages for the repository branch/folder containing the files.

After replacing an older Grocery Companion release, reload Safari once and verify **Settings → Version = 0.2.5** before testing screenshot import.

## Data note

Grocery Companion stores trip/list data in browser localStorage. OCR runtime files use browser Cache Storage. Use **Settings → Export backup** before clearing browser/site data or moving to another device.

# Grocery Companion v0.2.4

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

### v0.2.4 iPhone OCR startup change

V0.2.4 changes how the OCR runtime is delivered to iPhone Safari:

- The page downloads the OCR library with ordinary CORS fetches instead of asking Safari to execute a cross-origin worker directly.
- The OCR worker, WebAssembly core loader, and English language model are downloaded first and stored in the app's Cache Storage under Grocery Companion same-origin URLs.
- The service worker only serves those already-staged local OCR files. It no longer attempts to relay a remote worker/core request while Tesseract is starting.
- The app verifies the local worker, core, and language files before starting OCR.
- The app confirms that the **v0.2.4 service worker** is actually controlling the page so an older cached service worker cannot silently run the previous OCR routing logic.
- The OCR core is deliberately the non-SIMD LSTM build. It is slower than the SIMD build but is the more conservative choice for iPhone/WebKit compatibility.
- If setup fails, the diagnostic should now name the failing phase/file rather than only showing `Load failed`.

The first successful OCR setup still requires an internet connection to obtain the pinned OCR runtime. After those files are cached, later imports can reuse them until site data is cleared or the OCR version changes.

Manual entry and the paste importer remain available as fallbacks. Trip data is never changed until the import review is confirmed.

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

After replacing an older Grocery Companion release, reload Safari once and verify **Settings → Version = 0.2.4** before testing screenshot import.

## Data note

Grocery Companion stores trip/list data in browser localStorage. OCR runtime files use browser Cache Storage. Use **Settings → Export backup** before clearing browser/site data or moving to another device.

# Grocery Companion v0.3.0

Reliability-first local web app for planning and shopping Walmart and Sam's Club grocery trips.

## What changed in v0.3.0

Version 0.3.0 removes Tesseract.js and all browser Worker/WebAssembly OCR startup code. Repeated iPhone Safari tests showed the Tesseract worker failing before screenshot recognition began, even after multiple loading strategies.

Screenshot import now uses the OCR.space API instead:

1. Select Walmart or Sam's Club cart screenshots.
2. Grocery Companion sends each screenshot to OCR.space for text recognition.
3. The app separately verifies the right-side price column to improve product/price pairing.
4. Likely overlapping duplicates are removed.
5. A review screen is mandatory before any item is added to the trip.

The grocery list, budgets, store routes, trip history, and learned categories remain stored locally in the browser.

## One-time screenshot OCR setup

1. Open **Settings → Screenshot OCR**.
2. Use the included link to request a free OCR.space API key.
3. Paste the key into Grocery Companion and tap **Save key**.
4. Tap **Test OCR**. The app generates a test image and confirms the OCR connection before you use real cart screenshots.

The API key is stored separately in browser local storage. It is not included in Grocery Companion backup files and is not committed to GitHub.

## Screenshot privacy

Only screenshots you explicitly choose for import are sent to OCR.space. Grocery Companion does not upload trip history, budgets, shopping routes, or saved item data.

## Core features

- Walmart and Sam's Club trip profiles
- Two-week budget and projected total
- Screenshot-to-list import with mandatory review
- Manual item entry and paste import fallback
- Automatic category suggestions and remembered categories
- Editable store-route order
- Shopping mode with picked/remaining totals
- Completed trip history
- Local JSON backup and restore
- Installable/offline-capable PWA shell

## Deployment

Upload all files in this release directory to the GitHub Pages repository root. Replace the previous release files. After deployment, reload Safari and verify **Settings → Version 0.3.0**.

No test-results or internal QA files belong in the deployed release.

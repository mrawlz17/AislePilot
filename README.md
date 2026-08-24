# Grocery Companion v0.3.2

Reliability-first Walmart and Sam's Club shopping companion.

## What changed in v0.3.2

- Keeps multi-select: choose up to 20 cart screenshots at once.
- Processes screenshots sequentially in groups of three with an 8-second cooldown between groups.
- Spaces normal OCR requests by 2.2 seconds instead of sending them back-to-back.
- Uses the OCR.space API key in the request header, matching the service documentation.
- Compresses each screenshot below the free API's 1 MB upload limit before sending it.
- Uses one OCR request per screenshot in normal cases; a separate price-column pass runs only if the full-screen overlay finds no usable prices.
- Retries temporary service failures with 5-second and 12-second backoff.
- If the OCR service itself is failing, the batch stops instead of repeatedly sending the remaining screenshots.
- The failure dialog now shows the actual first OCR error so service outages, HTTP failures, quota errors, and file-size problems are distinguishable.
- Any screenshots successfully recognized before a later service failure are still offered for review.
- Cross-batch duplicate protection remains enabled.

## Screenshot OCR setup

Screenshot import uses OCR.space. The API key remains stored only in this browser and is not included in backups or release files.

1. Open **Settings → Screenshot OCR**.
2. Paste your OCR.space API key if it is not already saved.
3. Tap **Test OCR** if you need to verify the connection.
4. Open **Plan → Upload cart screenshots** and select up to 20 screenshots.

## Import behavior

The app does not add OCR results directly to the grocery list. It always opens a review screen first. If a screenshot fails, the review screen reports how many failed so those images can be retried separately without losing the successful results.

## Data

Trips, item history, routes, learned categories, and preferences remain in browser local storage. Export a backup before clearing browser data or moving devices.

## Deployment

Upload all files in this release directory to the GitHub Pages repository root and replace the previous release files. Reload Safari and verify **Settings → Version 0.3.2** before testing.

The release package contains deployment/use files only; no internal QA artifacts are included.

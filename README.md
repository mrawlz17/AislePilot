# Grocery Companion v0.3.1

Reliability-first Walmart and Sam's Club shopping companion.

## What changed in v0.3.1

This release keeps the working OCR.space screenshot architecture from v0.3.0 and focuses on making real grocery-cart imports more reliable.

- Select up to 20 screenshots in one import.
- Screenshots are processed sequentially so iPhone Safari is not trying to upload a large batch simultaneously.
- Temporary OCR/network failures are retried automatically.
- One failed screenshot no longer aborts the entire batch; the remaining screenshots continue processing.
- The normal path uses one OCR request per screenshot. A second price-column OCR pass is used only when the first pass does not provide enough price-position data.
- Likely overlapping products are deduplicated both within the current screenshot batch and against items already imported into the active trip.
- Duplicate matching was tightened so similar products at the same price (for example hamburger buns vs. hot dog buns) are not incorrectly merged.
- High-confidence category rules were corrected for products observed during the Walmart test import, including frozen vegetables, tuna, half-and-half, yogurt drinks, ground beef, cat litter, SPAM, Hamburger Helper, infant formula, and toddler puffs.

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

Upload all files in this release directory to the GitHub Pages repository root and replace the previous release files. Reload Safari and verify **Settings → Version 0.3.1** before testing.

The release package contains deployment/use files only; no internal QA artifacts are included.

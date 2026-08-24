# Grocery Companion v0.3.5

Reliability-first Walmart and Sam's Club shopping companion.

## What changed in v0.3.5

- Shop view is now a dense checklist instead of a stack of large cards.
- The large app header is hidden while actively shopping to recover vertical screen space.
- The sticky shopping status area is reduced to one compact line plus a 4 px progress bar.
- Product rows are approximately 46 px minimum height with smaller 30 px check controls.
- Product names are capped at two lines so unusually long Walmart descriptions cannot make a single item excessively tall.
- The duplicated line-total value was removed from the metadata line; the total remains visible at the right edge.
- Category headers and spacing are substantially tightened.
- OCR, price reconciliation, fixed shopping order, batch pacing, duplicate detection, and local data behavior are unchanged from v0.3.4.

## Screenshot OCR setup

Screenshot import uses OCR.space. The API key remains stored only in this browser and is not included in backups or release files.

1. Open **Settings → Screenshot OCR**.
2. Paste your OCR.space API key if it is not already saved.
3. Tap **Test OCR** if you need to verify the connection.
4. Open **Plan → Upload cart screenshots** and select up to 20 screenshots.

## Shopping order

Every Walmart and Sam's Club trip is sorted in this fixed order:

1. Personal Care
2. Other
3. Household
4. Dairy
5. Drinks
6. Pantry
7. Meat
8. Frozen
9. Bakery
10. Deli
11. Produce

## Data

Trips, item history, learned categories, and preferences remain in browser local storage. Export a backup before clearing browser data or moving devices.

## Deployment

Upload all files in this release directory to the GitHub Pages repository root and replace the previous release files. Reload Safari and verify **Settings → Version 0.3.5** before testing.

The release package contains deployment/use files only; no internal QA artifacts are included.


## v0.3.5 reliability notes
- Screenshot OCR and quantity-price verification are unchanged from the passing v0.3.4 regression build.
- Fixed shopping order remains the only route for both stores.
- Versioned app assets remain cache-busted for GitHub Pages reliability.

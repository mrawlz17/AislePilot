# Grocery Companion v0.3.4

Reliability-first Walmart and Sam's Club shopping companion.

## What changed in v0.3.4

- Shopping category order is now fixed for every store and is no longer editable in Settings.
- The universal shopping order is: Personal Care → Other → Household → Dairy → Drinks → Pantry → Meat → Frozen → Bakery → Deli → Produce.
- Older saved/custom store routes are ignored on load so the same order is always used at Walmart and Sam's Club.
- Multi-quantity items now trigger a targeted second OCR pass of the price column.
- For quantity items, the displayed total price is treated as authoritative and quantity is used to derive the unit price.
- A visible “$X.XX ea” value is used only when it mathematically reconciles to the verified displayed total.
- Existing paced multi-screenshot processing, retry behavior, duplicate protection, and review-before-import remain unchanged.

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

Upload all files in this release directory to the GitHub Pages repository root and replace the previous release files. Reload Safari and verify **Settings → Version 0.3.4** before testing.

The release package contains deployment/use files only; no internal QA artifacts are included.


## v0.3.4 reliability changes
- Fixed shopping order is the only route for both stores.
- Cache-busted app assets so a GitHub Pages update cannot silently run an older app.js.
- Quantity items use a lossless, high-accuracy OCR Engine 3 verification pass and mathematical reconciliation of total vs. each price.

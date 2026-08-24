# Grocery Companion v0.4.0

Compact dark-layout release for the personal Walmart/Sam's Club shopping workflow.

## What changed

- Removed the **How V1 works** card from Home.
- Switched the entire app to a darker charcoal/slate palette.
- Reduced header, card, field, button, metric, and navigation sizing so all views use the same compact sizing system.
- Plan now uses dense category-grouped rows similar to Shop instead of large individual item cards.
- Single-quantity items no longer waste a second line showing `1 × price`; quantity detail is shown only when quantity is greater than one.
- Store/date controls use a dedicated compact mobile grid and the date control is constrained so it cannot overflow its space.
- Shop's sticky status line is smaller and now shows only the essential store/count and remaining spend.
- Shop categories are **collapsed by default**. Tap a category header to expand or collapse it.
- Re-entering Shop collapses all groups again by default.
- Removed the repeated projected-total/budget card from the bottom of Shop; Finish Trip and Back to Plan are now compact actions.
- Screenshot OCR, fixed shopping order, duplicate handling, quantity-price reconciliation, and local storage behavior are unchanged from the passing v0.3.4/v0.3.5 workflow.

## Fixed shopping order

Personal Care → Other → Household → Dairy → Drinks → Pantry → Meat → Frozen → Bakery → Deli → Produce

## Screenshot OCR

Screenshot import continues to use OCR.space. The API key remains stored only in this browser and is not included in backups or release files.

## Deployment

Upload all files in this release directory to the GitHub Pages repository root and replace the previous release files. Reload Safari and verify **Settings → Version 0.4.0**.

The release package contains deployment/use files only; no internal QA artifacts are included.

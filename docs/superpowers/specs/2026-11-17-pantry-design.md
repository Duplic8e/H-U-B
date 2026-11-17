# Pantry: design

A Hub helper that tracks food at home. Items are added by scanning their barcode with the phone camera.

## Decisions

- **Where**: `apps/pantry`, served at `/H-U-B/pantry/`, with a Hub tile. Same stack as Lift (Preact, Dexie,
  vite-plugin-pwa).
- **Scanning**: live camera (`getUserMedia`) with a bundled decoder (`barcode-detector` ponyfill, ZXing
  WebAssembly). iPhone Safari does not ship the native `BarcodeDetector`, and photo-then-decode is too slow
  for unloading groceries. Formats: EAN-13, EAN-8, UPC-A, UPC-E.
- **Product details**: five free databases asked at once (Open Food Facts, USDA FoodData Central, Open Products, Beauty and Pet Food Facts). Only the barcode is sent.
- **Tracked per item**: name, brand, photo URL, quantity, optional expiry date. Not tracked: location,
  shopping list.
- **One row per product**, one expiry date per product (the earliest pack), not one per pack.
- **Sync**: `pantry/data.json` in the Hub data repo, merged by row with the newest edit winning.

## Behaviour

- Scan → lookup → confirm sheet (name, brand, quantity 1, optional expiry) → Save.
- Scanning a product already in the pantry opens it with quantity plus one.
- Product unknown or no connection: the sheet opens with the barcode and an empty name to type.
- Used-up products stay as deleted rows, which makes them the memory for the next scan.
- Add by hand for things without a barcode.
- List: dated items soonest first, then by name; expired and within-7-days highlighted; search.
- Minus at 1 removes the item, with an Undo toast.
- Camera refused or missing: a reason, and a button to add by hand.

## Data

`Item { id, updatedAt, deletedAt?, barcode?, name, brand?, imageUrl?, quantity, expiresOn? }`. The id of a
scanned product is `b:<barcode>`, so two devices that scan the same product offline merge into one row.
Items added by hand get a random id.

## Testing

Unit tests for the repo, expiry rules, Open Food Facts parsing and sync against a simulated GitHub. A browser
test (`tests/e2e/pantry.mjs`) scans a generated barcode through Chromium's fake camera. Reading real packaging
with a real iPhone camera can only be checked on the device.

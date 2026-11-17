# Pantry

What food is at home, for the Hub. Served at `/H-U-B/pantry/`.

- **Scan a barcode** with the camera and the product's name, brand and photo are filled in from
  [Open Food Facts](https://world.openfoodfacts.org). Only the barcode is sent.
- **Quantity**: scanning a product you already have adds one. Minus uses one up; the last one removes
  the item, with Undo.
- **Expiry date**, optional, one per product. Dated items list soonest first; expired items and those
  within 7 days are highlighted.
- **Unknown products and no signal**: type the name once. Pantry remembers every product it has seen,
  including used-up ones, so the next scan needs no lookup.
- **No barcode** (produce, bulk): the plus button adds an item by hand.
- **Offline first** (IndexedDB), backed up to `pantry/data.json` in the Hub's private data repo through
  the Hub's one GitHub connection. Edits from two devices merge by row, newest edit winning. A scanned
  product's row id is its barcode, so two phones that scan the same thing offline end up with one row.

```sh
npm ci
npm test         # data, expiry, lookup parsing, merge and sync against a simulated GitHub
npm run dev
```

## Scanning

iPhone Safari has no built-in barcode reader, so the app bundles one:
[barcode-detector](https://github.com/Sec-ant/barcode-detector), which runs ZXing as WebAssembly. The
decoder file is part of the build and precached, so scanning itself works offline. It reads EAN-13, EAN-8,
UPC-A and UPC-E; a UPC-A code is stored as EAN-13 with a leading zero so both readings are one product.

The camera needs HTTPS (or localhost) and the user's permission.

`../../tests/e2e/pantry.mjs` drives the built app in Chromium with a fake camera showing a generated barcode.

# Pantry

What food is at home, for the Hub. Served at `/H-U-B/pantry/`.

- **Scan a barcode** with the camera and the product's name, brand and photo are filled in. Pantry asks
  Open Food Facts, Open Products Facts, Open Beauty Facts and Open Pet Food Facts live, and its own
  built-in copy of all four plus USDA's US branded foods (about 4.6 million products), all at once. The
  built-in copy answers when the online databases are slow or down. Only the barcode is sent. A database
  that fails gets a second try, and a lookup that could not reach every database says so and offers
  Try again, instead of claiming the product is unknown.
- **Groceries mode**: switch the scanner to Groceries and scan everything from your bags in one go. Each
  pack ticks and flashes; one held in view counts once, and moving it away and back counts another.
  Products are looked up in the background, three at a time. Review shows them all with counts (and what
  is already in the pantry); fix any that were not found, set expiry dates, then Add all. Add all doesn't
  wait for lookups still running: those items finish in the background. The list is
  kept on the phone until it is added, so closing the app loses nothing.
- **Nutrition facts** per serving and per 100 g (100 ml for drinks), in the Canadian label's order, from
  the databases (Open Food Facts first, USDA filling the gaps). Items saved before this get theirs the
  first time they are opened online.
- **Lookups never make you wait**: a scan opens its sheet at once and the name, brand, photo and
  nutrition fill in as they arrive (fields you have typed in are left alone). Save straight away and the
  item shows "Looking up…" until the lookup finishes in the background. One that could not reach the
  databases is retried automatically when the connection comes back or the app is reopened. Each
  product is looked up once per visit, however many places ask.
- **Quantity**: scanning a product you already have adds one. Minus uses one up; the last one removes
  the item, with Undo.
- **Expiry date**, optional, one per product. Dated items list soonest first; expired items and those
  within 7 days are highlighted.
- **Unknown products and no signal**: type the name once. Pantry remembers every product it has seen,
  including used-up ones, so the next scan needs no lookup.
- **No barcode** (produce, bulk): the + in the header, or Add next to Scan, adds an item by hand.
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
UPC-A and UPC-E. A UPC-A code is stored as EAN-13 with a leading zero, and a UPC-E code (small packs) is
written out in full, so every reading of a product is one key.

The camera needs HTTPS (or localhost) and the user's permission.

`../../tests/e2e/pantry.mjs` drives the built app in Chromium with a fake camera showing a generated barcode.

## The built-in copy

`scripts/fetch-catalog.sh` downloads the Open Food Facts, Open Products/Beauty/Pet Food Facts and USDA
Branded Foods bulk files (about 2 GB) and `scripts/build-catalog.mjs` turns them into 10,000 small gzip
files under `/H-U-B/pantry/barcodes/`, with nutrition where known,, keyed by the 4 digits before a code's check digit, so one lookup
downloads about 10 KB. Codes with a wrong check digit, case codes and discontinued USDA products are left
out. The deploy workflow rebuilds it every Monday and caches it between deploys; files a phone has
fetched are kept for a week, so a product scanned before is found offline.

To build it locally: `bash scripts/fetch-catalog.sh /tmp/pantry-downloads dist/barcodes` (needs about
8 GB of memory and 5 minutes).

## Adding a product database

A live one goes in `sources()` in `src/data/lookup.ts`. It must be callable from a browser (it has to send
`Access-Control-Allow-Origin` for any site) without a secret. UPCitemdb, Barcode Lookup, Go-UPC and
EAN-Search were ruled out for that reason: they either refuse browser calls or need a paid key. A
database with a bulk download can go in the built-in copy instead: add a reader to
`scripts/build-catalog.mjs` and a letter for it in `src/data/catalog.ts`.

// Builds Pantry's built-in barcode index from the Open Food Facts and USDA bulk downloads, so a
// scan finds a product even when those servers are slow or down.
//
//   node scripts/build-catalog.mjs --facts o=en.openfoodfacts.org.products.csv.gz,p=en.openproductsfacts.org.products.csv.gz,... \
//     --usda FoodData_Central_branded_food_csv_<date>/ --out dist/barcodes
//
// Sources, in the order they win when two know a product: o Open Food Facts, p Open Products Facts,
// b Open Beauty Facts, f Open Pet Food Facts (all the same file format), u USDA branded foods.
// Writes one gzip file per shard (the 4 digits before the check digit, so lookups fetch ~10 KB),
// plus meta.json. Each line: code \t name \t brand \t quantity \t image \t source \t nutrition \t category, where
// nutrition is "per;amounts;serving size;serving" with the amounts in the order of AMOUNTS below
// (per 100 g, or 100 ml for drinks). src/data/nutrition.ts reads it back.
// Either input can be left out. Lines are sorted, so the same inputs give the same files.
import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import CATEGORIES from '../src/data/categories.json' with { type: 'json' };

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const out = args.out ?? 'dist/barcodes';

// ---- shared with src/data/catalog.ts ----
export const bare = (code) => code.replace(/^0+/, '');
export const shardOf = (code) => bare(code).padStart(5, '0').slice(-5, -1);
function validCheckDigit(code) {
  if (!/^\d{8,14}$/.test(code)) return false;
  const d = [...code].map(Number);
  const check = d.pop();
  const sum = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
/** Open Food Facts keeps a product's photos in a folder named after its code, split 3/3/3/rest. */
export const offFolder = (code) => code.padStart(13, '0').replace(/^(\d{3})(\d{3})(\d{3})(\d+)$/, '$1/$2/$3/$4');
const FACTS = { o: 'openfoodfacts', p: 'openproductsfacts', b: 'openbeautyfacts', f: 'openpetfoodfacts' };

/** A copy that does not keep the whole source line alive: V8 substrings point into their parent,
 *  and holding a few fields of each of 4 million long lines would otherwise hold every line. */
const own = (s) => Buffer.from(s, 'utf8').toString('utf8');
const clean = (s) => (s ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
/** "COCA-COLA CLASSIC" → "Coca-Cola Classic"; names that already mix case are left alone. */
const titleCase = (s) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-/(&.])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : s);
/** EAN-13 as scanned: digits only, 8 to 14 long, a correct check digit; 12 and 14 digit codes become 13. */
function scanForm(raw) {
  let code = (raw ?? '').replace(/\D/g, '');
  if (code.length === 12) code = `0${code}`;
  if (code.length === 14 && code.startsWith('0')) code = code.slice(1);
  // 14-digit codes that remain are case and pallet codes, never on a retail pack.
  if (!(code.length === 8 || code.length === 13) || !validCheckDigit(code)) return null;
  return code;
}

// ---- nutrition, shared with src/data/nutrition.ts ----
const AMOUNTS = ['kcal', 'fat', 'saturatedFat', 'transFat', 'cholesterolMg', 'carbs', 'fiber', 'sugars', 'protein', 'sodiumMg'];
const MAX = { kcal: 900, fat: 100, saturatedFat: 100, transFat: 100, cholesterolMg: 3000, carbs: 100, fiber: 100, sugars: 100, protein: 100, sodiumMg: 40000 };
const num = (v) => (v === '' || v === undefined || v === null ? undefined : Number(v));
/** The nutrition field for a line, or '' when too little is known. */
function nutritionField(raw, per, servingSize, serving) {
  const values = AMOUNTS.map((k) => {
    const v = num(raw[k]);
    if (v === undefined || !Number.isFinite(v) || v < 0 || v > MAX[k]) return '';
    return String(k === 'kcal' || k.endsWith('Mg') ? Math.round(v) : Math.round(v * 10) / 10);
  });
  if (values[0] === '' && values.filter(Boolean).length < 3) return '';
  const size = num(servingSize);
  return [per, values.join(','), size && Number.isFinite(size) && size > 0 && size < 5000 ? Math.round(size * 10) / 10 : '', clean(serving).replace(/;/g, ',')].join(';').replace(/;+$/, '');
}
// ---- categories, shared with src/data/categories.ts (same rules file, same matching) ----
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const WORDS = CATEGORIES.map((c) => ({ code: c.code, re: c.words.length ? new RegExp(`\\b(${c.words.join('|')})\\b`, 'i') : null }));
const TAGS = CATEGORIES.map((c) => ({ code: c.code, tags: new Set(c.tags) }));
const CODE_OF = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.code]));
function categoryCode(tags, ...texts) {
  if (tags) {
    const plain = tags.split(',').map((t) => t.trim().replace(/^[a-z]{2}:/, '')).filter(Boolean);
    const hit = TAGS.find((c) => plain.some((t) => c.tags.has(t)));
    if (hit) return hit.code;
  }
  for (const text of texts) {
    if (!text) continue;
    const t = fold(text);
    const hit = WORDS.find((w) => w.re?.test(t));
    if (hit) return hit.code;
  }
  return '';
}

const isLiquid = (quantity) => /\d\s*(ml|cl|dl|l|fl\.? ?oz)\b/i.test(quantity ?? '');

/** bare code → the line for it: code, name, brand, quantity, image, source, nutrition */
const rows = new Map();
const counts = { o: 0, p: 0, b: 0, f: 0, u: 0, nutrition: 0 };
let usdaTotal = 0;
/** GS1 unit codes in USDA package sizes, as written on a pack. */
const UNITS = { LBR: 'lb', ONZ: 'oz', OZA: 'fl oz', GRM: 'g', KGM: 'kg', MLT: 'ml', LTR: 'L', GLL: 'gal', CT: 'ct', EA: 'ct' };
const usdaSize = (s) => s.replace(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/, (all, n, u) => (UNITS[u.toUpperCase()] ? `${Number(n)} ${UNITS[u.toUpperCase()]}` : all));

async function readFacts(source, path) {
  const images = `https://images.${FACTS[source]}.org/images/products/`;
  const lines = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
  let col;
  for await (const line of lines) {
    const f = line.split('\t');
    if (!col) { col = Object.fromEntries(f.map((name, i) => [name, i])); continue; }
    const raw = f[col.code] ?? '';
    const code = scanForm(raw);
    if (!code) continue;
    const brand = clean(f[col.brands]).split(',')[0]?.trim() ?? '';
    const name = clean(f[col.product_name]) || clean(f[col.abbreviated_product_name]) || clean(f[col.generic_name]) || brand;
    if (!name) continue;
    const quantity = clean(f[col.quantity]).replace(/\s*\be$/, '');
    let image = '';
    const url = f[col.image_small_url] ?? '';
    if (url.startsWith(images)) {
      const path = url.slice(images.length);
      const folder = `${offFolder(code)}/`;
      image = path.startsWith(folder) ? path.slice(folder.length) : path;
    }
    const key = own(bare(code));
    // Earlier databases win; within one, the first row for a code does.
    if (rows.has(key)) continue;
    const mg = (c) => (num(f[col[c]]) === undefined ? undefined : num(f[col[c]]) * 1000);
    const facts = col['energy-kcal_100g'] === undefined ? '' : nutritionField({
      kcal: f[col['energy-kcal_100g']], fat: f[col.fat_100g], saturatedFat: f[col['saturated-fat_100g']], transFat: f[col['trans-fat_100g']],
      cholesterolMg: mg('cholesterol_100g'), carbs: f[col.carbohydrates_100g], fiber: f[col.fiber_100g], sugars: f[col.sugars_100g],
      protein: f[col.proteins_100g], sodiumMg: mg('sodium_100g'),
    }, isLiquid(quantity) ? 'ml' : 'g', f[col.serving_quantity], f[col.serving_size]);
    const cat = source === 'f' ? CODE_OF.pet : source === 'o' ? categoryCode(f[col.categories_tags], `${name} ${brand}`) : CODE_OF.household;
    counts[source]++;
    if (facts) counts.nutrition++;
    rows.set(key, own([code, name, brand, quantity, image, source, facts, cat].join('\t')));
  }
}

/** A streaming CSV reader that handles quoted fields with commas, quotes and newlines. */
async function* csv(path) {
  let field = '', row = [], quoted = false, header;
  for await (const chunk of createReadStream(path, { encoding: 'utf8', highWaterMark: 1 << 20 })) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (quoted) {
        if (c === '"') { if (chunk[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') {
        row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
        if (!header) header = row; else yield Object.fromEntries(header.map((h, j) => [h, row[j] ?? '']));
        row = []; field = '';
      } else field += c;
    }
  }
}

async function readUsda(dir) {
  // A product appears once per label update; the latest one wins.
  const latest = new Map();
  for await (const r of csv(join(dir, 'branded_food.csv'))) {
    if (r.discontinued_date) continue;
    const code = scanForm(r.gtin_upc);
    if (!code) continue;
    const key = bare(code);
    const prev = latest.get(key);
    if (prev && prev.date > r.available_date) continue;
    const unit = { g: 'g', grm: 'g', ml: 'ml', mlt: 'ml' }[clean(r.serving_size_unit).toLowerCase()];
    const amount = num(r.serving_size);
    const household = clean(r.household_serving_fulltext);
    const printed = unit && amount ? `${Math.round(amount * 10) / 10} ${unit}` : '';
    latest.set(key, {
      id: r.fdc_id, code, date: r.available_date, group: clean(r.branded_food_category), brand: titleCase(clean(r.brand_name) || clean(r.brand_owner)), size: usdaSize(clean(r.package_weight).split('/')[0].trim()),
      per: unit === 'ml' ? 'ml' : 'g', servingSize: unit ? amount : undefined,
      serving: household && printed && !/^amount per serving$/i.test(household) ? `${household.toLowerCase()} (${printed})` : printed,
    });
  }
  const byId = new Map([...latest.values()].map((v) => [v.id, v]));
  // USDA's amounts for branded foods are per 100 g (or 100 ml).
  const NUTRIENTS = { 1008: 'kcal', 1004: 'fat', 1258: 'saturatedFat', 1257: 'transFat', 1253: 'cholesterolMg', 1005: 'carbs', 1079: 'fiber', 2000: 'sugars', 1003: 'protein', 1093: 'sodiumMg' };
  if (existsSync(join(dir, 'food_nutrient.csv'))) {
    for await (const r of csv(join(dir, 'food_nutrient.csv'))) {
      const k = NUTRIENTS[r.nutrient_id];
      const v = k && byId.get(r.fdc_id);
      if (v) (v.amounts ??= {})[k] = r.amount;
    }
  }
  for await (const r of csv(join(dir, 'food.csv'))) {
    const v = byId.get(r.fdc_id);
    if (!v) continue;
    const name = titleCase(clean(r.description));
    if (!name) continue;
    usdaTotal++;
    const key = bare(v.code);
    const facts = v.amounts ? nutritionField(v.amounts, v.per, v.servingSize, v.serving) : '';
    const known = rows.get(key);
    // The open databases usually have a photo and a better name, so they win when both know the product;
    // USDA only fills in nutrition they lack.
    if (known) {
      const fields = known.split('\t');
      let changedRow = false;
      if (!fields[6] && facts) { fields[6] = facts; counts.nutrition++; changedRow = true; }
      if (!fields[7]) { const cat = categoryCode('', v.group, name); if (cat) { fields[7] = cat; changedRow = true; } }
      if (changedRow) rows.set(key, own(fields.join('\t')));
      continue;
    }
    counts.u++;
    if (facts) counts.nutrition++;
    rows.set(key, own([v.code, name, v.brand, v.size, '', 'u', facts, categoryCode('', v.group, name)].join('\t')));
  }
}

const started = Date.now();
for (const pair of (args.facts ?? '').split(',').filter(Boolean)) {
  const [source, path] = pair.split('=');
  if (!FACTS[source] || !path) throw new Error(`--facts takes letter=path pairs, letters ${Object.keys(FACTS).join(', ')}`);
  await readFacts(source, path);
  console.log(`${FACTS[source]}: ${counts[source]} new products (${Math.round((Date.now() - started) / 1000)}s)`);
}
if (args.usda) { await readUsda(args.usda); console.log(`USDA: ${usdaTotal} products, ${counts.u} not in the open databases`); }

const shards = new Map();
for (const [key, row] of rows) {
  const s = shardOf(key);
  if (!shards.has(s)) shards.set(s, []);
  shards.get(s).push([key, row]);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
let bytes = 0;
for (const [s, lines] of shards) {
  const body = gzipSync(lines.sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((l) => l[1]).join('\n') + '\n', { level: 9 });
  // A fixed mtime, so an unchanged shard is byte-identical between builds.
  body[4] = body[5] = body[6] = body[7] = 0;
  bytes += body.length;
  writeFileSync(join(out, `${s}.gz`), body);
}
writeFileSync(join(out, 'meta.json'), JSON.stringify({ builtAt: new Date().toISOString(), products: rows.size, withNutrition: counts.nutrition, bySource: { o: counts.o, p: counts.p, b: counts.b, f: counts.f, u: counts.u } }));
console.log(`${rows.size} products in ${shards.size} shards, ${(bytes / 1e6).toFixed(1)} MB (${Math.round((Date.now() - started) / 1000)}s)`);

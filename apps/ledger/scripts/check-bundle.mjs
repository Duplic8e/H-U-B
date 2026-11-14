import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ASSETS = 'dist/assets'

// Budgets in kilobytes of raw (not gzipped) output. These encode the audit
// targets: no single non-vendor chunk over 300 kB, and the chart library must
// live in its own chunk rather than riding along with an unrelated component.
const MAX_ENTRY_KB = 300
const MAX_ANY_CHUNK_KB = 400

// Total raw bytes the browser must fetch and evaluate before first paint:
// the entry chunk plus everything it statically imports, transitively. The
// per-chunk budgets above cannot see this, so splitting one eager chunk into
// three eager chunks used to pass while changing nothing for the user.
// Dropping the framer-motion dependency (Sheet, PageTransition and
// AnimatedNumber now animate in CSS) took this from 556.5 kB to 428.0 kB
// measured; the budget below is that figure rounded up to the next 25 kB so
// the win cannot quietly be given back.
const MAX_INITIAL_LOAD_KB = 450

const files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'))
const sized = files.map((f) => ({
  name: f,
  kb: statSync(join(ASSETS, f)).size / 1024,
}))

const failures = []

const entry = sized.find((f) => f.name.startsWith('index-'))
if (!entry) failures.push('no entry chunk named index-*.js found')
else if (entry.kb > MAX_ENTRY_KB)
  failures.push(`entry chunk ${entry.name} is ${entry.kb.toFixed(1)} kB, budget ${MAX_ENTRY_KB} kB`)

for (const f of sized) {
  if (f.kb > MAX_ANY_CHUNK_KB)
    failures.push(`chunk ${f.name} is ${f.kb.toFixed(1)} kB, budget ${MAX_ANY_CHUNK_KB} kB`)
}

const charts = sized.find((f) => f.name.startsWith('charts-'))
if (!charts) failures.push('expected a dedicated charts-*.js chunk')
else {
  // Verify the entry chunk does not statically import any charts chunk.
  // The charts chunks must be deferred (loaded dynamically), not eagerly
  // bundled into the entry point. After commit b3fa40b, the chunkFileNames
  // heuristic names any chunk containing a chart-related module with the
  // charts- prefix, but that no longer guarantees the chunk is deferred.
  const entryContent = readFileSync(join(ASSETS, entry.name), 'utf8')
  const chartsImportPattern = /import\s*\{[^}]*\}\s*from\s*["']\.\/charts-/
  if (chartsImportPattern.test(entryContent)) {
    failures.push(`entry chunk ${entry.name} statically imports a charts-*.js chunk (should be deferred, not eager)`)
  }
}

// The chart chunks are genuinely deferred (not statically imported by the
// entry chunk); see vite.config.ts for how chunkFileNames names it. It is
// still kept in the PWA precache deliberately, see the comment above the
// VitePWA plugin in vite.config.ts, so it is fine and expected for it to
// show up in the service worker precache manifest.

function staticDeps(file) {
  const src = readFileSync(join(ASSETS, file), 'utf8')
  const out = new Set()
  const re = /from\s*["']\.\/([A-Za-z0-9_.-]+\.js)["']/g
  let m
  while ((m = re.exec(src))) out.add(m[1])
  const re2 = /import\s*["']\.\/([A-Za-z0-9_.-]+\.js)["']/g
  while ((m = re2.exec(src))) out.add(m[1])
  return [...out]
}

const initial = new Set()
if (entry) {
  const walk = [entry.name]
  while (walk.length) {
    const f = walk.pop()
    if (initial.has(f)) continue
    initial.add(f)
    for (const d of staticDeps(f)) if (!initial.has(d)) walk.push(d)
  }
}
const initialKb = [...initial].reduce(
  (sum, n) => sum + (sized.find((f) => f.name === n)?.kb ?? 0),
  0,
)
console.log(`\nInitial load graph: ${initial.size} chunks, ${initialKb.toFixed(1)} kB raw`)
for (const n of [...initial].sort()) console.log(`    ${n}`)
if (initialKb > MAX_INITIAL_LOAD_KB) {
  failures.push(
    `initial load graph is ${initialKb.toFixed(1)} kB, budget ${MAX_INITIAL_LOAD_KB} kB`,
  )
}

console.log('Chunks:')
for (const f of [...sized].sort((a, b) => b.kb - a.kb))
  console.log(`  ${f.kb.toFixed(1).padStart(8)} kB  ${f.name}`)

if (failures.length) {
  console.error('\nBundle budget failures:')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('\nAll bundle budgets met.')

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, extname, relative } from 'node:path'

// Modules that must never be reachable from the entry through static imports.
// A static import is blocking: the browser must fetch and evaluate it before
// first paint. A dynamic import() is a split point and is deliberately not
// followed here.
// framer-motion was 136.1 kB of a 555.0 kB eager graph, pulled in by Sheet,
// PageTransition and AnimatedNumber, all of which are on the always-mounted
// path. All three now animate in CSS.
const FORBIDDEN = ['recharts', 'framer-motion']

function resolveImp(from, spec) {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(from), spec)
  const cands = [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx']
  for (const c of cands) if (existsSync(c) && extname(c)) return c
  return null
}

function staticImports(file) {
  const src = readFileSync(file, 'utf8')
  const out = []
  let m
  const re = /^[ \t]*import\s+[\s\S]*?\s*from\s*['"]([^'"]+)['"]/gm
  while ((m = re.exec(src))) out.push(m[1])
  const re2 = /^[ \t]*import\s*['"]([^'"]+)['"]/gm
  while ((m = re2.exec(src))) out.push(m[1])
  return out
}

const cwd = process.cwd()
const rel = (p) => relative(cwd, p).split('\\').join('/')
const entry = resolve('src/main.tsx')
const seen = new Set()
const parents = new Map()
const stack = [entry]
const offenders = []

while (stack.length) {
  const f = stack.pop()
  if (seen.has(f)) continue
  seen.add(f)
  let imps
  try { imps = staticImports(f) } catch { continue }
  for (const bad of FORBIDDEN) {
    if (imps.includes(bad)) offenders.push({ file: f, pkg: bad })
  }
  for (const spec of imps) {
    const r = resolveImp(f, spec)
    if (r && !seen.has(r)) { parents.set(r, f); stack.push(r) }
  }
}

console.log(`Eager static graph from src/main.tsx: ${seen.size} files.`)

if (offenders.length > 0) {
  console.error('\nForbidden packages are reachable without a dynamic import:')
  for (const o of offenders) {
    console.error(`\n  ${o.pkg} <- ${rel(o.file)}`)
    let p = parents.get(o.file)
    let depth = 0
    while (p && depth++ < 10) {
      console.error(`    imported by ${rel(p)}`)
      p = parents.get(p)
    }
  }
  console.error('\nBreak one link in each chain with React.lazy or a dynamic import.')
  process.exit(1)
}

console.log('No forbidden package is eagerly reachable.')

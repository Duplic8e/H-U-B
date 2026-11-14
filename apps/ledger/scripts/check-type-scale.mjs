import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

// Fails if the raw 10px or 11px arbitrary type values reappear. They were
// replaced by the text-micro and text-meta utilities, which step up one
// pixel on phones. A new text-[10px] would silently reintroduce a tier the
// audit found too small to read on a handset, and nothing else would catch
// it: jsdom has no layout engine and the e2e guards check geometry, not
// font size.
//
// Plain readdirSync recursion rather than a glob helper, to match
// scripts/check-eager-graph.mjs and to stay off Node-version-specific APIs.

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full)
  }
  return out
}

const cwd = process.cwd()
const files = walk(join(cwd, 'src'))
const offenders = []

for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/text-\[1[01]px\](?!\d)/.test(line)) {
      const rel = relative(cwd, file).split('\\').join('/')
      offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`)
    }
  })
}

if (offenders.length > 0) {
  console.error('Raw 10px/11px type found. Use text-micro or text-meta instead:\n')
  offenders.forEach((o) => console.error('  ' + o))
  process.exit(1)
}

console.log(`check:type-scale OK (${files.length} files)`)

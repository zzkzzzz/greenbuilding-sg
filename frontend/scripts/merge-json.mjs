#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

async function main() {
  const [basePath, chunkPath, outPath] = process.argv.slice(2)
  if (!basePath || !chunkPath || !outPath) {
    console.error('Usage: node scripts/merge-json.mjs <base> <chunk> <out>')
    process.exit(1)
  }
  const base = JSON.parse(await readFile(basePath, 'utf8'))
  const chunk = JSON.parse(await readFile(chunkPath, 'utf8'))

  const map = new Map()
  for (const b of base) map.set(b.id, b)
  for (const c of chunk) {
    const prev = map.get(c.id)
    if (!prev) { map.set(c.id, c); continue }
    const hasBetter = c.district && c.district !== 'Unknown'
    map.set(c.id, hasBetter ? c : prev)
  }

  const merged = Array.from(map.values()).sort((a, b) => a.id - b.id)
  await writeFile(outPath, JSON.stringify(merged, null, 2))
  console.log(`Merged ${base.length} + ${chunk.length} => ${merged.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

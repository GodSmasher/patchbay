// Copies committed bench/*.json files from the repo root into apps/web/public/
// (and apps/web/data/ for static imports) before every build so pages always
// render against the latest committed data.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoBench = resolve(here, '..', '..', '..', 'bench')
const publicDir = resolve(here, '..', 'public')
const dataDir = resolve(here, '..', 'data')

const copies = [
  { from: 'variance.json',             toPublic: true,  toData: false },
  { from: 'impersonation-public.json', toPublic: false, toData: true  },
]

mkdirSync(publicDir, { recursive: true })
mkdirSync(dataDir, { recursive: true })

for (const c of copies) {
  const src = resolve(repoBench, c.from)
  if (!existsSync(src)) {
    console.warn('copy-bench: ' + src + ' not found, skipping')
    continue
  }
  if (c.toPublic) {
    const dst = resolve(publicDir, c.from)
    copyFileSync(src, dst)
    console.log('copy-bench: ' + src + ' → ' + dst)
  }
  if (c.toData) {
    const dst = resolve(dataDir, c.from)
    copyFileSync(src, dst)
    console.log('copy-bench: ' + src + ' → ' + dst)
  }
}

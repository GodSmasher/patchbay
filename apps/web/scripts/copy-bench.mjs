// Copies committed bench/*.json files from the repo root into apps/web/public/
// (and apps/web/data/ for static imports) before every build so pages always
// render against the latest committed data.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoBench = resolve(here, '..', '..', '..', 'bench')
const publicDir = resolve(here, '..', 'public')
const dataDir = resolve(here, '..', 'data')
const cveDataDir = resolve(dataDir, 'cve')

const singleCopies = [
  { from: 'variance.json',             toPublic: true,  toData: false },
  { from: 'impersonation-public.json', toPublic: false, toData: true  },
  { from: 'check-owasp-mapping.json',  toPublic: false, toData: true  },
]

mkdirSync(publicDir, { recursive: true })
mkdirSync(dataDir, { recursive: true })
mkdirSync(cveDataDir, { recursive: true })

for (const c of singleCopies) {
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

// CVE directory: copy every CVE-PATCHBAY-*.json so the /cve routes can read them.
const srcCveDir = resolve(repoBench, 'cve')
if (existsSync(srcCveDir)) {
  const cveFiles = readdirSync(srcCveDir).filter((f) => /^CVE-PATCHBAY-\d{4}-\d{4,}\.json$/.test(f))
  for (const f of cveFiles) {
    copyFileSync(resolve(srcCveDir, f), resolve(cveDataDir, f))
    console.log('copy-bench: ' + resolve(srcCveDir, f) + ' → ' + resolve(cveDataDir, f))
  }
  // Also copy the external CVE index (synced from mcp-cve-project)
  const externalCves = resolve(srcCveDir, 'external-cves.json')
  if (existsSync(externalCves)) {
    copyFileSync(externalCves, resolve(cveDataDir, 'external-cves.json'))
    console.log('copy-bench: ' + externalCves + ' → ' + resolve(cveDataDir, 'external-cves.json'))
  }
} else {
  console.warn('copy-bench: ' + srcCveDir + ' not found, no CVE data to copy')
}

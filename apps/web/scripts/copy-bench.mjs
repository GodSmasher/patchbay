// Copies bench/variance.json from the repo root into apps/web/public/ before every build
// so the /bench page always renders against the latest benchmark run.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '..', '..', '..', 'bench', 'variance.json')
const target = resolve(here, '..', 'public', 'variance.json')

if (!existsSync(source)) {
  console.warn(`copy-bench: ${source} not found, keeping whatever is in public/`)
  process.exit(0)
}
mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
console.log(`copy-bench: ${source} → ${target}`)

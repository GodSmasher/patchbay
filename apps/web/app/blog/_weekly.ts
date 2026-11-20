// Weekly rescan report helpers.
//
// Lives apart from `_data.ts` because reading `public/weekly/index.json`
// needs `node:fs`, which the Edge runtime (used by the evergreen blog
// post OG image at `[slug]/opengraph-image.tsx`) cannot resolve.
//
// Every caller of these helpers runs under the Node runtime:
//   - `blog/weekly/[week]/page.tsx`      (default Node runtime)
//   - `blog/weekly/[week]/opengraph-image.tsx`  (set to Node runtime)
//   - `blog/page.tsx` for the index block         (`dynamic = 'force-dynamic'`)

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface WeeklyReport {
  slug: string          // e.g. "2026-W47"
  year: number
  week: number
  capturedAt: string | null  // ISO from the markdown header, if findable
  title: string         // H1 from the markdown
}

function loadWeeklyIndex(): WeeklyReport[] {
  const abs = join(process.cwd(), 'public', 'weekly', 'index.json')
  if (!existsSync(abs)) return []
  try {
    return JSON.parse(readFileSync(abs, 'utf8')) as WeeklyReport[]
  } catch {
    return []
  }
}

export function listWeeklyReports(): WeeklyReport[] {
  return loadWeeklyIndex()
}

export function getWeeklyReport(slug: string): WeeklyReport | undefined {
  return loadWeeklyIndex().find((r) => r.slug === slug)
}

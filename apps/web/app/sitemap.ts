import type { MetadataRoute } from 'next'
import { POSTS } from './blog/_data'
import { DOCS } from './docs/_data'
import { loadLeaderboardSnapshot } from '@/lib/leaderboard-store'
import { loadAllCves } from '@/lib/cve'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const posts = POSTS.filter((p) => !p.draft)

  const base: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/scan`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: SITE_URL, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/audit`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/mcp-oauth-checklist`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/leaderboard`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/leaderboard/impersonation`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    { url: `${SITE_URL}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...DOCS.map((d) => ({
      url: `${SITE_URL}/docs/${d.id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/cve`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...loadAllCves().map((c) => ({
      url: `${SITE_URL}/cve/${c.id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/bench`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/scanning`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/legitimate-interest-assessment`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]

  // 1,473 leaderboard/<slug> pages, one per graded MCP server. They are
  // the deepest long-tail SEO surface the project has — every host name
  // becomes a search query a security person might type.
  const snapshot = await loadLeaderboardSnapshot()
  const leaderboardEntries: MetadataRoute.Sitemap = snapshot
    ? snapshot.entries.map((e) => ({
        url: `${SITE_URL}/leaderboard/${e.slug}`,
        lastModified: snapshot.capturedAt ? new Date(snapshot.capturedAt) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    : []

  return [...base, ...leaderboardEntries]
}

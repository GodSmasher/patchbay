import type { MetadataRoute } from 'next'
import { POSTS } from './blog/_data'
import { DOCS } from './docs/_data'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const posts = POSTS.filter((p) => !p.draft)

  return [
    { url: `${SITE_URL}/scan`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: SITE_URL, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/mcp-oauth-checklist`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
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
    { url: `${SITE_URL}/bench`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]
}

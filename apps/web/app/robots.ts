import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // API routes and one-off shared runs carry no search value.
        disallow: ['/api/', '/share/', '/unsubscribed'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}

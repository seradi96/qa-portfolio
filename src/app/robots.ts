import type { MetadataRoute } from 'next'

/**
 * /invite and /moderate are capability URLs handed out by hand, so keep them out of
 * search results. This is hygiene, not a security control: the capability lives in
 * the URL fragment, which never reaches a server or a crawler at all (spec §9.1).
 *
 * No `sitemap` key — this repo has no sitemap route, and pointing robots.txt at a
 * 404 is worse than saying nothing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/invite', '/moderate'],
    },
  }
}

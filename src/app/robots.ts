import type { MetadataRoute } from 'next'

/**
 * /invite is a capability URL handed out by hand and /admin is the owner's own page, so keep
 * both out of search results. This is hygiene, not a security control: the invite capability
 * lives in the URL fragment, which never reaches a server or a crawler at all, and /admin is
 * gated by a signed session cookie regardless of what robots.txt says.
 *
 * No `sitemap` key — this repo has no sitemap route, and pointing robots.txt at a
 * 404 is worse than saying nothing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/invite', '/admin'],
    },
  }
}

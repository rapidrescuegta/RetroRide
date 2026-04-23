import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/settings/', '/play/', '/local/'],
      },
    ],
    sitemap: 'https://www.gamebuddi.com/sitemap.xml',
    host: 'https://www.gamebuddi.com',
  }
}

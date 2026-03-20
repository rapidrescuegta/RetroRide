import type { Metadata, Viewport } from 'next'
import './globals.css'
import { FamilyProvider } from '@/lib/family-context'

export const metadata: Metadata = {
  title: 'RetroRide — Classic Arcade Games',
  description: '25+ classic arcade games with family leaderboards. Perfect for road trips and flights!',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RetroRide',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a1a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased">
        <FamilyProvider>
          {children}
        </FamilyProvider>
      </body>
    </html>
  )
}

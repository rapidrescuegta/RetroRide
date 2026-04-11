import type { Metadata, Viewport } from 'next'
import './globals.css'
import { FamilyProvider } from '@/lib/family-context'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import InstallPrompt from '@/components/InstallPrompt'
import UpdateToast from '@/components/UpdateToast'
import OfflineIndicator from '@/components/OfflineIndicator'

export const metadata: Metadata = {
  title: 'GameBuddi — Classic Arcade Games',
  description: '35+ classic arcade and card games playable offline. Perfect for road trips, flights, and family game nights!',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GameBuddi',
    startupImage: '/icon-512.png',
  },
  applicationName: 'GameBuddi',
  keywords: ['games', 'arcade', 'offline', 'pwa', 'retro', 'classic', 'snake', 'tetris', 'pac-man', 'chess', 'card games'],
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#0a0a1a',
    'msapplication-tap-highlight': 'no',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a1a',
  viewportFit: 'cover',
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
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className="antialiased">
        <FamilyProvider>
          {children}
        </FamilyProvider>
        <ServiceWorkerRegistration />
        <UpdateToast />
        <OfflineIndicator />
        <InstallPrompt />
      </body>
    </html>
  )
}

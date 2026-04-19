// Next.js 16 prerenders an internal /_global-error page. Without a custom
// global-error component, it renders the root layout (which mounts client
// providers like FamilyProvider) and fails the static export. Providing a
// minimal server-rendered fallback here bypasses that layout and unblocks
// builds.
//
// This is only shown for unrecoverable errors above the root layout (rare).
// Users can recover by refreshing or navigating back to "/".

// Next 16 requires `'use client'` on global-error. We keep it minimal (no
// context, no client providers) so the prerender path only touches React
// itself — avoiding the root layout's FamilyProvider.
'use client'

interface GlobalErrorProps {
  error: Error & { digest?: string }
}

const bodyStyle: React.CSSProperties = {
  margin: 0,
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  background: '#0a0a1a',
  color: '#fff',
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.5rem',
  background: '#7c3aed',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  textDecoration: 'none',
}

export default function GlobalError({ error }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body style={bodyStyle}>
        <div style={{ maxWidth: 420, padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎮</div>
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#94a3b8',
              margin: '0 0 1.5rem',
            }}
          >
            RetroRide hit an unexpected error. Refresh the page or head back home.
          </p>
          <a href="/" style={buttonStyle}>
            Back to Games
          </a>
          {error?.digest && (
            <p
              style={{
                marginTop: '1.5rem',
                fontSize: '0.7rem',
                color: '#475569',
                fontFamily: 'monospace',
              }}
            >
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}

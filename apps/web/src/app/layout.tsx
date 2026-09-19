import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AppleFamily Tree',
  description: 'La red social familiar y árbol genealógico interactivo. Conecta generaciones, comparte logros y preserva memorias.',
  keywords: 'árbol genealógico, familia, red social familiar, genealogía interactiva',
  authors: [{ name: 'AppleFamily Tree' }],
  manifest: '/manifest.json',
  openGraph: {
    title: 'AppleFamily Tree',
    description: 'Conecta tu familia a través de generaciones',
    type: 'website',
    images: [{ url: '/assets/logo.png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'AppleFamily',
    statusBarStyle: 'black-translucent',
  },
  // Fuerza a iOS/Android a usar los tamaños específicos que servimos en /public
  icons: {
    icon: [
      { url: '/icon.png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport = {
  themeColor: '#1E2A22',
}

// Runs before React hydrates: reads the saved theme from localStorage and
// stamps data-theme on <html> so the first paint already matches. Without
// this the page flashes dark→light on load for light-mode users.
const THEME_INIT = `
(function(){try{
  var t = localStorage.getItem('apple_theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
}catch(e){}})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}

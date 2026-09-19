import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AppleFamily Tree',
  description: 'La red social familiar y árbol genealógico interactivo. Conecta generaciones, comparte logros y preserva memorias.',
  keywords: 'árbol genealógico, familia, red social familiar, genealogía interactiva',
  authors: [{ name: 'AppleFamily Tree' }],
  openGraph: {
    title: 'AppleFamily Tree',
    description: 'Conecta tu familia a través de generaciones',
    type: 'website',
    images: [{ url: '/assets/logo.png' }],
  },
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

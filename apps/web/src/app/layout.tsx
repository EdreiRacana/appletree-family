import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AppleTree Family — Your Roots, Connected',
  description: 'La red social familiar y árbol genealógico interactivo. Conecta generaciones, comparte logros y preserva memorias.',
  keywords: 'árbol genealógico, familia, red social familiar, genealogía interactiva',
  authors: [{ name: 'AppleTree Family' }],
  openGraph: {
    title: 'AppleTree Family',
    description: 'Conecta tu familia a través de generaciones',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}

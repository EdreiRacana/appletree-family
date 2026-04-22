import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AppleFamily Tree — Cultivating Roots, Celebrating Legacies',
  description: 'La red social familiar y árbol genealógico interactivo. Conecta generaciones, comparte logros y preserva memorias.',
  keywords: 'árbol genealógico, familia, red social familiar, genealogía interactiva',
  authors: [{ name: 'AppleFamily Tree' }],
  openGraph: {
    title: 'AppleFamily Tree',
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

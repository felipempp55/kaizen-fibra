import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kaizen Fibra — Apontamento de Desperdícios',
  description: 'Sistema digital de registro de desperdícios no chão de fábrica',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full bg-slate-900 text-slate-100 antialiased">{children}</body>
    </html>
  )
}

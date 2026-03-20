import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lexia — Révision juridique',
  description: 'Plateforme de révision pour étudiants en droit',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}

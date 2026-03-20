'use client'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/useAuth'
export default function DashboardPage() {
  const { loading } = useAuth()
  if (loading) return null
  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <h1 style={{ fontSize: '1.5rem', color: '#0F1B2D', marginBottom: '0.5rem' }}>Dashboard</h1>
        <p style={{ color: '#5A7CA3' }}>Suivi de progression, examens, quotas — bientôt disponible.</p>
      </main>
    </div>
  )
}

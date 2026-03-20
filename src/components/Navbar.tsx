'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const links = [
  { href: '/generateur',  label: 'Générateur'  },
  { href: '/flashcards',  label: 'Flashcards'  },
  { href: '/revision',    label: 'Révision'    },
  { href: '/dashboard',   label: 'Dashboard'   },
]

export default function Navbar() {
  const path   = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header style={{ background: '#0F1B2D', borderBottom: '1px solid #1A3A5C' }}>
      <nav style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '56px',
      }}>
        {/* Logo */}
        <Link href="/generateur" style={{
          color: '#F5F0E8', fontFamily: 'Georgia, serif',
          fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.05em',
          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ color: '#C9A84C' }}>⚖</span> Lexia
        </Link>

        {/* Links */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} style={{
              color: path === l.href ? '#C9A84C' : '#8FA8C8',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '0.88rem',
              fontFamily: 'inherit',
              background: path === l.href ? 'rgba(201,168,76,0.1)' : 'transparent',
              transition: 'color 0.2s, background 0.2s',
            }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{
          background: 'transparent',
          border: '1px solid #2E5480',
          color: '#8FA8C8',
          padding: '5px 12px',
          borderRadius: '4px',
          fontSize: '0.82rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'border-color 0.2s, color 0.2s',
        }}>
          Déconnexion
        </button>
      </nav>
    </header>
  )
}

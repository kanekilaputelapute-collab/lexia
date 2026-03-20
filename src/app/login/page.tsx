'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [mode,     setMode]     = useState<'login' | 'signup'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [level,    setLevel]    = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        if (data.user) {
          // Créer le profil
          await supabase.from('profiles').upsert({
            id: data.user.id, email, full_name: name, level,
          })
          setSuccess('Compte créé ! Vérifie ton email puis connecte-toi.')
          setMode('login')
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        router.push('/generateur')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0F1B2D',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚖</div>
          <h1 style={{
            fontFamily: 'Georgia, serif', color: '#F5F0E8',
            fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.08em',
            margin: 0,
          }}>LEXIA</h1>
          <p style={{ color: '#5A7CA3', fontSize: '0.85rem', marginTop: '4px' }}>
            Révision juridique augmentée
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#F5F0E8', borderRadius: '8px',
          padding: '2rem', border: '1px solid #1A3A5C',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', marginBottom: '1.5rem', borderBottom: '1px solid #DDD5C4' }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                style={{
                  flex: 1, padding: '0.6rem',
                  background: 'transparent', border: 'none',
                  borderBottom: mode === m ? '2px solid #C9A84C' : '2px solid transparent',
                  color: mode === m ? '#0F1B2D' : '#8FA8C8',
                  fontFamily: 'inherit', fontSize: '0.9rem',
                  cursor: 'pointer', fontWeight: mode === m ? 600 : 400,
                  transition: 'color 0.2s',
                }}>
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {mode === 'signup' && (
              <div>
                <label style={{ fontSize: '0.82rem', color: '#2E5480', display: 'block', marginBottom: '4px' }}>
                  Nom complet
                </label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Jean Dupont" required
                  style={inputStyle} />
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.82rem', color: '#2E5480', display: 'block', marginBottom: '4px' }}>
                Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="jean@exemple.fr" required
                style={inputStyle} />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', color: '#2E5480', display: 'block', marginBottom: '4px' }}>
                Mot de passe
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={6}
                style={inputStyle} />
            </div>

            {mode === 'signup' && (
              <div>
                <label style={{ fontSize: '0.82rem', color: '#2E5480', display: 'block', marginBottom: '4px' }}>
                  Niveau
                </label>
                <select value={level} onChange={e => setLevel(e.target.value as typeof level)}
                  style={inputStyle}>
                  <option value="beginner">Débutant (L1-L2)</option>
                  <option value="intermediate">Intermédiaire (L3-M1)</option>
                  <option value="advanced">Avancé (M2-Barreau)</option>
                </select>
              </div>
            )}

            {error   && <p style={{ color: '#C4544A', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
            {success && <p style={{ color: '#4A7C59', fontSize: '0.85rem', margin: 0 }}>{success}</p>}

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '0.5rem' }}>
              {loading ? 'Chargement…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.8rem',
  border: '1px solid #C8D4E3',
  borderRadius: '4px',
  fontFamily: 'inherit',
  fontSize: '0.9rem',
  background: '#FFFDF8',
  color: '#0F1B2D',
  outline: 'none',
}

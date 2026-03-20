'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { generate } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

type Mode = 'summary' | 'qcm'
type Difficulty = 'beginner' | 'intermediate' | 'advanced'

interface QCMQuestion {
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

// ── Sous-composant : affichage résumé markdown simple
function SummaryOutput({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="prose-law animate-fade-up">
      {lines.map((line, i) => {
        if (line.startsWith('# '))  return <h1 key={i}>{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>
        if (line.startsWith('### '))return <h3 key={i}>{line.slice(4)}</h3>
        if (line.startsWith('- '))  return <li key={i} style={{ marginLeft: '1rem' }}>{renderInline(line.slice(2))}</li>
        if (line.trim() === '')     return <br key={i} />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  )
}

// ── Sous-composant : QCM interactif
function QCMOutput({ questions }: { questions: QCMQuestion[] }) {
  const [answers,  setAnswers]  = useState<Record<number, number>>({})
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const score = Object.entries(answers).filter(
    ([i, a]) => questions[+i]?.correct_index === a
  ).length

  function answer(qi: number, ai: number) {
    if (revealed[qi]) return
    setAnswers(prev => ({ ...prev, [qi]: ai }))
    setRevealed(prev => ({ ...prev, [qi]: true }))
  }

  const allAnswered = Object.keys(revealed).length === questions.length

  return (
    <div className="animate-fade-up">
      {allAnswered && (
        <div style={{
          background: score === questions.length ? '#E8F2EB' : '#FFF7ED',
          border: `1px solid ${score === questions.length ? '#4A7C59' : '#C9A84C'}`,
          borderRadius: '6px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '1.5rem' }}>{score === questions.length ? '🏆' : '📖'}</span>
          <div>
            <div style={{ fontWeight: 700, color: '#0F1B2D' }}>
              {score} / {questions.length} correct{score > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#5A7CA3' }}>
              {score === questions.length
                ? 'Parfait ! Toutes les réponses sont correctes.'
                : 'Relis les explications pour consolider tes connaissances.'}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {questions.map((q, qi) => {
          const isAnswered = revealed[qi]
          const chosen     = answers[qi]
          return (
            <div key={qi} className="card" style={{ padding: '1.25rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '0.95rem' }}>
                <span style={{ color: '#C9A84C', marginRight: '8px' }}>{qi + 1}.</span>
                {q.question}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.options.map((opt, ai) => {
                  let bg = '#FFFDF8', border = '#DDD5C4', color = '#0F1B2D'
                  if (isAnswered) {
                    if (ai === q.correct_index) { bg = '#E8F2EB'; border = '#4A7C59'; color = '#1A4D2E' }
                    else if (ai === chosen)     { bg = '#FAEAE9'; border = '#C4544A'; color = '#7A2020' }
                    else { color = '#8FA8C8' }
                  }
                  return (
                    <button key={ai} onClick={() => answer(qi, ai)} style={{
                      background: bg, border: `1px solid ${border}`,
                      borderRadius: '4px', padding: '0.6rem 0.9rem',
                      textAlign: 'left', cursor: isAnswered ? 'default' : 'pointer',
                      fontFamily: 'inherit', fontSize: '0.88rem', color,
                      transition: 'all 0.2s',
                    }}>
                      {opt}
                    </button>
                  )
                })}
              </div>
              {isAnswered && (
                <div style={{
                  marginTop: '0.75rem', padding: '0.6rem 0.8rem',
                  background: '#F0F3F7', borderRadius: '4px',
                  fontSize: '0.83rem', color: '#2E5480', lineHeight: 1.6,
                }}>
                  <strong>Explication :</strong> {q.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page principale
export default function GenerateurPage() {
  const { loading: authLoading } = useAuth()

  const [mode,       setMode]       = useState<Mode>('summary')
  const [prompt,     setPrompt]     = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [result,     setResult]     = useState<unknown>(null)
  const [llmUsed,    setLlmUsed]    = useState('')
  const [cached,     setCached]     = useState(false)

  if (authLoading) return <LoadingScreen />

  async function handleGenerate() {
    if (!prompt.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await generate({ task_type: mode, prompt, difficulty })
      setResult(data.result)
      setLlmUsed(data.llm_used)
      setCached(data.cached)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const examples: Record<Mode, string[]> = {
    summary: [
      'La responsabilité civile délictuelle : conditions et régime',
      'Le contrat de vente : formation et effets',
      'Les droits fondamentaux en droit constitutionnel français',
    ],
    qcm: [
      'La formation du contrat en droit civil français',
      'Les causes d\'irresponsabilité pénale',
      'Le contentieux administratif : juridictions et recours',
    ],
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      <Navbar />

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0F1B2D', margin: '0 0 4px' }}>
            Générateur IA
          </h1>
          <p style={{ color: '#5A7CA3', fontSize: '0.9rem', margin: 0 }}>
            Résumés structurés et QCM générés par l'IA, adaptés à ton niveau.
          </p>
        </div>

        {/* Mode tabs */}
        <div style={{
          display: 'flex', gap: '8px', marginBottom: '1.5rem',
          borderBottom: '1px solid #DDD5C4', paddingBottom: '0',
        }}>
          {([['summary', '📄 Résumé'], ['qcm', '✅ QCM']] as [Mode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setResult(null); setError('') }}
              style={{
                padding: '0.6rem 1.2rem',
                background: 'transparent', border: 'none',
                borderBottom: mode === m ? '2px solid #C9A84C' : '2px solid transparent',
                color: mode === m ? '#0F1B2D' : '#8FA8C8',
                fontFamily: 'inherit', fontSize: '0.9rem',
                cursor: 'pointer', fontWeight: mode === m ? 600 : 400,
                transition: 'color 0.2s', marginBottom: '-1px',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Input zone */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.82rem', color: '#2E5480', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              {mode === 'summary' ? 'Sujet ou contenu à résumer' : 'Thème du QCM'}
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={mode === 'summary'
                ? 'Ex : La responsabilité civile délictuelle, ses conditions (faute, préjudice, lien de causalité) et son régime en droit français…'
                : 'Ex : La formation du contrat en droit civil — offre, acceptation, vices du consentement…'
              }
              rows={4}
              style={{
                width: '100%', padding: '0.75rem',
                border: '1px solid #C8D4E3', borderRadius: '4px',
                fontFamily: 'inherit', fontSize: '0.9rem',
                background: '#FFFDF8', color: '#0F1B2D',
                resize: 'vertical', outline: 'none', lineHeight: 1.7,
              }}
            />
          </div>

          {/* Options */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.82rem', color: '#2E5480', fontWeight: 600 }}>Niveau</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
                style={{
                  padding: '0.4rem 0.7rem', border: '1px solid #C8D4E3',
                  borderRadius: '4px', fontFamily: 'inherit', fontSize: '0.85rem',
                  background: '#FFFDF8', color: '#0F1B2D', outline: 'none',
                }}>
                <option value="beginner">Débutant</option>
                <option value="intermediate">Intermédiaire</option>
                <option value="advanced">Avancé</option>
              </select>
            </div>

            <button onClick={handleGenerate} disabled={loading || !prompt.trim()}
              className="btn-primary" style={{ marginLeft: 'auto', minWidth: '140px' }}>
              {loading
                ? <span className="animate-pulse-gold">Génération…</span>
                : mode === 'summary' ? '📄 Générer le résumé' : '✅ Générer le QCM'
              }
            </button>
          </div>
        </div>

        {/* Exemples */}
        {!result && !loading && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: '#8FA8C8', marginBottom: '8px' }}>Exemples de sujets :</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {examples[mode].map((ex, i) => (
                <button key={i} onClick={() => setPrompt(ex)} style={{
                  padding: '5px 12px', border: '1px solid #C8D4E3',
                  borderRadius: '99px', background: '#FFFDF8',
                  fontSize: '0.8rem', color: '#2E5480', cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.2s, border-color 0.2s',
                }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div style={{
            background: '#FAEAE9', border: '1px solid #C4544A',
            borderRadius: '6px', padding: '0.9rem 1.1rem',
            color: '#7A2020', fontSize: '0.88rem', marginBottom: '1rem',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="card" style={{ padding: '2rem' }}>
            {[100, 80, 95, 70, 85].map((w, i) => (
              <div key={i} style={{
                height: '14px', background: '#DDD5C4', borderRadius: '4px',
                width: `${w}%`, marginBottom: '12px', opacity: 0.6,
                animation: `pulse-gold ${1 + i * 0.15}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        )}

        {/* Résultat */}
        {result && !loading && (
          <div>
            {/* Meta bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '0.75rem',
            }}>
              <span className={`llm-badge ${llmUsed}`}>{llmUsed}</span>
              {cached && <span className="llm-badge cached">⚡ cache</span>}
              <span style={{ fontSize: '0.78rem', color: '#8FA8C8', marginLeft: 'auto' }}>
                {mode === 'summary' ? 'Résumé généré' : `${(result as QCMQuestion[]).length} questions`}
              </span>

              <button onClick={() => {
                const txt = mode === 'summary' ? (result as string) : JSON.stringify(result, null, 2)
                navigator.clipboard.writeText(txt)
              }} className="btn-ghost" style={{ fontSize: '0.78rem', padding: '3px 10px' }}>
                Copier
              </button>
            </div>

            {/* Output */}
            <div className="card">
              {mode === 'summary'
                ? <SummaryOutput text={result as string} />
                : <QCMOutput questions={result as QCMQuestion[]} />
              }
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setResult(null); setPrompt('') }} className="btn-ghost">
                Nouveau
              </button>
              <button onClick={handleGenerate} className="btn-ghost">
                ↺ Regénérer
              </button>
              {mode === 'summary' && (
                <button className="btn-primary" style={{ fontSize: '0.85rem' }}
                  onClick={() => alert('Module flashcards bientôt disponible !')}>
                  → Créer des flashcards
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', background: '#F5F0E8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ color: '#C9A84C', fontSize: '1rem' }} className="animate-pulse-gold">
        Chargement…
      </span>
    </div>
  )
}

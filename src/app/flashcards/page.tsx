'use client'
import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { generate } from '@/lib/api'

type Rating = 'again' | 'hard' | 'good' | 'easy'
type View = 'home' | 'study' | 'done'

interface Flashcard {
  id: string
  question: string
  answer: string
  tags: string[]
  deck_id: string
  due_date: string
  interval_days: number
  repetitions: number
}

interface Deck {
  id: string
  name: string
  created_at: string
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL!

async function getJWT() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function reviewCard(flashcard_id: string, rating: Rating) {
  const jwt = await getJWT()
  await fetch(`${WORKER_URL}/api/flashcard/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
    body: JSON.stringify({ flashcard_id, rating }),
  })
}

const RATINGS: { value: Rating; label: string; color: string; bg: string; key: string }[] = [
  { value: 'again', label: 'À revoir',  color: '#C4544A', bg: '#FAEAE9', key: '1' },
  { value: 'hard',  label: 'Difficile', color: '#C9A84C', bg: '#FFF8E8', key: '2' },
  { value: 'good',  label: 'Bien',      color: '#4A7C59', bg: '#E8F2EB', key: '3' },
  { value: 'easy',  label: 'Facile',    color: '#2E5480', bg: '#EEF4FF', key: '4' },
]

// ─── Study Session ────────────────────────────────────────────────────────────
function StudySession({ cards, onFinish }: { cards: Flashcard[]; onFinish: () => void }) {
  const [index,   setIndex]   = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done,    setDone]    = useState<Rating[]>([])
  const [loading, setLoading] = useState(false)

  const card     = cards[index]
  const progress = Math.round((index / cards.length) * 100)
  const counts   = { again: 0, hard: 0, good: 0, easy: 0 }
  done.forEach(r => counts[r]++)

  const handleRating = useCallback(async (rating: Rating) => {
    if (!flipped || loading) return
    setLoading(true)
    try {
      await reviewCard(card.id, rating)
      setDone(prev => [...prev, rating])
      if (index + 1 >= cards.length) { onFinish() }
      else { setIndex(i => i + 1); setFlipped(false) }
    } finally { setLoading(false) }
  }, [card, flipped, index, loading, onFinish])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(true) }
      if (!flipped) return
      const r = RATINGS.find(r => r.key === e.key)
      if (r) handleRating(r.value)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, handleRating])

  if (!card) return null

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Progress */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.82rem', color: '#5A7CA3' }}>{index + 1} / {cards.length}</span>
          <span style={{ fontSize: '0.82rem', color: '#5A7CA3' }}>{progress}%</span>
        </div>
        <div style={{ height: '4px', background: '#DDD5C4', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, #C9A84C, #4A7C59)',
            borderRadius: '99px', transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Tags */}
      {card.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {card.tags.map(t => (
            <span key={t} style={{
              fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px',
              background: '#EEF4FF', color: '#2E5480', border: '1px solid #C8D4E3',
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* Card */}
      <div onClick={() => !flipped && setFlipped(true)} style={{
        background: '#FFFDF8', border: '1px solid #DDD5C4',
        borderRadius: '12px', padding: '2.5rem 2rem', minHeight: '260px',
        cursor: flipped ? 'default' : 'pointer',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', textAlign: 'center',
        boxShadow: flipped ? '0 4px 20px rgba(15,27,45,0.08)' : '0 2px 8px rgba(15,27,45,0.04)',
        transition: 'box-shadow 0.2s',
      }}>
        <div style={{ width: '100%' }}>
          <p style={{ fontSize: '0.72rem', color: '#8FA8C8', marginBottom: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Question
          </p>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.7, color: '#0F1B2D', fontWeight: 500, margin: 0 }}>
            {card.question}
          </p>
        </div>

        {flipped ? (
          <div className="animate-fade-up" style={{
            width: '100%', marginTop: '1.5rem',
            paddingTop: '1.5rem', borderTop: '1px solid #DDD5C4',
          }}>
            <p style={{ fontSize: '0.72rem', color: '#4A7C59', marginBottom: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Réponse
            </p>
            <p style={{ fontSize: '1rem', lineHeight: 1.8, color: '#1A3A5C', margin: 0 }}>
              {card.answer}
            </p>
          </div>
        ) : (
          <div style={{ marginTop: '1.5rem' }}>
            <span style={{
              fontSize: '0.82rem', color: '#8FA8C8',
              border: '1px dashed #C8D4E3', padding: '4px 14px', borderRadius: '99px',
            }}>
              Cliquer ou [Espace] pour révéler
            </span>
          </div>
        )}
      </div>

      {/* Ratings */}
      {flipped && (
        <div className="animate-fade-up" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px', marginTop: '1.25rem',
        }}>
          {RATINGS.map(r => (
            <button key={r.value} onClick={() => handleRating(r.value)} disabled={loading} style={{
              padding: '0.7rem 0.5rem',
              background: r.bg, border: `1px solid ${r.color}44`,
              borderRadius: '6px', cursor: 'pointer',
              fontFamily: 'inherit', color: r.color,
              fontSize: '0.85rem', fontWeight: 600,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              opacity: loading ? 0.6 : 1, transition: 'transform 0.1s',
            }}>
              {r.label}
              <span style={{ fontSize: '0.68rem', fontWeight: 400, opacity: 0.7 }}>[{r.key}]</span>
            </button>
          ))}
        </div>
      )}

      {/* Mini stats */}
      {done.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '1rem', justifyContent: 'center', fontSize: '0.78rem' }}>
          {RATINGS.map(r => counts[r.value] > 0 && (
            <span key={r.value} style={{ color: r.color }}>{r.label} : {counts[r.value]}</span>
          ))}
        </div>
      )}

      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#C8D4E3', marginTop: '1rem' }}>
        Espace = révéler · 1/2/3/4 = noter
      </p>
    </div>
  )
}

// ─── Generate Modal ───────────────────────────────────────────────────────────
function GenerateModal({ decks, onClose, onCreated }: { decks: Deck[]; onClose: () => void; onCreated: () => void }) {
  const [prompt,     setPrompt]     = useState('')
  const [deckId,     setDeckId]     = useState(decks[0]?.id ?? '')
  const [newDeck,    setNewDeck]    = useState('')
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  async function handleGenerate() {
    if (!prompt.trim()) return
    setLoading(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      let targetDeckId = deckId
      if (!targetDeckId || newDeck.trim()) {
        const { data, error: e } = await supabase.from('flashcard_decks').insert({
          name: newDeck.trim() || 'Nouveau deck', user_id: user.id,
        }).select().single()
        if (e) throw e
        targetDeckId = data.id
      }

      const res   = await generate({ task_type: 'flashcard', prompt, difficulty })
      const cards = Array.isArray(res.result) ? res.result : []
      if (!cards.length) throw new Error('Aucune flashcard générée')

      const rows = cards.map((c: { question: string; answer: string; tags?: string[] }) => ({
        deck_id: targetDeckId, user_id: user.id,
        question: c.question, answer: c.answer,
        tags: c.tags ?? [],
        due_date: new Date().toISOString().split('T')[0],
      }))
      const { error: insertErr } = await supabase.from('flashcards').insert(rows)
      if (insertErr) throw insertErr

      onCreated(); onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,27,45,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.05rem', color: '#0F1B2D', margin: 0 }}>✨ Générer des flashcards par IA</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#8FA8C8' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={lbl}>Sujet</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Ex : Les vices du consentement — erreur, dol, violence (art. 1130 C.civ)"
              rows={3} style={inp} />
          </div>
          <div>
            <label style={lbl}>Deck</label>
            <select value={deckId} onChange={e => setDeckId(e.target.value)} style={inp}>
              <option value="">+ Créer un nouveau deck</option>
              {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {!deckId && (
            <div>
              <label style={lbl}>Nom du nouveau deck</label>
              <input value={newDeck} onChange={e => setNewDeck(e.target.value)} placeholder="Ex : Droit des contrats" style={inp} />
            </div>
          )}
          <div>
            <label style={lbl}>Niveau</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)} style={inp}>
              <option value="beginner">Débutant</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="advanced">Avancé</option>
            </select>
          </div>
          {error && <p style={{ color: '#C4544A', fontSize: '0.85rem', margin: 0 }}>⚠ {error}</p>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-ghost">Annuler</button>
            <button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="btn-primary">
              {loading ? 'Génération…' : 'Générer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create Manual Modal ──────────────────────────────────────────────────────
function CreateModal({ decks, onClose, onCreated }: { decks: Deck[]; onClose: () => void; onCreated: () => void }) {
  const [question, setQuestion] = useState('')
  const [answer,   setAnswer]   = useState('')
  const [deckId,   setDeckId]   = useState(decks[0]?.id ?? '')
  const [newDeck,  setNewDeck]  = useState('')
  const [tags,     setTags]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleCreate() {
    if (!question.trim() || !answer.trim()) return
    setLoading(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      let targetDeckId = deckId
      if (!targetDeckId || newDeck.trim()) {
        const { data, error: e } = await supabase.from('flashcard_decks').insert({
          name: newDeck.trim() || 'Nouveau deck', user_id: user.id,
        }).select().single()
        if (e) throw e
        targetDeckId = data.id
      }
      const { error: e } = await supabase.from('flashcards').insert({
        deck_id: targetDeckId, user_id: user.id,
        question: question.trim(), answer: answer.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        due_date: new Date().toISOString().split('T')[0],
      })
      if (e) throw e
      onCreated(); onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,27,45,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.05rem', color: '#0F1B2D', margin: 0 }}>Nouvelle flashcard</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#8FA8C8' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label style={lbl}>Question</label><textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ex : Quelles sont les conditions de la responsabilité délictuelle ?" rows={2} style={inp} /></div>
          <div><label style={lbl}>Réponse</label><textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Ex : Faute, préjudice, lien de causalité (art. 1240 C.civ)" rows={3} style={inp} /></div>
          <div>
            <label style={lbl}>Deck</label>
            <select value={deckId} onChange={e => setDeckId(e.target.value)} style={inp}>
              <option value="">+ Créer un nouveau deck</option>
              {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {!deckId && <div><label style={lbl}>Nom du deck</label><input value={newDeck} onChange={e => setNewDeck(e.target.value)} placeholder="Ex : Droit civil" style={inp} /></div>}
          <div><label style={lbl}>Tags (virgule-séparés)</label><input value={tags} onChange={e => setTags(e.target.value)} placeholder="Ex : responsabilité, art.1240" style={inp} /></div>
          {error && <p style={{ color: '#C4544A', fontSize: '0.85rem', margin: 0 }}>⚠ {error}</p>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-ghost">Annuler</button>
            <button onClick={handleCreate} disabled={loading || !question.trim() || !answer.trim()} className="btn-primary">
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FlashcardsPage() {
  const { loading: authLoading } = useAuth()
  const [view,         setView]         = useState<View>('home')
  const [decks,        setDecks]        = useState<Deck[]>([])
  const [dueCards,     setDueCards]     = useState<Flashcard[]>([])
  const [studyCards,   setStudyCards]   = useState<Flashcard[]>([])
  const [showGenerate, setShowGenerate] = useState(false)
  const [showCreate,   setShowCreate]   = useState(false)
  const [dataLoading,  setDataLoading]  = useState(true)

  const loadData = useCallback(async () => {
    setDataLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = new Date().toISOString().split('T')[0]
      const [{ data: deckData }, { data: dueData }] = await Promise.all([
        supabase.from('flashcard_decks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('flashcards').select('*').eq('user_id', user.id).lte('due_date', today),
      ])
      setDecks(deckData ?? [])
      setDueCards(dueData ?? [])
    } finally { setDataLoading(false) }
  }, [])

  useEffect(() => { if (!authLoading) loadData() }, [authLoading, loadData])

  async function startStudy(deckId?: string) {
    const today = new Date().toISOString().split('T')[0]
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let q = supabase.from('flashcards').select('*').eq('user_id', user.id).lte('due_date', today)
    if (deckId) q = q.eq('deck_id', deckId)
    const { data } = await q.limit(20)
    if (!data?.length) return
    setStudyCards(data)
    setView('study')
  }

  if (authLoading || dataLoading) return <Loader />

  if (view === 'study' && studyCards.length > 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
        <Navbar />
        <div style={{ padding: '1.5rem 0' }}>
          <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 1rem' }}>
            <button onClick={() => { setView('home'); loadData() }} style={{ background: 'none', border: 'none', color: '#5A7CA3', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ← Arrêter la session
            </button>
          </div>
          <StudySession cards={studyCards} onFinish={() => setView('done')} />
        </div>
      </div>
    )
  }

  if (view === 'done') {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
        <Navbar />
        <div style={{ maxWidth: '500px', margin: '5rem auto', textAlign: 'center', padding: '0 1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
          <h2 style={{ fontSize: '1.4rem', color: '#0F1B2D', marginBottom: '0.5rem' }}>Session terminée !</h2>
          <p style={{ color: '#5A7CA3', marginBottom: '2rem' }}>
            Tu as révisé {studyCards.length} flashcard{studyCards.length > 1 ? 's' : ''}. Continue comme ça !
          </p>
          <button onClick={() => { setView('home'); loadData() }} className="btn-primary">← Retour aux decks</button>
        </div>
      </div>
    )
  }

  const totalDue = dueCards.length

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      <Navbar />
      {showGenerate && <GenerateModal decks={decks} onClose={() => setShowGenerate(false)} onCreated={loadData} />}
      {showCreate   && <CreateModal   decks={decks} onClose={() => setShowCreate(false)}   onCreated={loadData} />}

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0F1B2D', margin: '0 0 4px' }}>Flashcards</h1>
            <p style={{ color: '#5A7CA3', fontSize: '0.9rem', margin: 0 }}>Révision espacée · Algorithme SM-2</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowCreate(true)} className="btn-ghost" style={{ fontSize: '0.85rem' }}>+ Manuel</button>
            <button onClick={() => setShowGenerate(true)} className="btn-primary" style={{ fontSize: '0.85rem' }}>✨ Générer par IA</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '2rem' }}>
          {[
            { label: "À réviser aujourd'hui", value: totalDue, color: totalDue > 0 ? '#C4544A' : '#4A7C59' },
            { label: 'Decks créés',           value: decks.length, color: '#2E5480' },
            { label: 'Total cartes',          value: dueCards.length, color: '#0F1B2D' },
          ].map(s => (
            <div key={s.label} style={{ background: '#FFFDF8', border: '1px solid #DDD5C4', borderRadius: '8px', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#8FA8C8', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: s.color, fontFamily: 'Georgia, serif' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* CTA révision globale */}
        {totalDue > 0 && (
          <div style={{
            background: '#0F1B2D', borderRadius: '8px', padding: '1.25rem 1.5rem',
            marginBottom: '2rem', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
          }}>
            <div>
              <p style={{ color: '#C9A84C', fontWeight: 700, margin: '0 0 2px', fontSize: '0.95rem' }}>
                {totalDue} carte{totalDue > 1 ? 's' : ''} à réviser maintenant
              </p>
              <p style={{ color: '#5A7CA3', fontSize: '0.82rem', margin: 0 }}>
                Durée estimée : ~{Math.ceil(totalDue * 0.5)} minutes
              </p>
            </div>
            <button onClick={() => startStudy()} className="btn-primary" style={{ background: '#C9A84C', color: '#0F1B2D', fontWeight: 700 }}>
              Commencer →
            </button>
          </div>
        )}

        {/* Decks */}
        <h2 style={{ fontSize: '1rem', color: '#2E5480', marginBottom: '1rem', fontWeight: 600 }}>Mes decks</h2>

        {decks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed #C8D4E3', borderRadius: '8px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🃏</div>
            <p style={{ color: '#8FA8C8', margin: '0 0 1.5rem' }}>Aucun deck pour l'instant.</p>
            <button onClick={() => setShowGenerate(true)} className="btn-primary" style={{ fontSize: '0.85rem' }}>
              Créer mon premier deck avec l'IA
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
            {decks.map(deck => {
              const deckDue = dueCards.filter(c => c.deck_id === deck.id).length
              return (
                <div key={deck.id} className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0F1B2D', margin: 0 }}>{deck.name}</h3>
                    {deckDue > 0 && (
                      <span style={{ background: '#FAEAE9', color: '#C4544A', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {deckDue} due
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#8FA8C8', margin: '0 0 1rem' }}>
                    Créé le {new Date(deck.created_at).toLocaleDateString('fr-FR')}
                  </p>
                  <button onClick={() => startStudy(deck.id)} disabled={deckDue === 0}
                    className={deckDue > 0 ? 'btn-primary' : 'btn-ghost'}
                    style={{ width: '100%', fontSize: '0.85rem', opacity: deckDue === 0 ? 0.5 : 1 }}>
                    {deckDue > 0 ? `Réviser (${deckDue})` : '✓ À jour'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="animate-pulse-gold" style={{ color: '#C9A84C' }}>Chargement…</span>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: '0.82rem', color: '#2E5480', display: 'block', marginBottom: '5px', fontWeight: 600 }
const inp: React.CSSProperties = { width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #C8D4E3', borderRadius: '4px', fontFamily: 'inherit', fontSize: '0.9rem', background: '#FFFDF8', color: '#0F1B2D', outline: 'none', resize: 'vertical' as const }

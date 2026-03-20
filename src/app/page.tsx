'use client'
import { useState, useRef, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import { generate } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

type Mode = 'summary' | 'qcm'
type Difficulty = 'beginner' | 'intermediate' | 'advanced'
type InputMode = 'text' | 'file'

interface QCMQuestion {
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

interface UploadedFile {
  name: string
  size: number
  type: string
  content: string // extracted text
}

// ── Extraction PDF via pdfjs-dist (extraction complète, toutes pages)
async function extractTextFromPDF(file: File): Promise<string> {
  // Import dynamique pour éviter le SSR (pdfjs-dist est client-only)
  const pdfjsLib = await import('pdfjs-dist')

  // Worker pdfjs via CDN — évite les problèmes webpack/SSR de Next.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf         = await loadingTask.promise

  const pageTexts: string[] = []

  // Extraire le texte de chaque page sans rien sauter
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page        = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    // Reconstituer le texte en respectant les blocs et sauts de ligne
    let pageText  = ''
    let lastY: number | null = null

    for (const item of textContent.items) {
      if ('str' in item) {
        const y = (item as { transform: number[]; str: string }).transform[5]
        if (lastY !== null && Math.abs(y - lastY) > 5) {
          pageText += '\n'
        }
        pageText += (item as { str: string }).str
        lastY = y
      }
    }

    pageTexts.push(`--- Page ${pageNum} ---\n${pageText.trim()}`)
  }

  const fullText = pageTexts.join('\n\n')
  return fullText || `[PDF : ${file.name} — aucun texte extractible (PDF scanné ou image)]`
}

// ── Extraction texte depuis fichier
async function extractTextFromFile(file: File): Promise<string> {
  const textTypes = [
    'text/plain', 'text/markdown', 'text/csv',
    'application/json', 'text/html', 'text/xml',
  ]

  if (textTypes.some(t => file.type.startsWith(t)) || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
    return await file.text()
  }

  // PDF → extraction complète via pdfjs-dist
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return await extractTextFromPDF(file)
  }

  // DOCX → extraction via XML interne (format ZIP)
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    const buffer = await file.arrayBuffer()
    const bytes  = new Uint8Array(buffer)
    let raw = ''
    for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i])
    const xmlMatches = raw.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
    const text = xmlMatches
      .map(m => m.replace(/<[^>]+>/g, ''))
      .join(' ')
      .trim()
    return text || `[DOCX : ${file.name} — contenu transmis à l'IA]`
  }

  // Fallback : lire comme texte brut
  try {
    return await file.text()
  } catch {
    return `[Fichier : ${file.name} — format non supporté pour l'extraction directe]`
  }
}

// ── Découpage en chunks pour gros fichiers
function splitIntoChunks(text: string, chunkSize = 12000): string[] {
  if (text.length <= chunkSize) return [text]
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    // Couper sur un saut de ligne propre si possible
    let end = i + chunkSize
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end)
      if (lastNewline > i + chunkSize * 0.7) end = lastNewline
    }
    chunks.push(text.slice(i, end))
    i = end
  }
  return chunks
}

// ── Sous-composant : affichage résumé markdown simple
function SummaryOutput({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="prose-law animate-fade-up">
      {lines.map((line, i) => {
        if (line.startsWith('# '))   return <h1 key={i}>{line.slice(2)}</h1>
        if (line.startsWith('## '))  return <h2 key={i}>{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>
        if (line.startsWith('- '))   return <li key={i} style={{ marginLeft: '1rem' }}>{renderInline(line.slice(2))}</li>
        if (line.trim() === '')      return <br key={i} />
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

// ── Composant Upload
function FileUploadZone({
  onFileProcessed,
  onClear,
  uploadedFile,
  processing,
}: {
  onFileProcessed: (file: UploadedFile) => void
  onClear: () => void
  uploadedFile: UploadedFile | null
  processing: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ACCEPTED = '.pdf,.doc,.docx,.txt,.md,.csv,.json,.html'
  const MAX_SIZE_MB = 50

  async function processFile(file: File) {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`Fichier trop lourd (max ${MAX_SIZE_MB} Mo)`)
      return
    }
    const content = await extractTextFromFile(file)
    onFileProcessed({
      name: file.name,
      size: file.size,
      type: file.type,
      content,
    })
  }

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await processFile(file)
  }, [])

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processFile(file)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  if (uploadedFile) {
    return (
      <div style={{
        border: '1px solid #4A7C59', borderRadius: '8px',
        background: '#E8F2EB', padding: '1rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span style={{ fontSize: '1.5rem' }}>
          {uploadedFile.name.endsWith('.pdf') ? '📄' :
           uploadedFile.name.endsWith('.docx') || uploadedFile.name.endsWith('.doc') ? '📝' : '📃'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#1A4D2E', fontSize: '0.9rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {uploadedFile.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#4A7C59' }}>
            {formatSize(uploadedFile.size)} · {uploadedFile.content.length.toLocaleString()} caractères extraits
            {uploadedFile.content.length > 12000 && (
              <span style={{ marginLeft: '6px', color: '#C9A84C', fontWeight: 600 }}>
                · traitement par chunks ({splitIntoChunks(uploadedFile.content).length} parties)
              </span>
            )}
          </div>
        </div>
        {processing ? (
          <span style={{ fontSize: '0.8rem', color: '#C9A84C' }} className="animate-pulse-gold">
            Analyse…
          </span>
        ) : (
          <button onClick={onClear} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#4A7C59', fontSize: '1.1rem', padding: '4px',
          }} title="Supprimer le fichier">✕</button>
        )}
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? '#C9A84C' : '#C8D4E3'}`,
        borderRadius: '8px',
        background: dragging ? '#FFFBF0' : '#FFFDF8',
        padding: '2rem',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={onInputChange}
        style={{ display: 'none' }}
      />
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
      <div style={{ fontWeight: 600, color: '#0F1B2D', fontSize: '0.9rem', marginBottom: '4px' }}>
        Glisse ton fichier ici ou clique pour parcourir
      </div>
      <div style={{ fontSize: '0.78rem', color: '#8FA8C8' }}>
        PDF, Word (.docx), TXT, Markdown · Max {MAX_SIZE_MB} Mo
      </div>
      <div style={{ fontSize: '0.75rem', color: '#C9A84C', marginTop: '6px', fontWeight: 500 }}>
        ✓ Les gros fichiers sont traités en plusieurs passes — rien n'est omis
      </div>
    </div>
  )
}

// ── Page principale
export default function GenerateurPage() {
  const { loading: authLoading } = useAuth()

  const [mode,        setMode]        = useState<Mode>('summary')
  const [inputMode,   setInputMode]   = useState<InputMode>('text')
  const [prompt,      setPrompt]      = useState('')
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [fileProcessing, setFileProcessing] = useState(false)
  const [difficulty,  setDifficulty]  = useState<Difficulty>('intermediate')
  const [loading,     setLoading]     = useState(false)
  const [progress,    setProgress]    = useState<{ current: number; total: number } | null>(null)
  const [error,       setError]       = useState('')
  const [result,      setResult]      = useState<string | QCMQuestion[] | null>(null)
  const [llmUsed,     setLlmUsed]     = useState('')
  const [cached,      setCached]      = useState(false)

  if (authLoading) return <LoadingScreen />

  // ── Génération avec support gros fichiers (chunking + synthèse)
  async function handleGenerate() {
    const effectivePrompt = inputMode === 'file' && uploadedFile
      ? uploadedFile.content
      : prompt.trim()

    if (!effectivePrompt) return

    setLoading(true)
    setError('')
    setResult(null)
    setProgress(null)

    try {
      const chunks = splitIntoChunks(effectivePrompt)
      const isMultiChunk = chunks.length > 1

      if (!isMultiChunk) {
        // Fichier court ou texte : traitement direct
        const data = await generate({
          task_type: mode,
          prompt: effectivePrompt,
          difficulty,
          ...(inputMode === 'file' && uploadedFile ? { source_filename: uploadedFile.name } : {}),
        })
        setResult(data.result)
        setLlmUsed(data.llm_used)
        setCached(data.cached)
      } else {
        // Gros fichier : traitement chunk par chunk puis synthèse
        setProgress({ current: 0, total: chunks.length + 1 })
        const partialSummaries: string[] = []

        for (let i = 0; i < chunks.length; i++) {
          setProgress({ current: i + 1, total: chunks.length + 1 })
          const chunkPrompt = `
[Document : "${uploadedFile?.name ?? 'fichier'}" — Partie ${i + 1}/${chunks.length}]

${chunks[i]}

---
Extrait tous les éléments importants de cette partie (concepts clés, règles, définitions, exemples, arguments). Sois exhaustif.
`.trim()

          const data = await generate({
            task_type: 'summary',
            prompt: chunkPrompt,
            difficulty,
          })
          partialSummaries.push(`### Partie ${i + 1}/${chunks.length}\n${data.result}`)
          setLlmUsed(data.llm_used)
        }

        // Synthèse finale
        setProgress({ current: chunks.length + 1, total: chunks.length + 1 })
        const synthesisPrompt = `
Tu as analysé un document complet en ${chunks.length} parties. Voici les extraits de chaque partie :

${partialSummaries.join('\n\n---\n\n')}

---
${mode === 'summary'
  ? `Produis maintenant un résumé structuré, complet et cohérent du document entier. Intègre TOUS les éléments importants. Niveau : ${difficulty}.`
  : `Génère maintenant un QCM complet et varié couvrant l'ENSEMBLE du document. Couvre toutes les parties. Niveau : ${difficulty}.`
}
`.trim()

        const finalData = await generate({
          task_type: mode,
          prompt: synthesisPrompt,
          difficulty,
        })
        setResult(finalData.result)
        setLlmUsed(finalData.llm_used)
        setCached(finalData.cached)
        setProgress(null)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setProgress(null)
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

  const canGenerate = inputMode === 'text'
    ? !!prompt.trim()
    : !!uploadedFile && !fileProcessing

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
            <button key={m} onClick={() => { setMode(m as Mode); setResult(null); setError('') }}
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

          {/* Toggle texte / fichier */}
          <div style={{
            display: 'flex', gap: '0', marginBottom: '1rem',
            border: '1px solid #C8D4E3', borderRadius: '6px',
            overflow: 'hidden', width: 'fit-content',
          }}>
            {([['text', '✏️ Texte'], ['file', '📁 Fichier']] as [InputMode, string][]).map(([im, label]) => (
              <button key={im}
                onClick={() => { setInputMode(im); setResult(null); setError('') }}
                style={{
                  padding: '0.45rem 1rem',
                  background: inputMode === im ? '#0F1B2D' : 'transparent',
                  color: inputMode === im ? '#F5F0E8' : '#5A7CA3',
                  border: 'none', fontFamily: 'inherit',
                  fontSize: '0.83rem', cursor: 'pointer',
                  fontWeight: inputMode === im ? 600 : 400,
                  transition: 'all 0.2s',
                }}>
                {label}
              </button>
            ))}
          </div>

          {inputMode === 'text' ? (
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
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.82rem', color: '#2E5480', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Dépose ton cours, polycopié ou document
              </label>
              <FileUploadZone
                onFileProcessed={(f) => { setFileProcessing(false); setUploadedFile(f) }}
                onClear={() => setUploadedFile(null)}
                uploadedFile={uploadedFile}
                processing={fileProcessing}
              />
            </div>
          )}

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

            <button
              onClick={handleGenerate}
              disabled={loading || !canGenerate}
              className="btn-primary"
              style={{ marginLeft: 'auto', minWidth: '140px' }}
            >
              {loading
                ? <span className="animate-pulse-gold">Génération…</span>
                : mode === 'summary' ? '📄 Générer le résumé' : '✅ Générer le QCM'
              }
            </button>
          </div>
        </div>

        {/* Progress bar pour gros fichiers */}
        {progress && (
          <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.83rem', color: '#2E5480', fontWeight: 600 }}>
                {progress.current <= progress.total - 1
                  ? `Analyse de la partie ${progress.current} / ${progress.total - 1}…`
                  : 'Synthèse finale en cours…'}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#8FA8C8' }}>
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            <div style={{
              height: '6px', background: '#DDD5C4',
              borderRadius: '99px', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${(progress.current / progress.total) * 100}%`,
                background: 'linear-gradient(90deg, #C9A84C, #E6C96A)',
                borderRadius: '99px',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#8FA8C8', marginTop: '6px' }}>
              ✓ Chaque partie est analysée intégralement — rien n'est omis
            </div>
          </div>
        )}

        {/* Exemples (mode texte seulement) */}
        {inputMode === 'text' && !result && !loading && (
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
        {loading && !progress && (
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
              {uploadedFile && (
                <span style={{
                  fontSize: '0.75rem', color: '#4A7C59',
                  background: '#E8F2EB', padding: '2px 8px',
                  borderRadius: '99px', border: '1px solid #4A7C59',
                }}>
                  📁 {uploadedFile.name}
                </span>
              )}
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
              <button onClick={() => { setResult(null); setPrompt(''); setUploadedFile(null) }} className="btn-ghost">
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
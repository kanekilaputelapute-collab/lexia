import { supabase } from './supabase'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL!

async function getJWT(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function generate(payload: {
  task_type: 'summary' | 'flashcard' | 'qcm' | 'case_practice' | 'dissertation' | 'commentary' | 'revision_step'
  prompt: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  source_filename?: string
}) {
  const jwt = await getJWT()
  if (!jwt) throw new Error('Non connecté')

  const res = await fetch(`${WORKER_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `Erreur ${res.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<{
    result:   any
    llm_used: string
    cached:   boolean
  }>
}

export async function getDashboard() {
  const jwt = await getJWT()
  if (!jwt) throw new Error('Non connecté')

  const res = await fetch(`${WORKER_URL}/api/dashboard`, {
    headers: { 'Authorization': `Bearer ${jwt}` },
  })
  if (!res.ok) throw new Error(`Erreur dashboard ${res.status}`)
  return res.json()
}

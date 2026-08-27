import type { GuidedRequestSession, InterpretationResult, RequestInterpretation, RtiDraft } from '../domain/rti'
import type { DraftResponse, InterpretResponse } from '../intelligence/api'
import { deterministicDraft, deterministicInterpret } from '../intelligence/deterministic'

// Browser-facing intelligence client. It calls the same-origin /api endpoints
// (which own the Groq key) and degrades gracefully to the local deterministic
// interpreter if the server is unreachable — never inventing a result.

const INTERPRET_URL = '/api/interpret'
const DRAFT_URL = '/api/draft'
const CLIENT_TIMEOUT = 15000

// Cache by exact need so we do not re-hit the model for unchanged input.
const interpretCache = new Map<string, InterpretResponse>()

function looksLikeResult(value: unknown): value is InterpretationResult {
  return Boolean(value) && typeof value === 'object' && 'kind' in (value as object)
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`http-${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

export const intelligenceService = {
  async interpret(need: string): Promise<InterpretResponse> {
    const trimmed = (need ?? '').trim()
    const cached = interpretCache.get(trimmed)
    if (cached) return cached

    try {
      const data = (await postJson(INTERPRET_URL, { need: trimmed })) as InterpretResponse
      if (!data || !looksLikeResult(data.result)) throw new Error('bad-shape')
      interpretCache.set(trimmed, data)
      return data
    } catch {
      // Server down / offline build: use the safe local interpreter.
      const fallback: InterpretResponse = { result: deterministicInterpret(trimmed), mode: 'fallback', reason: 'client-offline' }
      interpretCache.set(trimmed, fallback)
      return fallback
    }
  },

  async createDraft(session: GuidedRequestSession, interpretation: RequestInterpretation): Promise<DraftResponse> {
    const need = (session.need ?? '').trim()
    try {
      const data = (await postJson(DRAFT_URL, { need, interpretation })) as DraftResponse
      if (!data || !data.draft || typeof data.draft.requestText !== 'string') throw new Error('bad-shape')
      return data
    } catch {
      const draft: RtiDraft = deterministicDraft({ need }, interpretation)
      return { draft, mode: 'fallback', reason: 'client-offline' }
    }
  },

  clearCache() {
    interpretCache.clear()
  },
}

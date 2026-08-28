import type { GuidanceResult, GuidedRequestSession, InterpretationResult, KnownFacts, RequestInterpretation, RtiDraft } from '../domain/rti'
import type { DraftResponse, GuideResponse, InterpretResponse } from '../intelligence/api'
import { deterministicDraft, deterministicInterpret } from '../intelligence/deterministic'
import { offlineExtract, routeFromFacts } from '../knowledge/routing'

// Browser-facing intelligence client. It calls the same-origin /api endpoints
// (which own the Groq key) and degrades gracefully to the local deterministic
// interpreter if the server is unreachable — never inventing a result.

const INTERPRET_URL = '/api/interpret'
const DRAFT_URL = '/api/draft'
const GUIDE_URL = '/api/guide'
const CLIENT_TIMEOUT = 15000

// Cache by exact need so we do not re-hit the model for unchanged input.
const interpretCache = new Map<string, InterpretResponse>()
// Cache guided turns by (need + questions asked + answers) so an identical turn
// is never re-posted — mirrors the server-side dedup.
const guideCache = new Map<string, GuideResponse>()

function guideKey(need: string, askedFields: string[], facts?: KnownFacts): string {
  return `${need}::${[...askedFields].sort().join(',')}::${JSON.stringify(facts?.answers ?? {})}`
}

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

  // Phase 4: one turn of adaptive guidance. Sends the evolving facts so a
  // select-answer turn needs no model call server-side. Falls back to local
  // deterministic routing if the API is unreachable.
  async guide(need: string, askedFields: string[] = [], facts?: KnownFacts, sessionId = 'local'): Promise<GuideResponse> {
    const trimmed = (need ?? '').trim()
    const key = guideKey(trimmed, askedFields, facts)
    const cached = guideCache.get(key)
    if (cached) return cached

    try {
      const data = (await postJson(GUIDE_URL, { need: trimmed, askedFields, facts, sessionId })) as GuideResponse
      if (!data || !data.result || !data.facts) throw new Error('bad-shape')
      guideCache.set(key, data)
      return data
    } catch {
      const reuse = facts && facts.extracted && facts.rawNeed === trimmed
      const f: KnownFacts = reuse ? facts : offlineExtract(trimmed)
      const result: GuidanceResult = routeFromFacts(f, askedFields, 'deterministic')
      const resp: GuideResponse = { result, facts: f, mode: 'fallback', reason: 'client-offline' }
      guideCache.set(key, resp)
      return resp
    }
  },

  clearCache() {
    interpretCache.clear()
    guideCache.clear()
  },
}

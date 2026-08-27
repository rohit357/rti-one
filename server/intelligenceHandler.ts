import type { Authority, RequestInterpretation, RtiDraft } from '../src/domain/rti'
import type { DraftResponse, InterpretResponse } from '../src/intelligence/api'
import { safeJsonParse, validateModelOutput } from '../src/intelligence/contract'
import { deterministicDraft, deterministicInterpret } from '../src/intelligence/deterministic'
import { ground } from '../src/intelligence/grounding'
import { buildDraftPrompt, buildInterpretPrompt } from '../src/intelligence/prompt'
import type { GroqProvider } from './groqProvider'

// Orchestrates the LLM-assisted pipeline. Every failure mode degrades to the
// safe deterministic path — a provider/model failure can never produce a
// fabricated "successful" result.

export interface IntelligenceEngine {
  interpret(need: string): Promise<InterpretResponse>
  draft(need: string, interpretation: RequestInterpretation): Promise<DraftResponse>
}

export interface EngineDeps {
  provider: GroqProvider
  authorities: Authority[]
}

// Keep point-wise line breaks in a drafted body but strip other control chars.
function cleanBody(value: string, max = 4000): string {
  return value
    .replace(new RegExp('\\r\\n?', 'g'), '\n')
    .replace(new RegExp('[\\u0000-\\u0009\\u000B\\u000C\\u000E-\\u001F\\u007F]+', 'g'), ' ')
    .replace(new RegExp('[ \\t]+\\n', 'g'), '\n')
    .trim()
    .slice(0, max)
}

export function createIntelligenceEngine({ provider, authorities }: EngineDeps): IntelligenceEngine {
  return {
    async interpret(need: string): Promise<InterpretResponse> {
      const trimmed = (need ?? '').trim()
      const fallback = (reason: string): InterpretResponse => ({
        result: deterministicInterpret(trimmed),
        mode: 'fallback',
        reason,
      })

      if (trimmed.length < 12) return fallback('too-short')
      if (!provider.hasKey) return fallback('no-key')

      const { system, user } = buildInterpretPrompt(trimmed, authorities)
      // Headroom for the reasoning model's completion (reasoning + JSON). With
      // reasoning_effort 'low' the object lands well inside this; too small a
      // budget truncates the JSON (finish_reason 'length') and forces fallback.
      const res = await provider.chat({ system, user, maxTokens: 1600 })
      if (!res.ok) return fallback(res.reason)

      const model = validateModelOutput(safeJsonParse(res.content))
      if (!model) return fallback('malformed')

      // Grounding may itself return a clarification — that is a valid, safe AI result.
      return { result: ground(model, trimmed, authorities), mode: 'ai' }
    },

    async draft(need: string, interpretation: RequestInterpretation): Promise<DraftResponse> {
      const trimmed = (need ?? '').trim()
      const fallback = (reason: string): DraftResponse => ({
        draft: deterministicDraft({ need: trimmed }, interpretation),
        mode: 'fallback',
        reason,
      })

      const authority = authorities.find(a => a.id === interpretation.authorityId)
      if (!authority) return fallback('no-authority')
      if (!provider.hasKey) return fallback('no-key')

      const { system, user } = buildDraftPrompt(trimmed, interpretation, authority)
      const res = await provider.chat({ system, user, maxTokens: 1200 })
      if (!res.ok) return fallback(res.reason)

      const parsed = safeJsonParse(res.content)
      if (!parsed || typeof parsed !== 'object') return fallback('malformed')
      const obj = parsed as Record<string, unknown>
      const subject = typeof obj.subject === 'string' ? obj.subject.replace(/\s+/g, ' ').trim().slice(0, 160) : ''
      const requestText = typeof obj.requestText === 'string' ? cleanBody(obj.requestText) : ''
      if (!subject || !requestText) return fallback('malformed')

      // Authority + jurisdiction come from the grounded dataset record, not the model.
      const draft: RtiDraft = {
        jurisdiction: authority.jurisdiction,
        authorityId: authority.id,
        subject,
        requestText,
      }
      return { draft, mode: 'ai' }
    },
  }
}

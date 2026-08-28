import type { KnownFacts, RequestInterpretation } from '../src/domain/rti'
import type { IntelligenceEngine } from './intelligenceHandler'

// Transport-agnostic request handlers. Each takes the parsed JSON body plus the
// shared engine and returns a { status, body } reply. Both the Vite middleware
// and the Vercel serverless functions call these, so request parsing, validation
// and status codes are byte-identical in local dev and in production.

export interface ApiReply {
  status: number
  body: unknown
}

export async function interpretReply(engine: IntelligenceEngine, body: Record<string, unknown>): Promise<ApiReply> {
  const need = typeof body.need === 'string' ? body.need : ''
  return { status: 200, body: await engine.interpret(need) }
}

export async function draftReply(engine: IntelligenceEngine, body: Record<string, unknown>): Promise<ApiReply> {
  const need = typeof body.need === 'string' ? body.need : ''
  const interpretation = body.interpretation
  if (!interpretation || typeof interpretation !== 'object') return { status: 400, body: { error: 'bad-request' } }
  return { status: 200, body: await engine.draft(need, interpretation as RequestInterpretation) }
}

export async function guideReply(engine: IntelligenceEngine, body: Record<string, unknown>): Promise<ApiReply> {
  const need = typeof body.need === 'string' ? body.need : ''
  const askedFields = Array.isArray(body.askedFields)
    ? body.askedFields.filter((f): f is string => typeof f === 'string')
    : []
  const facts = body.facts && typeof body.facts === 'object' ? (body.facts as KnownFacts) : undefined
  const sessionId = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : 'default'
  return { status: 200, body: await engine.guide({ need, askedFields, facts, sessionId }) }
}

export function metricsReply(engine: IntelligenceEngine): ApiReply {
  return { status: 200, body: engine.metrics() }
}

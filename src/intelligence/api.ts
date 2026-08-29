import type { GuidanceResult, InterpretationResult, KnownFacts, RequestInterpretation, RtiDraft } from '../domain/rti.js'

// Wire contract shared by the server handler and the browser client, so the
// client never has to import anything from the server/ tree.

export type IntelligenceMode = 'ai' | 'fallback'

export interface InterpretResponse {
  result: InterpretationResult
  mode: IntelligenceMode
  reason?: string
}

export interface DraftResponse {
  draft: RtiDraft
  mode: IntelligenceMode
  reason?: string
}

export interface InterpretRequestBody {
  need: string
}

export interface DraftRequestBody {
  need: string
  interpretation: RequestInterpretation
}

// Phase 4: knowledge-grounded adaptive guidance. One turn of the guided flow.
// `facts` is the evolving session state echoed back so the client can persist it
// and send it on the next turn (a select-answer turn needs no model call).
export interface GuideResponse {
  result: GuidanceResult
  facts: KnownFacts
  mode: IntelligenceMode
  reason?: string
}

export interface GuideRequestBody {
  need: string
  askedFields?: string[]
  facts?: KnownFacts
  sessionId?: string
}

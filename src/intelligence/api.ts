import type { InterpretationResult, RequestInterpretation, RtiDraft } from '../domain/rti'

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

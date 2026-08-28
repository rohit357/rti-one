export type Jurisdiction = 'Central' | 'State/UT'
export type ApplicationStatus = 'Draft' | 'Submitted' | 'Under review' | 'Response due'

export interface Authority {
  id: string
  name: string
  jurisdiction: Jurisdiction
  location: string
  description: string
}

export interface RtiDraft {
  jurisdiction?: Jurisdiction
  authorityId?: string
  subject: string
  requestText: string
}

export type EvidenceStatus = 'explicit' | 'inferred' | 'missing'
export type InterpretationSource = 'ai' | 'deterministic'
export type Confidence = 'low' | 'medium' | 'high'

export interface EvidenceItem {
  label: string
  value: string
  status: EvidenceStatus
}

export interface RequestInterpretation {
  location: string
  governmentLevel: Jurisdiction
  topic: string
  authorityId: string
  confidenceNote: string
  // Optional, additive: populated by the LLM-assisted path, absent on the
  // deterministic fallback. UI guards on presence, so nothing breaks when absent.
  source?: InterpretationSource
  explanation?: string
  confidence?: Confidence
  evidence?: EvidenceItem[]
  alternativeAuthorityIds?: string[]
}

export interface ClarificationRequest {
  kind: 'clarification'
  question: string
  detail: string
  source?: InterpretationSource
  missingInformation?: string[]
}

export type InterpretationResult =
  | { kind: 'ready'; interpretation: RequestInterpretation }
  | ClarificationRequest

// --- Phase 4: knowledge-grounded adaptive guidance ------------------------

// Structured, evolving picture of what the citizen has told us. `serviceType`
// is a controlled-vocabulary string (see src/knowledge SERVICE_TYPES); it is
// typed as string here so the domain stays independent of the knowledge layer.
// Locations are only ever populated when the citizen actually stated them.
export interface KnownFacts {
  rawNeed: string
  serviceType?: string
  location?: string
  state?: string
  governmentLevel?: Jurisdiction
  mentionedAuthority?: string
  keywords?: string[]
  extractedFacts?: string[]
  missingInformation?: string[]
  answers?: Record<string, string>
  extracted?: boolean // true once fact extraction has run for this need
  aiExtracted?: boolean // true when the facts came from the model (not the offline extractor)
}

export type GuidedInputMode = 'select' | 'text'

export interface GuidedOption {
  value: string
  label: string
  hint?: string
}

// One adaptive question, computed from the smallest discriminator that separates
// the remaining candidate authorities. `field` names the discriminator so it is
// never asked twice.
export interface GuidedQuestion {
  kind: 'question'
  field: string
  question: string
  why: string
  inputMode: GuidedInputMode
  options?: GuidedOption[]
  candidateAuthorityIds: string[]
}

export type GuidanceResult =
  | { kind: 'route'; interpretation: RequestInterpretation }
  | GuidedQuestion
  | ClarificationRequest

export interface GuidedRequestSession {
  need: string
  sessionId?: string
  facts?: KnownFacts
  askedFields?: string[]
  candidateAuthorityIds?: string[]
  question?: GuidedQuestion
  interpretation?: RequestInterpretation
  clarification?: ClarificationRequest
  draft?: RtiDraft
}

export interface TrackingEvent {
  date: string
  title: string
  detail: string
}

export interface RtiApplication extends Required<RtiDraft> {
  id: string
  applicantName: string
  createdAt: string
  status: ApplicationStatus
  timeline: TrackingEvent[]
}

export interface User { id: string; name: string; email: string }

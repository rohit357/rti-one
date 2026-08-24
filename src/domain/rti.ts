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

export interface RequestInterpretation {
  location: string
  governmentLevel: Jurisdiction
  topic: string
  authorityId: string
  confidenceNote: string
}

export interface ClarificationRequest {
  kind: 'clarification'
  question: string
  detail: string
}

export type InterpretationResult =
  | { kind: 'ready'; interpretation: RequestInterpretation }
  | ClarificationRequest

export interface GuidedRequestSession {
  need: string
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

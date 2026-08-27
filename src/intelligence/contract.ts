import type { Confidence, EvidenceStatus } from '../domain/rti'

// The strict structured contract the model must return. This mirrors only the
// fields the product needs — nothing here is trusted until it is validated by
// `validateModelOutput` and grounded against the real authority dataset.
export interface ModelInterpretation {
  originalQuestion: string
  extractedFacts: string[]
  location: { value: string; status: EvidenceStatus }
  governmentLevel: '' | 'Central' | 'State/UT'
  topic: string
  department: string
  mentionedAuthority: string
  authorityCandidateIds: string[]
  missingInformation: string[]
  clarificationQuestion: string
  confidence: Confidence
  explanation: string
}

const EVIDENCE_STATUSES: EvidenceStatus[] = ['explicit', 'inferred', 'missing']
const CONFIDENCES: Confidence[] = ['low', 'medium', 'high']
const LEVELS = ['', 'Central', 'State/UT'] as const

// Matches ASCII control characters (incl. newlines/tabs) so untrusted model
// text cannot smuggle formatting or escape sequences into the UI. Built via the
// RegExp constructor so the source stays plain-ASCII.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]+', 'g')

/** Strip control characters/newlines, collapse whitespace, trim, cap length. */
export function clean(value: unknown, max = 240): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function cleanList(value: unknown, maxItems = 8, maxLen = 160): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => clean(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems)
}

/** Parse JSON without throwing. Returns null on any failure. */
export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Validate + normalize raw model output into a ModelInterpretation.
 * Returns null for anything malformed or off-contract — the caller must then
 * fall back safely and must NEVER treat a null as a successful interpretation.
 */
export function validateModelOutput(raw: unknown): ModelInterpretation | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>

  // Enumerations must match exactly; unknown values are rejected, not coerced.
  const level = typeof o.governmentLevel === 'string' && (LEVELS as readonly string[]).includes(o.governmentLevel)
    ? (o.governmentLevel as ModelInterpretation['governmentLevel'])
    : ''
  const confidence = typeof o.confidence === 'string' && CONFIDENCES.includes(o.confidence as Confidence)
    ? (o.confidence as Confidence)
    : 'low'

  const locationRaw = (o.location ?? {}) as Record<string, unknown>
  const locationStatus = typeof locationRaw.status === 'string' && EVIDENCE_STATUSES.includes(locationRaw.status as EvidenceStatus)
    ? (locationRaw.status as EvidenceStatus)
    : 'missing'

  // Candidate IDs must be strings; existence in the dataset is checked later in
  // grounding. Here we only enforce shape.
  const candidateIds = Array.isArray(o.authorityCandidateIds)
    ? o.authorityCandidateIds.filter((id): id is string => typeof id === 'string').map(id => id.trim()).filter(Boolean).slice(0, 6)
    : []

  return {
    originalQuestion: clean(o.originalQuestion, 2000),
    extractedFacts: cleanList(o.extractedFacts),
    location: { value: clean(locationRaw.value, 120), status: locationStatus },
    governmentLevel: level,
    topic: clean(o.topic, 140),
    department: clean(o.department, 140),
    mentionedAuthority: clean(o.mentionedAuthority, 160),
    authorityCandidateIds: candidateIds,
    missingInformation: cleanList(o.missingInformation),
    clarificationQuestion: clean(o.clarificationQuestion, 240),
    confidence,
    explanation: clean(o.explanation, 400),
  }
}

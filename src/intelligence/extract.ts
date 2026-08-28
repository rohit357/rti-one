import type { EvidenceStatus, KnownFacts } from '../domain/rti'
import { isServiceType } from '../knowledge/types'
import { clean, cleanList } from './contract'

// The strict structured contract for the FACT-EXTRACTION model call. The model's
// only job is to read the citizen's own words and report what they stated. It
// never names an authority ID, never decides jurisdiction, and never invents a
// location. Authority existence + routing is the knowledge layer's job.

export interface ExtractedFacts {
  serviceType: string // '' or a value from SERVICE_TYPES; validated below
  location: { value: string; status: EvidenceStatus }
  state: string
  mentionedAuthority: string
  keywords: string[]
  extractedFacts: string[]
  missingInformation: string[]
}

const EVIDENCE_STATUSES: EvidenceStatus[] = ['explicit', 'inferred', 'missing']

/** Validate + normalize raw extraction output. Returns null when off-contract. */
export function validateExtractOutput(raw: unknown): ExtractedFacts | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>

  const locationRaw = (o.location ?? {}) as Record<string, unknown>
  const locationStatus = typeof locationRaw.status === 'string' && EVIDENCE_STATUSES.includes(locationRaw.status as EvidenceStatus)
    ? (locationRaw.status as EvidenceStatus)
    : 'missing'

  // serviceType must be in the controlled vocabulary; anything else -> '' (the
  // routing layer will then ask a service question rather than trust a guess).
  const svcRaw = clean(o.serviceType, 40).toLowerCase()
  const serviceType = isServiceType(svcRaw) ? svcRaw : ''

  return {
    serviceType,
    location: { value: clean(locationRaw.value, 120), status: locationStatus },
    state: clean(o.state, 80),
    mentionedAuthority: clean(o.mentionedAuthority, 160),
    keywords: cleanList(o.keywords, 10, 60),
    extractedFacts: cleanList(o.extractedFacts),
    missingInformation: cleanList(o.missingInformation),
  }
}

// A location/state is only trusted when the citizen literally used the word.
function statedIn(need: string, value: string): boolean {
  const v = value.trim().toLowerCase()
  if (v.length < 3 || v === 'not specified' || v === 'unknown' || v === 'n/a') return false
  return need.toLowerCase().includes(v)
}

/**
 * Turn validated (still untrusted) extraction into evolving KnownFacts, applying
 * the grounding rules: a location survives only if it appears in the citizen's
 * own words; serviceType only if it is in the controlled vocabulary; jurisdiction
 * is never set from the model (the knowledge layer decides that).
 */
export function factsFromExtraction(model: ExtractedFacts, need: string): KnownFacts {
  const trimmed = need.trim()
  const facts: KnownFacts = {
    rawNeed: trimmed,
    extracted: true,
    aiExtracted: true,
    answers: {},
    keywords: model.keywords,
    extractedFacts: model.extractedFacts,
    missingInformation: model.missingInformation,
  }

  if (model.serviceType && isServiceType(model.serviceType)) facts.serviceType = model.serviceType

  const locationStated = model.location.status === 'explicit' && statedIn(trimmed, model.location.value)
  if (locationStated) facts.location = model.location.value.trim()
  if (model.state && statedIn(trimmed, model.state)) facts.state = model.state.trim()

  // Free text only. Retrieval alias-matches it against the dataset, so an
  // invented name simply fails to match and gains no ranking boost.
  if (model.mentionedAuthority) facts.mentionedAuthority = model.mentionedAuthority

  return facts
}

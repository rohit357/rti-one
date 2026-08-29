import type {
  Confidence,
  GuidanceResult,
  GuidedOption,
  GuidedQuestion,
  InterpretationSource,
  KnownFacts,
  RequestInterpretation,
} from '../domain/rti.js'
import { authorityRecords } from './dataset.js'
import { retrieveCandidates, type ScoredRecord } from './retrieval.js'
import type { AuthorityRecord, ServiceType } from './types.js'
import { isServiceType, SERVICE_LABELS, SERVICE_TYPES } from './types.js'

// Deterministic routing + adaptive questioning over retrieved candidates. The
// knowledge base decides authority existence and jurisdiction; this module
// decides whether we have enough evidence to route, or which single smallest
// question separates the remaining candidates. The model never reaches here.

export const UNSURE = '__unsure__'

const TOPIC_BY_SERVICE: Partial<Record<ServiceType, string>> = {
  road: 'Road maintenance and repairs',
  highway: 'National highways and road transport',
  streetlight: 'Street lighting and municipal maintenance',
  electricity: 'Electricity supply and distribution',
  water: 'Water supply and drainage',
  sanitation: 'Sanitation and waste',
  railway: 'Railway services and operations',
  housing: 'Housing and urban development',
  urban: 'Urban planning and civic works',
  'transport-permit': 'Vehicles, licences and transport permits',
}

function topicForRecord(record: AuthorityRecord, facts: KnownFacts): string {
  const svc = isServiceType(facts.serviceType) ? facts.serviceType : record.serviceTypes[0]
  return (svc && TOPIC_BY_SERVICE[svc]) || record.department
}

// --- discriminators -------------------------------------------------------

function localityKey(record: AuthorityRecord): string {
  return record.jurisdiction === 'Central' ? 'level:Central' : `state:${record.state}`
}

function localityOptions(records: AuthorityRecord[]): GuidedOption[] {
  const seen = new Map<string, GuidedOption>()
  for (const record of records) {
    const value = localityKey(record)
    if (seen.has(value)) continue
    const label = record.jurisdiction === 'Central' ? 'A national / central-government matter' : `In ${record.state}`
    seen.set(value, { value, label })
  }
  return [...seen.values()].sort((a, b) => a.value.localeCompare(b.value))
}

function serviceOptions(records: AuthorityRecord[]): GuidedOption[] {
  const present = new Set<ServiceType>()
  for (const record of records) if (record.serviceTypes[0]) present.add(record.serviceTypes[0])
  // Order by the controlled vocabulary for stable, sensible option order.
  return SERVICE_TYPES.filter(svc => present.has(svc)).map(svc => ({ value: svc, label: SERVICE_LABELS[svc] }))
}

function withUnsure(options: GuidedOption[]): GuidedOption[] {
  return [...options, { value: UNSURE, label: "I'm not sure" }]
}

// --- answer application (pure, deterministic — no model call) --------------

// Apply a citizen's answer to a discriminator question to the known facts.
// Used for selection answers on both client and server, so a chosen option
// never needs a model round-trip.
export function applyAnswer(facts: KnownFacts, field: string, value: string): KnownFacts {
  const next: KnownFacts = { ...facts, answers: { ...(facts.answers ?? {}), [field]: value } }
  if (value === UNSURE) return next

  if (field === 'serviceType' && isServiceType(value)) {
    next.serviceType = value
  } else if (field === 'locality') {
    if (value.startsWith('level:')) {
      next.governmentLevel = value.slice('level:'.length) === 'Central' ? 'Central' : 'State/UT'
    } else if (value.startsWith('state:')) {
      const state = value.slice('state:'.length)
      next.state = state
      next.location = state
      next.governmentLevel = 'State/UT'
    }
  }
  return next
}

// --- route interpretation --------------------------------------------------

interface RouteOptions {
  facts: KnownFacts
  alternatives: string[]
  source: InterpretationSource
  confidence: Confidence
  explanation: string
}

function recordToInterpretation(record: AuthorityRecord, opts: RouteOptions): RequestInterpretation {
  const { facts, alternatives, source, confidence, explanation } = opts
  const location = facts.location && facts.location.trim() ? facts.location.trim() : 'Not specified'
  const svc = isServiceType(facts.serviceType) ? facts.serviceType : undefined
  const serviceExplicit = Boolean(facts.answers?.serviceType && facts.answers.serviceType !== UNSURE) ||
    (svc ? (facts.rawNeed ?? '').toLowerCase().includes(svc) : false)

  const evidence = [
    { label: 'Public authority', value: record.name, status: facts.mentionedAuthority ? 'explicit' as const : 'inferred' as const },
    { label: 'Government level', value: record.jurisdiction, status: 'inferred' as const },
    { label: 'Location', value: location, status: location === 'Not specified' ? 'missing' as const : 'explicit' as const },
  ]
  if (svc) evidence.push({ label: 'Service', value: SERVICE_LABELS[svc], status: serviceExplicit ? 'explicit' as const : 'inferred' as const })
  for (const fact of (facts.extractedFacts ?? []).slice(0, 3)) evidence.push({ label: 'Stated', value: fact, status: 'explicit' as const })

  return {
    location,
    governmentLevel: record.jurisdiction,
    topic: topicForRecord(record, facts),
    authorityId: record.id,
    confidenceNote:
      'This suggestion is grounded against our knowledge base, not guessed. Review and edit every field before drafting.',
    source,
    explanation,
    confidence,
    evidence,
    alternativeAuthorityIds: alternatives,
  }
}

// --- the router ------------------------------------------------------------

function clarification(question: string): GuidanceResult {
  return {
    kind: 'clarification',
    source: 'ai',
    question,
    detail:
      'We will not guess a department, authority, or location. Add what you know — a city or state, the kind of service, or the name on any notice.',
  }
}

function question(field: string, prompt: string, why: string, options: GuidedOption[], candidateIds: string[]): GuidedQuestion {
  return { kind: 'question', field, question: prompt, why, inputMode: 'select', options: withUnsure(options), candidateAuthorityIds: candidateIds }
}

/**
 * Decide the next guidance step from the current facts:
 *  - no candidate  -> clarification (never invent one)
 *  - one clear route -> route
 *  - several candidates that differ on an unasked discriminator -> ONE question
 *  - otherwise -> route to the best candidate, offering the rest as alternatives
 */
export function routeFromFacts(facts: KnownFacts, askedFields: string[] = [], source: InterpretationSource = 'ai'): GuidanceResult {
  const asked = new Set(askedFields)
  const scored = retrieveCandidates(facts)
  if (scored.length === 0) {
    return clarification('Which city or state is this about, and what kind of service or authority is involved?')
  }

  const records = scored.map(s => s.record)
  const top = scored[0]
  const named = top.reasons.includes('named-authority')

  const routeTo = (chosen: ScoredRecord, confidence: Confidence, explanation: string): GuidanceResult => ({
    kind: 'route',
    interpretation: recordToInterpretation(chosen.record, {
      facts,
      alternatives: scored.filter(s => s.record.id !== chosen.record.id).map(s => s.record.id),
      source,
      confidence,
      explanation,
    }),
  })

  // Single candidate, or the citizen named a body that uniquely tops the list.
  const uniquelyNamed = named && (scored.length === 1 || !scored[1].reasons.includes('named-authority'))
  if (scored.length === 1) return routeTo(top, named ? 'high' : 'medium', explain(top, facts))
  if (uniquelyNamed) return routeTo(top, 'high', explain(top, facts))

  // Ask the smallest useful discriminator. Locality (jurisdiction) first, then
  // service type. Never re-ask a field, never ask one that is already known.
  const localityUnknown = !facts.governmentLevel && !facts.state && !asked.has('locality')
  if (localityUnknown) {
    const opts = localityOptions(records)
    if (opts.length >= 2) {
      return question(
        'locality',
        'Where is this happening?',
        'Responsibility depends on whether it is a national, state, or city matter — this points us to the right level of government.',
        opts,
        records.map(r => r.id),
      )
    }
  }

  const serviceUnknown = !isServiceType(facts.serviceType) && !asked.has('serviceType')
  if (serviceUnknown) {
    const opts = serviceOptions(records)
    if (opts.length >= 2) {
      return question(
        'serviceType',
        'Which of these is closest to your issue?',
        'Different departments handle different services, so this tells us who is responsible.',
        opts,
        records.map(r => r.id),
      )
    }
  }

  // Cannot narrow further (discriminators exhausted or citizen unsure): route to
  // the best candidate and surface the rest as editable alternatives.
  return routeTo(top, 'low', explain(top, facts) + ' Other possible authorities are listed so you can change it.')
}

function explain(scored: ScoredRecord, facts: KnownFacts): string {
  if (scored.reasons.includes('named-authority')) return `You named ${scored.record.name}.`
  const svc = isServiceType(facts.serviceType) ? SERVICE_LABELS[facts.serviceType].toLowerCase() : undefined
  const where = facts.state || facts.location
  if (svc && where) return `Based on ${svc} in ${where}, ${scored.record.name} is the likely public authority.`
  if (svc) return `Based on the service (${svc}), ${scored.record.name} is the likely public authority.`
  return `${scored.record.name} is the closest match in our knowledge base.`
}

// --- offline fact extraction (no model) ------------------------------------

const SERVICE_PATTERNS: Array<{ re: RegExp; svc: ServiceType }> = [
  { re: /street\s*light|lamp\s*post|\blighting\b|dark street/i, svc: 'streetlight' },
  { re: /electric|power\s*(cut|supply|failure)|voltage|discom|\bmeter\b/i, svc: 'electricity' },
  { re: /water|drain|sewer|sanitation|garbage|\btap\b/i, svc: 'water' },
  { re: /railway|\btrain\b|\bstation\b|platform|irctc/i, svc: 'railway' },
  { re: /highway|national\s*highway|\bnh\b|expressway|\btoll\b/i, svc: 'highway' },
  { re: /licen[sc]e|permit|\brto\b|vehicle registration|driving/i, svc: 'transport-permit' },
  { re: /housing|urban|metro|smart city|town planning/i, svc: 'urban' },
  { re: /road|pothole|repair/i, svc: 'road' },
]

const STATE_PATTERNS: Array<{ re: RegExp; state: string; location: string }> = [
  { re: /new delhi/i, state: 'Delhi', location: 'New Delhi' },
  { re: /\bdelhi\b/i, state: 'Delhi', location: 'Delhi' },
  { re: /maharashtra|mumbai|pune|nagpur/i, state: 'Maharashtra', location: 'Maharashtra' },
  { re: /karnataka|bengaluru|bangalore/i, state: 'Karnataka', location: 'Karnataka' },
]

// Regex-only extraction used when the model is unavailable. It never invents a
// location (only recognises ones literally present) and only names an authority
// the citizen actually referenced (via dataset aliases).
export function offlineExtract(need: string): KnownFacts {
  const text = (need ?? '').trim()
  const lower = text.toLowerCase()
  const facts: KnownFacts = { rawNeed: text, extracted: true, answers: {} }

  const svc = SERVICE_PATTERNS.find(p => p.re.test(text))
  if (svc) facts.serviceType = svc.svc

  const place = STATE_PATTERNS.find(p => p.re.test(text))
  if (place) {
    facts.state = place.state
    facts.location = place.location
  }

  for (const record of authorityRecords) {
    const alias = record.aliases.find(a => a.length > 3 && lower.includes(a))
    if (alias) {
      facts.mentionedAuthority = record.name
      facts.governmentLevel = record.jurisdiction
      if (record.jurisdiction === 'State/UT' && !facts.state) {
        facts.state = record.state
        facts.location = record.location
      }
      break
    }
  }

  return facts
}

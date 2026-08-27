import type { Authority, EvidenceItem, InterpretationResult, RequestInterpretation } from '../domain/rti'
import type { ModelInterpretation } from './contract'
import { topicForAuthority } from './deterministic'

// Grounding turns validated (but still untrusted) model output into a product
// result. The authority dataset is the ONLY source of truth: the model may rank
// and explain, but it cannot create authorities, IDs, jurisdictions, or facts.

function locationIsStated(value: string, need: string): boolean {
  const v = value.trim().toLowerCase()
  if (v.length < 3 || v === 'not specified' || v === 'unknown' || v === 'n/a') return false
  // An explicit location must actually appear in the citizen's own words.
  return need.toLowerCase().includes(v)
}

/**
 * Ground a validated model interpretation against real authorities.
 * Returns a confirmed suggestion only when a real authority is grounded;
 * otherwise returns a clarification. Never fabricates.
 */
export function ground(model: ModelInterpretation, need: string, authorities: Authority[]): InterpretationResult {
  const byId = new Map(authorities.map(a => [a.id, a]))

  // Keep only candidate IDs that exist in our dataset. Unknown IDs are dropped.
  const validCandidates = model.authorityCandidateIds
    .map(id => byId.get(id))
    .filter((a): a is Authority => Boolean(a))

  // No grounded authority -> we must clarify, never guess one into existence.
  if (validCandidates.length === 0) {
    const question = model.clarificationQuestion
      || 'Which government department or public authority is responsible for this matter?'
    return {
      kind: 'clarification',
      source: 'ai',
      question,
      detail:
        'We could not match your request to a specific public authority in this prototype, so we will not guess one. Add the department, authority, or the name on any notice you have.',
      missingInformation: model.missingInformation,
    }
  }

  const authority = validCandidates[0]

  // Jurisdiction comes from the grounded authority record, not the model's free
  // text. This makes an inconsistent governmentLevel impossible to assert.
  const governmentLevel = authority.jurisdiction

  // Location is preserved only when the model marked it explicit AND it appears
  // in the citizen's own text. Otherwise it is "Not specified" — never invented.
  const location = model.location.status === 'explicit' && locationIsStated(model.location.value, need)
    ? model.location.value
    : 'Not specified'

  const topic = model.topic || model.department || topicForAuthority(authority)

  const evidence: EvidenceItem[] = []
  evidence.push({
    label: 'Public authority',
    value: authority.name,
    status: model.mentionedAuthority ? 'explicit' : 'inferred',
  })
  evidence.push({ label: 'Government level', value: governmentLevel, status: 'inferred' })
  evidence.push({
    label: 'Location',
    value: location,
    status: location === 'Not specified' ? 'missing' : 'explicit',
  })
  for (const fact of model.extractedFacts.slice(0, 4))
    evidence.push({ label: 'Stated', value: fact, status: 'explicit' })

  const interpretation: RequestInterpretation = {
    location,
    governmentLevel,
    topic,
    authorityId: authority.id,
    confidenceNote:
      'This suggestion is grounded against our synthetic authority list. High model confidence is not proof — review and edit every field before drafting.',
    source: 'ai',
    explanation: model.explanation,
    confidence: model.confidence,
    evidence,
    alternativeAuthorityIds: validCandidates.slice(1).map(a => a.id),
  }
  return { kind: 'ready', interpretation }
}

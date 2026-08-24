import type { Authority, GuidedRequestSession, InterpretationResult, RequestInterpretation, RtiDraft } from '../domain/rti'
import { authorities } from '../data/authorities'

const supportedAuthoritySignals: Array<{ pattern: RegExp; authorityId: string }> = [
  { pattern: /ministry of road transport(\s*(and|&)\s*highways)?|\bmorth\b/i, authorityId: 'central-morth' },
  { pattern: /ministry of railways/i, authorityId: 'central-railways' },
  { pattern: /ministry of housing(\s*(and|&)\s*urban affairs)?|\bmohua\b/i, authorityId: 'central-urban' },
  { pattern: /maharashtra transport department/i, authorityId: 'state-mh-transport' },
  { pattern: /karnataka urban development department/i, authorityId: 'state-ka-urban' },
  { pattern: /delhi public works department|\bdelhi\s+pwd\b/i, authorityId: 'ut-delhi-pwd' }
]

function authorityFromEvidence(need: string): Authority | undefined {
  const match = supportedAuthoritySignals.find(signal => signal.pattern.test(need))
  return match ? authorities.find(authority => authority.id === match.authorityId) : undefined
}

function statedLocation(need: string): string {
  if (/\bnew delhi\b/i.test(need)) return 'New Delhi'
  if (/\bdelhi\b/i.test(need)) return 'Delhi'
  if (/\bmaharashtra\b/i.test(need)) return 'Maharashtra'
  if (/\bkarnataka\b/i.test(need)) return 'Karnataka'
  return 'Not specified'
}

function topicFor(authority: Authority): string {
  if (authority.id === 'central-railways') return 'Railway services and operations'
  if (authority.id === 'central-urban') return 'Urban development and housing programmes'
  if (authority.id === 'ut-delhi-pwd') return 'Civic infrastructure and public works'
  if (authority.id === 'state-mh-transport') return 'State transport services and permits'
  if (authority.id === 'state-ka-urban') return 'Urban planning and development'
  return 'Road transport and highway infrastructure'
}

function clarificationFor(need: string): InterpretationResult {
  const mentionsPlace = /\b(delhi|maharashtra|karnataka|bengaluru|bangalore|new delhi)\b/i.test(need)
  return {
    kind: 'clarification',
    question: mentionsPlace
      ? 'Which government department or public authority is responsible for this matter?'
      : 'Which city or state is this about, and which government department or public authority is involved?',
    detail: 'We will not guess a department, authority, government level, or location from an unclear request. Add what you know, even if it is only a city, state, or the name on a notice.'
  }
}

export const interpretationService = {
  async interpret(need: string): Promise<InterpretationResult> {
    await new Promise(resolve => setTimeout(resolve, 450))
    if (need.trim().length < 12) return { kind: 'clarification', question: 'What information do you need, and which city, state, or government body is involved?', detail: 'A little more context lets us make a transparent suggestion without guessing.' }
    const authority = authorityFromEvidence(need)
    if (!authority) return clarificationFor(need)
    const interpretation: RequestInterpretation = {
      location: statedLocation(need),
      governmentLevel: authority.jurisdiction,
      topic: topicFor(authority),
      authorityId: authority.id,
      confidenceNote: 'This suggestion is based on the public authority you named. The location is shown only when you stated it; you can edit every field before drafting.'
    }
    return { kind: 'ready', interpretation }
  },
  createDraft(session: GuidedRequestSession, interpretation: RequestInterpretation): RtiDraft {
    return { jurisdiction: interpretation.governmentLevel, authorityId: interpretation.authorityId, subject: `Information regarding ${interpretation.topic.toLowerCase()}`, requestText: `Please provide the available records and information related to the following matter:\n\n${session.need.trim()}\n\nPlease provide the information point-wise, including relevant dates, current status, and copies of applicable records where available.` }
  }
}
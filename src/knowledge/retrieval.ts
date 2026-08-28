import type { KnownFacts } from '../domain/rti'
import { authorityRecords } from './dataset'
import type { AuthorityRecord, ServiceType } from './types'
import { isServiceType } from './types'

// Deterministic retrieval over the knowledge base. Given the facts we know so
// far, return the compatible candidate authorities ranked by match strength.
// Hard jurisdiction constraints (known government level / state) are applied as
// FILTERS so an incompatible authority can never be a candidate. This layer —
// not the model — decides which authorities exist and could apply.

export interface ScoredRecord {
  record: AuthorityRecord
  score: number
  reasons: string[]
}

function includesTerm(haystack: string, term: string): boolean {
  return term.length > 2 && haystack.includes(term)
}

export function retrieveCandidates(facts: KnownFacts, records: AuthorityRecord[] = authorityRecords): ScoredRecord[] {
  const need = (facts.rawNeed ?? '').toLowerCase()
  const mentioned = (facts.mentionedAuthority ?? '').toLowerCase().trim()
  const svc: ServiceType | undefined = isServiceType(facts.serviceType) ? facts.serviceType : undefined
  const state = (facts.state ?? '').toLowerCase().trim()

  const results: ScoredRecord[] = []
  for (const record of records) {
    // Hard compatibility filters from KNOWN facts.
    if (facts.governmentLevel && record.jurisdiction !== facts.governmentLevel) continue
    if (state && record.jurisdiction === 'State/UT' && record.state.toLowerCase() !== state) continue

    let score = 0
    const reasons: string[] = []

    if (mentioned) {
      const named = record.aliases.some(a => mentioned.includes(a) || a.includes(mentioned)) || record.name.toLowerCase().includes(mentioned)
      if (named) {
        score += 10
        reasons.push('named-authority')
      }
    }

    if (svc && record.serviceTypes.includes(svc)) {
      score += 5
      reasons.push(`service:${svc}`)
    }

    let kw = 0
    for (const term of [...record.keywords, ...record.aliases]) if (includesTerm(need, term.toLowerCase())) kw++
    if (kw > 0) {
      score += Math.min(kw, 3) * 2
      reasons.push(`need-keywords:${kw}`)
    }

    if (facts.keywords?.length) {
      const hit = facts.keywords.some(k => {
        const kl = k.toLowerCase()
        return record.keywords.some(rk => rk.includes(kl) || kl.includes(rk))
      })
      if (hit) {
        score += 1
        reasons.push('extracted-keyword')
      }
    }

    if (state && record.state.toLowerCase() === state) {
      score += 3
      reasons.push('state-match')
    }

    if (score > 0) results.push({ record, score, reasons })
  }

  // Stable order: score desc, then id asc. Never rely on dataset array order.
  return results.sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id))
}

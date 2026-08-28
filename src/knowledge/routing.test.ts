import { describe, expect, it } from 'vitest'
import { knowledgeIntegrity } from './index'
import { retrieveCandidates } from './retrieval'
import { applyAnswer, offlineExtract, routeFromFacts, UNSURE } from './routing'

describe('knowledge base integrity', () => {
  it('has unique ids, no conflicts, and provenance on every record', () => {
    const report = knowledgeIntegrity()
    expect(report.ok).toBe(true)
    expect(report.duplicateIds).toEqual([])
    expect(report.conflicts).toEqual([])
    expect(report.missingProvenance).toEqual([])
    expect(report.demoCount).toBeGreaterThan(0) // demo records are present and counted
  })
})

describe('offline fact extraction', () => {
  it('classifies service and only keeps a stated location', () => {
    const facts = offlineExtract('The streetlight on my lane in Delhi has been dark for weeks.')
    expect(facts.serviceType).toBe('streetlight')
    expect(facts.state).toBe('Delhi')
    expect(facts.location).toBe('Delhi')
  })

  it('names an authority only when the citizen referenced it', () => {
    expect(offlineExtract('Records from the Ministry of Railways.').mentionedAuthority).toBe('Ministry of Railways')
    expect(offlineExtract('Something vague about a form.').mentionedAuthority).toBeUndefined()
  })
})

describe('routing — enough evidence routes without a question (case A)', () => {
  it('routes directly when the citizen named a supported authority', () => {
    const facts = offlineExtract('I need records from the Ministry of Railways about lift repairs.')
    const result = routeFromFacts(facts)
    expect(result.kind).toBe('route')
    if (result.kind === 'route') expect(result.interpretation.authorityId).toBe('central-railways')
  })
})

describe('routing — adaptive questioning', () => {
  it('asks ONE service question with a finite option set when locality is known (case D)', () => {
    const facts = { rawNeed: 'There is a civic problem in my area in Delhi.', state: 'Delhi', location: 'Delhi', extracted: true }
    const result = routeFromFacts(facts)
    expect(result.kind).toBe('question')
    if (result.kind === 'question') {
      expect(result.field).toBe('serviceType')
      expect(result.inputMode).toBe('select')
      // four Delhi service owners + an "I'm not sure" escape
      expect(result.candidateAuthorityIds.length).toBe(4)
      expect(result.options?.some(o => o.value === UNSURE)).toBe(true)
      expect(result.options?.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('asks locality (not a department) when a road spans jurisdictions (case E)', () => {
    const facts = offlineExtract('The road repair near my home has been delayed.')
    const result = routeFromFacts(facts)
    expect(result.kind).toBe('question')
    if (result.kind === 'question') {
      expect(result.field).toBe('locality')
      expect(result.options?.some(o => o.label.includes('Delhi'))).toBe(true)
    }
  })

  it('never re-asks: after a locality answer it routes to the single remaining authority (case C)', () => {
    const facts = offlineExtract('The road repair near my home has been delayed.')
    const answered = applyAnswer(facts, 'locality', 'state:Delhi')
    const result = routeFromFacts(answered, ['locality'])
    expect(result.kind).toBe('route')
    if (result.kind === 'route') {
      expect(result.interpretation.authorityId).toBe('ut-delhi-pwd')
      expect(result.interpretation.governmentLevel).toBe('State/UT')
      expect(result.interpretation.location).toBe('Delhi')
    }
  })
})

describe('routing — safety', () => {
  it('clarifies (no invented authority) for an unsupported body (case F)', () => {
    const result = routeFromFacts(offlineExtract('I want records from the Ministry of Magic.'))
    expect(result.kind).toBe('clarification')
  })

  it('rejects an incompatible jurisdiction instead of routing (case G)', () => {
    // Streetlights are a State/UT service; forcing Central leaves no candidate.
    const result = routeFromFacts({ rawNeed: 'streetlight not working', serviceType: 'streetlight', governmentLevel: 'Central', extracted: true })
    expect(result.kind).toBe('clarification')
    // retrieval returns no Central streetlight authority
    expect(retrieveCandidates({ rawNeed: 'x', serviceType: 'streetlight', governmentLevel: 'Central' })).toEqual([])
  })

  it('routes on "I\'m not sure" without re-asking, offering alternatives', () => {
    const facts = { rawNeed: 'civic problem in Delhi', state: 'Delhi', location: 'Delhi', extracted: true }
    const answered = applyAnswer(facts, 'serviceType', UNSURE)
    const result = routeFromFacts(answered, ['serviceType'])
    expect(result.kind).toBe('route')
    if (result.kind === 'route') expect(result.interpretation.alternativeAuthorityIds?.length).toBeGreaterThan(0)
  })
})

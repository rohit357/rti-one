import { describe, expect, it } from 'vitest'
import { authorities } from '../data/authorities'
import { clean, validateModelOutput, type ModelInterpretation } from './contract'
import { ground } from './grounding'

function model(overrides: Partial<ModelInterpretation> = {}): ModelInterpretation {
  return {
    originalQuestion: 'q',
    extractedFacts: [],
    location: { value: '', status: 'missing' },
    governmentLevel: '',
    topic: '',
    department: '',
    mentionedAuthority: '',
    authorityCandidateIds: [],
    missingInformation: [],
    clarificationQuestion: '',
    confidence: 'low',
    explanation: '',
    ...overrides,
  }
}

describe('contract validation', () => {
  it('rejects non-objects and malformed shapes', () => {
    expect(validateModelOutput(null)).toBeNull()
    expect(validateModelOutput('nope')).toBeNull()
    expect(validateModelOutput([1, 2])).toBeNull()
  })

  it('coerces unknown enum values to safe defaults', () => {
    const out = validateModelOutput({ governmentLevel: 'Galactic', confidence: 'certain' })
    expect(out).not.toBeNull()
    expect(out!.governmentLevel).toBe('')
    expect(out!.confidence).toBe('low')
  })

  it('keeps only string candidate ids and strips control characters', () => {
    const out = validateModelOutput({ authorityCandidateIds: ['central-railways', 42, null], explanation: 'line1\nline2\ttabbed' })
    expect(out!.authorityCandidateIds).toEqual(['central-railways'])
    expect(out!.explanation).toBe('line1 line2 tabbed')
  })

  it('clean caps length and collapses whitespace', () => {
    expect(clean('  a   b  ')).toBe('a b')
    expect(clean('abcdef', 3)).toBe('abc')
  })
})

describe('grounding against the authority dataset', () => {
  it('grounds an explicitly named supported authority', () => {
    const need = 'I need records from the Ministry of Railways about accessibility work.'
    const result = ground(model({ mentionedAuthority: 'Ministry of Railways', authorityCandidateIds: ['central-railways'] }), need, authorities)
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.interpretation.authorityId).toBe('central-railways')
      expect(result.interpretation.governmentLevel).toBe('Central')
      expect(result.interpretation.source).toBe('ai')
    }
  })

  it('preserves an explicitly stated location that appears in the text', () => {
    const need = 'Records from Delhi Public Works Department about a New Delhi streetlight.'
    const result = ground(model({ authorityCandidateIds: ['ut-delhi-pwd'], location: { value: 'New Delhi', status: 'explicit' } }), need, authorities)
    if (result.kind !== 'ready') throw new Error('expected ready')
    expect(result.interpretation.location).toBe('New Delhi')
  })

  it('never keeps a location that is not present in the citizen text', () => {
    const need = 'Records from the Ministry of Railways.'
    const result = ground(model({ authorityCandidateIds: ['central-railways'], location: { value: 'Mumbai', status: 'explicit' } }), need, authorities)
    if (result.kind !== 'ready') throw new Error('expected ready')
    expect(result.interpretation.location).toBe('Not specified')
  })

  it('drops an inferred (non-explicit) location', () => {
    const need = 'Records from the Ministry of Railways in Delhi.'
    const result = ground(model({ authorityCandidateIds: ['central-railways'], location: { value: 'Delhi', status: 'inferred' } }), need, authorities)
    if (result.kind !== 'ready') throw new Error('expected ready')
    expect(result.interpretation.location).toBe('Not specified')
  })

  it('rejects unknown authority ids and asks for clarification', () => {
    const result = ground(model({ authorityCandidateIds: ['made-up-authority', 'evil'] }), 'anything', authorities)
    expect(result.kind).toBe('clarification')
  })

  it('drops unknown ids but keeps a valid one, listing only real alternatives', () => {
    const need = 'Ministry of Railways records.'
    const result = ground(model({ authorityCandidateIds: ['fake-id', 'central-railways', 'central-morth'] }), need, authorities)
    if (result.kind !== 'ready') throw new Error('expected ready')
    expect(result.interpretation.authorityId).toBe('central-railways')
    expect(result.interpretation.alternativeAuthorityIds).toEqual(['central-morth'])
  })

  it('clarifies (no fabricated authority) when the model names an unsupported body', () => {
    const result = ground(model({ mentionedAuthority: 'Ministry of Magic', authorityCandidateIds: [] }), 'I want records from the Ministry of Magic.', authorities)
    expect(result.kind).toBe('clarification')
  })
})

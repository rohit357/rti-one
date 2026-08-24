import { describe, expect, it } from 'vitest'
import { interpretationService } from './interpretationService'

describe('interpretation service', () => {
  it('returns an evidence-backed suggestion for a named supported authority', async () => {
    const result = await interpretationService.interpret('I need records from the Ministry of Railways about accessibility work at my station.')
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.interpretation.authorityId).toBe('central-railways')
      expect(result.interpretation.governmentLevel).toBe('Central')
      expect(result.interpretation.location).toBe('Not specified')
    }
  })

  it('asks a clarification question instead of guessing an authority', async () => {
    const result = await interpretationService.interpret('I need to know why the road repair near my home has been delayed.')
    expect(result.kind).toBe('clarification')
    if (result.kind === 'clarification') expect(result.question).toContain('government')
  })
})
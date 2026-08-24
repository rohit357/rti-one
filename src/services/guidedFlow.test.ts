import { describe, expect, it } from 'vitest'
import { interpretationService } from './interpretationService'

describe('guided flow adapter', () => {
  it('creates a usable RTI draft from an evidence-backed interpretation', async () => {
    const need = 'I need records from the Ministry of Road Transport and Highways about a delayed road repair.'
    const result = await interpretationService.interpret(need)
    expect(result.kind).toBe('ready')
    if (result.kind !== 'ready') throw new Error('Expected an interpretation')
    const draft = interpretationService.createDraft({ need }, result.interpretation)

    expect(draft.jurisdiction).toBe('Central')
    expect(draft.authorityId).toBe('central-morth')
    expect(draft.subject).toContain('road transport')
    expect(draft.requestText).toContain(need)
  })
})
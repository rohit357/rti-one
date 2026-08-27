import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authorities } from '../data/authorities'
import { createIntelligenceEngine } from '../../server/intelligenceHandler'
import { rtiService } from './rtiService'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

// Engine with no key -> real pipeline, deterministic fallback (no network).
const engine = createIntelligenceEngine({
  provider: { hasKey: false, model: 'none', chat: async () => { throw new Error('provider must not be called without a key') } },
  authorities,
})

describe('confirmed interpretation flows into submission and tracking', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))

  it('interprets, drafts, submits, and retrieves by a slash-containing id', async () => {
    const need = 'I need records from the Ministry of Road Transport and Highways about a delayed road repair.'

    const interpreted = await engine.interpret(need)
    expect(interpreted.result.kind).toBe('ready')
    if (interpreted.result.kind !== 'ready') throw new Error('expected ready')
    expect(interpreted.result.interpretation.authorityId).toBe('central-morth')

    const drafted = await engine.draft(need, interpreted.result.interpretation)
    expect(drafted.draft.authorityId).toBe('central-morth')

    const app = await rtiService.submit(drafted.draft, 'Aarav Sharma')
    expect(app.id).toMatch(/^RTI\/ONE\/2026\/\d{5}$/) // registration numbers contain slashes

    const listed = await rtiService.listApplications()
    expect(listed[0]?.id).toBe(app.id)

    // The slash-containing id must round-trip through retrieval (routing invariant).
    const tracked = await rtiService.getApplication(app.id)
    expect(tracked?.id).toBe(app.id)
    expect(tracked?.timeline).toHaveLength(3)
  })
})

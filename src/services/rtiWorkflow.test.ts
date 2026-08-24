import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rtiService } from './rtiService'

function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
}

describe('mock RTI workflow', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))

  it('persists a submitted guided draft for dashboard and tracking reads', async () => {
    const submitted = await rtiService.submit({ jurisdiction: 'Central', authorityId: 'central-morth', subject: 'Road repair records', requestText: 'Please provide road repair records.' }, 'Aarav Sharma')
    const cases = await rtiService.listApplications()
    const tracked = await rtiService.getApplication(submitted.id)

    expect(cases[0]?.id).toBe(submitted.id)
    expect(tracked?.timeline).toHaveLength(3)
  })
})

import { describe, expect, it } from 'vitest'
import { registrationNumber } from './rtiService'

describe('registration number', () => {
  it('is deterministic and padded', () => expect(registrationNumber(7)).toBe('RTI/ONE/2026/00007'))
})

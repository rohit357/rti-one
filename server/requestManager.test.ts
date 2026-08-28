import { describe, expect, it } from 'vitest'
import type { ChatResult } from './groqProvider'
import { configFromEnv, createRequestManager, DEFAULT_CONFIG } from './requestManager'

// Deterministic clock + instant, observable sleep so backoff timing is tested
// without real waits and rate windows advance predictably.
function harness() {
  let t = 0
  const sleeps: number[] = []
  return {
    deps: { now: () => t, sleep: async (ms: number) => { sleeps.push(ms) } },
    advance: (ms: number) => { t += ms },
    sleeps,
  }
}

const ok = (outputTokens = 0): ChatResult => ({ ok: true, content: 'x', usage: { inputTokens: 1, outputTokens } })

describe('request manager — dedup cache (case I)', () => {
  it('serves an identical request from cache without calling the model again', async () => {
    const h = harness()
    const mgr = createRequestManager({}, h.deps)
    let calls = 0
    const chat = async () => { calls++; return ok(7) }

    const a = await mgr.run({ sessionId: 's', cacheKey: 'k', chat })
    const b = await mgr.run({ sessionId: 's', cacheKey: 'k', chat })

    expect(a.ok && b.ok).toBe(true)
    expect(calls).toBe(1)
    expect(mgr.metrics().cacheHits).toBe(1)
  })
})

describe('request manager — session call budget (case J)', () => {
  it('fails closed with NO live call once the per-session cap is reached', async () => {
    const h = harness()
    const mgr = createRequestManager({ maxCallsPerSession: 2 }, h.deps)
    await mgr.run({ sessionId: 's', cacheKey: 'k1', chat: async () => ok() })
    await mgr.run({ sessionId: 's', cacheKey: 'k2', chat: async () => ok() })

    let live = 0
    const res = await mgr.run({ sessionId: 's', cacheKey: 'k3', chat: async () => { live++; return ok() } })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('budget-session-calls')
    expect(live).toBe(0) // the model was never contacted
    expect(mgr.metrics().fallbackCount).toBe(1)
  })

  it('fails closed once the per-session output-token budget is exhausted', async () => {
    const h = harness()
    const mgr = createRequestManager({ maxOutputTokensPerSession: 10 }, h.deps)
    await mgr.run({ sessionId: 's', cacheKey: 'k1', chat: async () => ok(8) }) // 8
    await mgr.run({ sessionId: 's', cacheKey: 'k2', chat: async () => ok(8) }) // 16 >= 10

    let live = 0
    const res = await mgr.run({ sessionId: 's', cacheKey: 'k3', chat: async () => { live++; return ok(8) } })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('budget-session-tokens')
    expect(live).toBe(0)
  })
})

describe('request manager — global rate limit', () => {
  it('limits calls per minute across sessions and recovers after the window', async () => {
    const h = harness()
    const mgr = createRequestManager({ requestsPerMinute: 1 }, h.deps)
    await mgr.run({ sessionId: 'a', cacheKey: 'k1', chat: async () => ok() })

    let live = 0
    const blocked = await mgr.run({ sessionId: 'b', cacheKey: 'k2', chat: async () => { live++; return ok() } })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reason).toBe('rate-limit')
    expect(live).toBe(0)

    h.advance(61_000) // window elapses
    const allowed = await mgr.run({ sessionId: 'b', cacheKey: 'k3', chat: async () => { live++; return ok() } })
    expect(allowed.ok).toBe(true)
    expect(live).toBe(1)
  })
})

describe('request manager — bounded retry + backoff (case K)', () => {
  it('retries transient errors with exponential backoff then succeeds', async () => {
    const h = harness()
    const mgr = createRequestManager({ maxRetries: 2, backoffBaseMs: 100 }, h.deps)
    let n = 0
    const chat = async (): Promise<ChatResult> => { n++; return n < 3 ? { ok: false, reason: 'http-429' } : ok() }

    const res = await mgr.run({ sessionId: 's', cacheKey: 'k', chat })
    expect(res.ok).toBe(true)
    expect(n).toBe(3)
    expect(h.sleeps).toEqual([100, 200]) // bounded, exponential, no storm
    expect(mgr.metrics().retries).toBe(2)
  })

  it('gives up after the retry bound and returns a fallback reason', async () => {
    const h = harness()
    const mgr = createRequestManager({ maxRetries: 1, backoffBaseMs: 50 }, h.deps)
    let n = 0
    const res = await mgr.run({ sessionId: 's', cacheKey: 'k', chat: async () => { n++; return { ok: false, reason: 'http-503' } } })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('http-503')
    expect(n).toBe(2) // initial + exactly one retry
    expect(mgr.metrics().fallbackCount).toBe(1)
  })

  it('does not retry a non-transient error (e.g. HTTP 400)', async () => {
    const h = harness()
    const mgr = createRequestManager({ maxRetries: 3 }, h.deps)
    let n = 0
    const res = await mgr.run({ sessionId: 's', cacheKey: 'k', chat: async () => { n++; return { ok: false, reason: 'http-400' } } })
    expect(res.ok).toBe(false)
    expect(n).toBe(1) // no retries for a client error
  })
})

describe('request manager — configuration', () => {
  it('reads overrides from the environment and falls back to defaults', () => {
    const cfg = configFromEnv({ GUIDE_MAX_CALLS_PER_SESSION: '3', GUIDE_REQUESTS_PER_MINUTE: 'not-a-number' })
    expect(cfg.maxCallsPerSession).toBe(3)
    expect(cfg.requestsPerMinute).toBe(DEFAULT_CONFIG.requestsPerMinute) // invalid ignored
  })
})

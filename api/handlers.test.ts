import { beforeAll, describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import interpret from './interpret'
import draft from './draft'
import guide from './guide'
import metrics from './metrics'

// Exercises the Vercel serverless wrappers with NO GROQ_API_KEY set, so every
// call takes the safe deterministic fallback path and issues ZERO live Groq
// requests. This proves the serverless transport wiring (method guard, body
// parse, JSON reply) works and that the offline fallback survives in production
// shape — without spending any model quota.

beforeAll(() => {
  delete process.env.GROQ_API_KEY
})

interface CapturedRes {
  statusCode: number
  headers: Record<string, string>
  payload: unknown
}

function mockReq(method: string, body?: unknown): IncomingMessage {
  return { method, body } as unknown as IncomingMessage
}

function mockRes(): { res: ServerResponse; captured: CapturedRes } {
  const captured: CapturedRes = { statusCode: 0, headers: {}, payload: undefined }
  const res = {
    set statusCode(v: number) {
      captured.statusCode = v
    },
    get statusCode() {
      return captured.statusCode
    },
    setHeader(key: string, value: string) {
      captured.headers[key.toLowerCase()] = value
    },
    end(text: string) {
      captured.payload = text ? JSON.parse(text) : undefined
    },
  }
  return { res: res as unknown as ServerResponse, captured }
}

describe('vercel serverless handlers (offline / no key)', () => {
  it('interpret: POST returns a valid JSON reply on the safe fallback path', async () => {
    const { res, captured } = mockRes()
    await interpret(mockReq('POST', { need: 'I need road repair records near my home in Delhi' }), res)
    expect(captured.statusCode).toBe(200)
    expect(captured.headers['content-type']).toBe('application/json')
    const body = captured.payload as { mode: string; result: { kind: string } }
    expect(body.mode).toBe('fallback')
    expect(typeof body.result.kind).toBe('string')
  })

  it('interpret: non-POST is rejected with 405', async () => {
    const { res, captured } = mockRes()
    await interpret(mockReq('GET'), res)
    expect(captured.statusCode).toBe(405)
  })

  it('draft: missing interpretation is a 400 bad-request', async () => {
    const { res, captured } = mockRes()
    await draft(mockReq('POST', { need: 'x' }), res)
    expect(captured.statusCode).toBe(400)
    expect((captured.payload as { error: string }).error).toBe('bad-request')
  })

  it('guide: POST returns a routed/questioned result with echoed facts', async () => {
    const { res, captured } = mockRes()
    await guide(mockReq('POST', { need: 'The streetlight on my lane in Delhi has been dark for weeks' }), res)
    expect(captured.statusCode).toBe(200)
    const body = captured.payload as { mode: string; facts: unknown; result: { kind: string } }
    expect(body.mode).toBe('fallback')
    expect(body.facts).toBeTruthy()
    expect(typeof body.result.kind).toBe('string')
  })

  it('metrics: GET returns counters; non-GET is 405', () => {
    const ok = mockRes()
    metrics(mockReq('GET'), ok.res)
    expect(ok.captured.statusCode).toBe(200)
    expect(ok.captured.payload).toBeTruthy()

    const bad = mockRes()
    metrics(mockReq('POST'), bad.res)
    expect(bad.captured.statusCode).toBe(405)
  })
})

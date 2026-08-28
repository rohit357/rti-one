import type { IncomingMessage, ServerResponse } from 'node:http'

// Shared JSON request/response helpers used by BOTH transports: the Vite dev/
// preview middleware and the Vercel serverless functions. One copy keeps the
// body limit, parse rules and error shapes identical across environments.

const BODY_LIMIT = 100_000

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

// Reads and parses a JSON body. On Vercel the platform may have already parsed
// the JSON onto req.body; if so we use it directly. Otherwise (Vite middleware,
// or an unparsed stream) we read the raw stream with the same 100KB cap.
export function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const pre = (req as IncomingMessage & { body?: unknown }).body
  if (pre && typeof pre === 'object') return Promise.resolve(pre as Record<string, unknown>)
  if (typeof pre === 'string') {
    try {
      const parsed = JSON.parse(pre || '{}')
      return Promise.resolve(parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {})
    } catch {
      return Promise.reject(new Error('bad-json'))
    }
  }
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > BODY_LIMIT) {
        reject(new Error('too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8') || '{}'
        const parsed = JSON.parse(text)
        resolve(parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {})
      } catch {
        reject(new Error('bad-json'))
      }
    })
    req.on('error', reject)
  })
}

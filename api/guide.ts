import type { IncomingMessage, ServerResponse } from 'node:http'
import { guideReply } from '../server/apiHandlers'
import { getEngine } from '../server/engineSingleton'
import { readJsonBody, sendJson } from '../server/httpJson'

// Vercel serverless function -> POST /api/guide. This is the Phase-4 guided-flow
// endpoint the citizen journey calls. Thin transport wrapper; the shared engine
// owns extraction + adaptive routing. GROQ_API_KEY stays server-side.
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method-not-allowed' })
    return
  }
  try {
    const body = await readJsonBody(req)
    const reply = await guideReply(getEngine(), body)
    sendJson(res, reply.status, reply.body)
  } catch {
    sendJson(res, 400, { error: 'bad-request' })
  }
}

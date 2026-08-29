import type { IncomingMessage, ServerResponse } from 'node:http'
import { interpretReply } from '../server/apiHandlers.js'
import { getEngine } from '../server/engineSingleton.js'
import { readJsonBody, sendJson } from '../server/httpJson.js'

// Vercel serverless function -> POST /api/interpret. Thin transport wrapper; all
// logic lives in the shared engine. GROQ_API_KEY stays in the server-side
// environment and is never sent to the browser.
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method-not-allowed' })
    return
  }
  try {
    const body = await readJsonBody(req)
    const reply = await interpretReply(getEngine(), body)
    sendJson(res, reply.status, reply.body)
  } catch {
    sendJson(res, 400, { error: 'bad-request' })
  }
}

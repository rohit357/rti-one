import type { IncomingMessage, ServerResponse } from 'node:http'
import { metricsReply } from '../server/apiHandlers.js'
import { getEngine } from '../server/engineSingleton.js'
import { sendJson } from '../server/httpJson.js'

// Vercel serverless function -> GET /api/metrics. Non-sensitive request-manager
// counters (counts + latency only; no prompts, no keys). On serverless these are
// per-warm-instance and reset on cold start — observability, not billing truth.
export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method-not-allowed' })
    return
  }
  const reply = metricsReply(getEngine())
  sendJson(res, reply.status, reply.body)
}

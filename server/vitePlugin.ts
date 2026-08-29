import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'
import { authorities } from '../src/data/authorities.js'
import { createGroqProvider } from './groqProvider.js'
import { createIntelligenceEngine, type IntelligenceEngine } from './intelligenceHandler.js'
import { configFromEnv, createRequestManager } from './requestManager.js'
import { draftReply, guideReply, interpretReply, metricsReply } from './apiHandlers.js'
import { readJsonBody, sendJson } from './httpJson.js'

// Vite plugin that mounts the server-side intelligence API on the dev and
// preview servers. It shares the exact request handlers with the Vercel
// serverless functions in /api (see server/apiHandlers.ts) so local behaviour
// matches production. The browser calls /api/* on the same origin; it never
// talks to Groq directly, and the API key stays in this Node process.

function interpretHandler(engine: IntelligenceEngine): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== 'POST') return next()
    readJsonBody(req)
      .then(async body => {
        const reply = await interpretReply(engine, body)
        sendJson(res, reply.status, reply.body)
      })
      .catch(() => sendJson(res, 400, { error: 'bad-request' }))
  }
}

function draftHandler(engine: IntelligenceEngine): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== 'POST') return next()
    readJsonBody(req)
      .then(async body => {
        const reply = await draftReply(engine, body)
        sendJson(res, reply.status, reply.body)
      })
      .catch(() => sendJson(res, 400, { error: 'bad-request' }))
  }
}

function guideHandler(engine: IntelligenceEngine): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== 'POST') return next()
    readJsonBody(req)
      .then(async body => {
        const reply = await guideReply(engine, body)
        sendJson(res, reply.status, reply.body)
      })
      .catch(() => sendJson(res, 400, { error: 'bad-request' }))
  }
}

// Dev-only: expose non-sensitive request-manager metrics (counts/latency, no
// prompts, no keys) for local observability and the browser verification pass.
function metricsHandler(engine: IntelligenceEngine): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== 'GET') return next()
    const reply = metricsReply(engine)
    sendJson(res, reply.status, reply.body)
  }
}

export function intelligenceApiPlugin(): Plugin {
  let apiKey: string | undefined

  const mount = (middlewares: Connect.Server) => {
    const engine = createIntelligenceEngine({
      provider: createGroqProvider({ apiKey, fetchImpl: globalThis.fetch }),
      authorities,
      // One manager per server so per-session budgets and metrics persist across
      // requests. Limits are environment-configurable (see configFromEnv).
      manager: createRequestManager(configFromEnv(process.env)),
    })
    middlewares.use('/api/interpret', interpretHandler(engine))
    middlewares.use('/api/draft', draftHandler(engine))
    middlewares.use('/api/guide', guideHandler(engine))
    middlewares.use('/api/metrics', metricsHandler(engine))
  }

  return {
    name: 'rti-intelligence-api',
    configResolved(config) {
      // loadEnv reads .env files (which are gitignored); shell env wins if set.
      const fileEnv = loadEnv(config.mode, config.root, '')
      apiKey = process.env.GROQ_API_KEY || fileEnv.GROQ_API_KEY
    },
    configureServer(server: ViteDevServer) {
      mount(server.middlewares)
    },
    configurePreviewServer(server: PreviewServer) {
      mount(server.middlewares)
    },
  }
}

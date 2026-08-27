import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'
import { authorities } from '../src/data/authorities'
import type { RequestInterpretation } from '../src/domain/rti'
import { createGroqProvider } from './groqProvider'
import { createIntelligenceEngine, type IntelligenceEngine } from './intelligenceHandler'

// Vite plugin that mounts the server-side intelligence API on the dev and
// preview servers. The browser calls /api/* on the same origin; it never talks
// to Groq directly, and the API key stays in this Node process.

const BODY_LIMIT = 100_000

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function interpretHandler(engine: IntelligenceEngine): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== 'POST') return next()
    readJson(req)
      .then(async body => {
        const need = typeof body.need === 'string' ? body.need : ''
        sendJson(res, 200, await engine.interpret(need))
      })
      .catch(() => sendJson(res, 400, { error: 'bad-request' }))
  }
}

function draftHandler(engine: IntelligenceEngine): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== 'POST') return next()
    readJson(req)
      .then(async body => {
        const need = typeof body.need === 'string' ? body.need : ''
        const interpretation = body.interpretation
        if (!interpretation || typeof interpretation !== 'object') {
          sendJson(res, 400, { error: 'bad-request' })
          return
        }
        sendJson(res, 200, await engine.draft(need, interpretation as RequestInterpretation))
      })
      .catch(() => sendJson(res, 400, { error: 'bad-request' }))
  }
}

export function intelligenceApiPlugin(): Plugin {
  let apiKey: string | undefined

  const mount = (middlewares: Connect.Server) => {
    const engine = createIntelligenceEngine({
      provider: createGroqProvider({ apiKey, fetchImpl: globalThis.fetch }),
      authorities,
    })
    middlewares.use('/api/interpret', interpretHandler(engine))
    middlewares.use('/api/draft', draftHandler(engine))
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

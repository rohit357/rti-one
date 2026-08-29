import { authorities } from '../src/data/authorities.js'
import { createGroqProvider } from './groqProvider.js'
import { createIntelligenceEngine, type IntelligenceEngine } from './intelligenceHandler.js'
import { configFromEnv, createRequestManager } from './requestManager.js'

// Builds the intelligence engine for serverless (Vercel) invocations. On Vercel
// the secrets live in process.env, so — unlike the Vite plugin, which also reads
// .env files via loadEnv — this reads GROQ_API_KEY straight from the environment.
//
// The engine is cached per process so warm invocations reuse one request manager
// (per-session budgets + metrics persist within a warm instance). A cold start
// rebuilds it; that only widens rate budgets and never affects safety, because
// the deterministic fallback is always available.

type Env = Record<string, string | undefined>

let cached: IntelligenceEngine | undefined

function build(env: Env): IntelligenceEngine {
  return createIntelligenceEngine({
    provider: createGroqProvider({ apiKey: env.GROQ_API_KEY, fetchImpl: globalThis.fetch }),
    authorities,
    manager: createRequestManager(configFromEnv(env)),
  })
}

export function getEngine(env: Env = process.env): IntelligenceEngine {
  // Only the default (process.env) engine is memoised; an explicit env (tests)
  // is always built fresh so cases stay isolated.
  if (env === process.env) {
    if (!cached) cached = build(env)
    return cached
  }
  return build(env)
}

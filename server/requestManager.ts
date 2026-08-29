import type { ChatResult } from './groqProvider.js'

// Centralized, server-side guard around every model call. It protects the Groq
// key's budget during development, testing and demos: per-session call cap,
// per-minute rate limit, per-session output-token budget, dedup cache, and
// bounded exponential-backoff retries for transient errors. It fails CLOSED —
// when a limit is hit it returns { ok:false } and the caller falls back to the
// deterministic path; it never silently retries forever and never logs secrets.

export interface ManagerConfig {
  maxCallsPerSession: number // hard cap on model calls per guided session
  requestsPerMinute: number // global limit across all sessions
  maxOutputTokensPerSession: number // output-token budget per session
  maxRetries: number // bounded retries for transient 429/5xx/network
  backoffBaseMs: number // base for exponential backoff
  cacheTtlMs: number // dedup cache lifetime
}

// Conservative defaults suitable for a solo hackathon developer. Every value is
// overridable from the environment (see configFromEnv).
export const DEFAULT_CONFIG: ManagerConfig = {
  maxCallsPerSession: 6,
  requestsPerMinute: 15,
  maxOutputTokensPerSession: 12000,
  maxRetries: 2,
  backoffBaseMs: 250,
  cacheTtlMs: 5 * 60 * 1000,
}

export interface ManagerMetrics {
  requestCount: number // physical model calls issued (counts each retry attempt)
  logicalCalls: number // logical calls (one per run that reached the provider)
  cacheHits: number
  cacheMisses: number
  fallbackCount: number // fail-closed or exhausted-retry results
  errorCount: number
  retries: number
  inputTokens: number
  outputTokens: number
  sessions: number
  lastLatencyMs: number
}

export interface RunInput {
  sessionId: string
  cacheKey: string
  chat: () => Promise<ChatResult>
}

export interface RequestManager {
  run(input: RunInput): Promise<ChatResult>
  metrics(): ManagerMetrics
  reset(): void
}

export interface ManagerDeps {
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

interface SessionState {
  calls: number
  outputTokens: number
}

interface CacheEntry {
  result: ChatResult
  expires: number
}

function isTransient(reason: string): boolean {
  return (
    reason === 'timeout' ||
    reason === 'network' ||
    reason === 'http-429' ||
    reason.startsWith('http-5')
  )
}

const num = (value: string | undefined, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** Read manager limits from an environment map, falling back to defaults. The
 * caller supplies the env (e.g. process.env) so this module needs no node types. */
export function configFromEnv(env: Record<string, string | undefined> = {}): ManagerConfig {
  return {
    maxCallsPerSession: num(env.GUIDE_MAX_CALLS_PER_SESSION, DEFAULT_CONFIG.maxCallsPerSession),
    requestsPerMinute: num(env.GUIDE_REQUESTS_PER_MINUTE, DEFAULT_CONFIG.requestsPerMinute),
    maxOutputTokensPerSession: num(env.GUIDE_MAX_OUTPUT_TOKENS_PER_SESSION, DEFAULT_CONFIG.maxOutputTokensPerSession),
    maxRetries: num(env.GUIDE_MAX_RETRIES, DEFAULT_CONFIG.maxRetries),
    backoffBaseMs: num(env.GUIDE_BACKOFF_BASE_MS, DEFAULT_CONFIG.backoffBaseMs),
    cacheTtlMs: num(env.GUIDE_CACHE_TTL_MS, DEFAULT_CONFIG.cacheTtlMs),
  }
}

export function createRequestManager(
  config: Partial<ManagerConfig> = {},
  deps: ManagerDeps = {},
): RequestManager {
  const cfg: ManagerConfig = { ...DEFAULT_CONFIG, ...config }
  const now = deps.now ?? (() => Date.now())
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))

  const cache = new Map<string, CacheEntry>()
  const sessions = new Map<string, SessionState>()
  let windowHits: number[] = [] // timestamps of recent logical calls

  const metrics: ManagerMetrics = {
    requestCount: 0,
    logicalCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    fallbackCount: 0,
    errorCount: 0,
    retries: 0,
    inputTokens: 0,
    outputTokens: 0,
    sessions: 0,
    lastLatencyMs: 0,
  }

  const failClosed = (reason: string): ChatResult => {
    metrics.fallbackCount++
    return { ok: false, reason }
  }

  const session = (id: string): SessionState => {
    let s = sessions.get(id)
    if (!s) {
      s = { calls: 0, outputTokens: 0 }
      sessions.set(id, s)
      metrics.sessions++
    }
    return s
  }

  return {
    async run({ sessionId, cacheKey, chat }: RunInput): Promise<ChatResult> {
      const t = now()

      // 1. Dedup cache — safe repeated inputs never reach the model or the budget.
      const cached = cache.get(cacheKey)
      if (cached && cached.expires > t) {
        metrics.cacheHits++
        return cached.result
      }
      if (cached) cache.delete(cacheKey)
      metrics.cacheMisses++

      // 2. Per-session budgets — fail closed BEFORE calling the model.
      const s = session(sessionId)
      if (s.calls >= cfg.maxCallsPerSession) return failClosed('budget-session-calls')
      if (s.outputTokens >= cfg.maxOutputTokensPerSession) return failClosed('budget-session-tokens')

      // 3. Global per-minute rate limit.
      windowHits = windowHits.filter(ts => ts > t - 60_000)
      if (windowHits.length >= cfg.requestsPerMinute) return failClosed('rate-limit')

      // 4. Reserve the slot (one logical call, even if it errors) so failures
      //    still consume budget and cannot become an unbounded retry storm.
      windowHits.push(t)
      s.calls++
      metrics.logicalCalls++

      // 5. Issue with bounded exponential backoff on transient errors only.
      let attempt = 0
      let res: ChatResult
      for (;;) {
        const start = now()
        res = await chat()
        metrics.requestCount++
        metrics.lastLatencyMs = now() - start

        if (res.ok) {
          const usage = res.usage
          if (usage) {
            metrics.inputTokens += usage.inputTokens
            metrics.outputTokens += usage.outputTokens
            s.outputTokens += usage.outputTokens
          }
          cache.set(cacheKey, { result: res, expires: now() + cfg.cacheTtlMs })
          return res
        }

        metrics.errorCount++
        if (isTransient(res.reason) && attempt < cfg.maxRetries) {
          metrics.retries++
          await sleep(cfg.backoffBaseMs * 2 ** attempt)
          attempt++
          continue
        }
        break
      }

      // Exhausted retries / non-transient error → caller must fall back.
      metrics.fallbackCount++
      return res
    },

    metrics: () => ({ ...metrics }),

    reset() {
      cache.clear()
      sessions.clear()
      windowHits = []
      for (const k of Object.keys(metrics) as Array<keyof ManagerMetrics>) metrics[k] = 0
    },
  }
}

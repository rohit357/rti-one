// Server-only Groq provider. The API key lives here and is never imported by
// any browser/client module. Provider logic is isolated behind this interface
// so the model/provider can be swapped without touching UI or domain code.

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export type ChatResult =
  | { ok: true; content: string; usage?: TokenUsage }
  | { ok: false; reason: string }

export interface ChatRequest {
  system: string
  user: string
  maxTokens: number
}

export interface GroqProviderOptions {
  apiKey?: string
  model?: string
  baseUrl?: string
  timeoutMs?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
  fetchImpl?: typeof fetch
}

export interface GroqProvider {
  hasKey: boolean
  model: string
  chat(req: ChatRequest): Promise<ChatResult>
}

const DEFAULT_MODEL = 'openai/gpt-oss-120b'
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_TIMEOUT = 12000
// gpt-oss is a reasoning model: it spends completion tokens on internal
// reasoning before emitting the answer. Left unbounded (or with too small a
// max_tokens) the JSON is truncated mid-object and every call fails validation.
// 'low' keeps reasoning short, fast (~0.5s), and cheap while still grounding
// correctly — verified against the live model.
const DEFAULT_REASONING_EFFORT = 'low'

export function createGroqProvider(opts: GroqProviderOptions = {}): GroqProvider {
  const apiKey = (opts.apiKey ?? '').trim()
  const model = opts.model ?? DEFAULT_MODEL
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT
  const reasoningEffort = opts.reasoningEffort ?? DEFAULT_REASONING_EFFORT
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch

  return {
    hasKey: apiKey.length > 0,
    model,
    async chat({ system, user, maxTokens }: ChatRequest): Promise<ChatResult> {
      if (!apiKey) return { ok: false, reason: 'no-key' }
      if (typeof fetchImpl !== 'function') return { ok: false, reason: 'no-fetch' }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: maxTokens,
            reasoning_effort: reasoningEffort,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
          signal: controller.signal,
        })

        if (!response.ok) return { ok: false, reason: `http-${response.status}` }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: unknown } }>
          usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
        }
        const content = data?.choices?.[0]?.message?.content
        if (typeof content !== 'string' || content.trim().length === 0) return { ok: false, reason: 'empty' }
        const inputTokens = typeof data.usage?.prompt_tokens === 'number' ? data.usage.prompt_tokens : 0
        const outputTokens = typeof data.usage?.completion_tokens === 'number' ? data.usage.completion_tokens : 0
        return { ok: true, content, usage: { inputTokens, outputTokens } }
      } catch (error) {
        // Never surface the key or full request. Only classify the failure.
        const aborted = error instanceof Error && error.name === 'AbortError'
        return { ok: false, reason: aborted ? 'timeout' : 'network' }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

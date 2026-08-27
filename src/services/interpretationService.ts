import type { GuidedRequestSession, InterpretationResult, RequestInterpretation, RtiDraft } from '../domain/rti'
import { deterministicDraft, deterministicInterpret } from '../intelligence/deterministic'

// Deterministic interpreter — kept as the safe offline fallback engine and
// exercised directly by tests. The LLM-assisted path lives in
// intelligenceService; both share the pure logic in src/intelligence/deterministic
// so behaviour cannot drift between them.
export const interpretationService = {
  async interpret(need: string): Promise<InterpretationResult> {
    await new Promise(resolve => setTimeout(resolve, 450))
    return deterministicInterpret(need)
  },
  createDraft(session: GuidedRequestSession, interpretation: RequestInterpretation): RtiDraft {
    return deterministicDraft(session, interpretation)
  },
}

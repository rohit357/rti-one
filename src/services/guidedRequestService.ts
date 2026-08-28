import type { GuidedRequestSession } from '../domain/rti'
import { storage } from './storage'

// v2 adds the evolving Phase 4 fields (facts, askedFields, question). Old v1
// sessions are migrated on read, keeping only the still-valid fields so an
// in-progress draft from before the upgrade is not lost.
const KEY = 'rti-one.guided-request.v2'
const LEGACY_KEY = 'rti-one.guided-request.v1'

function migrateLegacy(): GuidedRequestSession | null {
  const old = storage.get<GuidedRequestSession>(LEGACY_KEY)
  if (!old) return null
  const migrated: GuidedRequestSession = {
    need: old.need ?? '',
    interpretation: old.interpretation,
    draft: old.draft,
  }
  storage.set(KEY, migrated)
  storage.remove(LEGACY_KEY)
  return migrated
}

export const guidedRequestService = {
  load: (): GuidedRequestSession => storage.get<GuidedRequestSession>(KEY) ?? migrateLegacy() ?? { need: '' },
  save: (session: GuidedRequestSession) => storage.set(KEY, session),
  clear: () => storage.remove(KEY),
}

import type { GuidedRequestSession } from '../domain/rti'
import { storage } from './storage'

const key = 'rti-one.guided-request.v1'
export const guidedRequestService = {
  load: () => storage.get<GuidedRequestSession>(key) ?? { need: '' },
  save: (session: GuidedRequestSession) => storage.set(key, session),
  clear: () => storage.remove(key)
}

import type { Authority } from '../domain/rti.js'
import { toAuthorities } from '../knowledge/index.js'

// The flat Authority[] the app has always consumed is now a PROJECTION of the
// richer, provenance-aware knowledge base (src/knowledge). The six original
// authorities keep byte-identical id/name/jurisdiction/location/description, so
// every existing consumer, grounding rule and test is unchanged; demo and added
// records simply extend the list.
export const authorities: Authority[] = toAuthorities()

import type { Jurisdiction } from '../domain/rti.js'

// Knowledge layer schema. The knowledge base — NOT the model — is the source of
// truth for which public authorities exist and what each is responsible for.
// Every record carries provenance so a reviewer can see where a mapping came
// from and how much to trust it.

// Controlled service vocabulary. The model classifies a citizen's free text into
// one of these; retrieval matches records by the same vocab. Keeping it a small
// closed set stops the model from inventing arbitrary routing categories.
export const SERVICE_TYPES = [
  'road',
  'highway',
  'streetlight',
  'electricity',
  'water',
  'sanitation',
  'railway',
  'housing',
  'urban',
  'transport-permit',
  'other',
] as const

export type ServiceType = (typeof SERVICE_TYPES)[number]

// Human-friendly labels for selection widgets. Internal government terminology
// is deliberately avoided so citizens choose in plain language.
export const SERVICE_LABELS: Record<ServiceType, string> = {
  road: 'Roads, potholes or repairs',
  highway: 'A national highway',
  streetlight: 'Streetlights or municipal lighting',
  electricity: 'Electricity supply or power cuts',
  water: 'Water supply or drainage',
  sanitation: 'Sanitation, sewage or garbage',
  railway: 'Railways, stations or trains',
  housing: 'Housing or urban development',
  urban: 'Urban planning or civic works',
  'transport-permit': 'Vehicle, licence or transport permits',
  other: 'Something else',
}

export function isServiceType(value: unknown): value is ServiceType {
  return typeof value === 'string' && (SERVICE_TYPES as readonly string[]).includes(value)
}

export type SourceType = 'official-portal' | 'official-department' | 'synthetic'

// How much the mapping can be trusted. `verified` = confirmed against a primary
// official source this session; `unverified` = a real body on a known official
// domain, not re-confirmed here; `uncertain` = evidence insufficient, flagged
// rather than fabricated; `synthetic` = an illustrative demo record.
export type VerificationStatus = 'verified' | 'unverified' | 'uncertain' | 'synthetic'

export interface Provenance {
  sourceTitle: string
  sourceType: SourceType
  verificationStatus: VerificationStatus
  retrievedAt: string // ISO date, or 'n/a' for synthetic records
  sourceUrl?: string
  notes?: string
}

// A public authority a citizen can direct an RTI to, plus the retrieval signals
// the routing engine needs and the provenance that backs it.
export interface AuthorityRecord {
  id: string // stable, unique — never reused, never order-dependent
  name: string
  jurisdiction: Jurisdiction // government level: Central | State/UT
  state: string // owning State/UT; '' for Central-wide bodies
  region?: string // optional district/city scope
  location: string // display location (identical to the legacy Authority.location)
  department: string // parent ministry/department
  description: string
  serviceTypes: ServiceType[] // what this body is responsible for
  keywords: string[] // free entities/terms for retrieval scoring
  aliases: string[] // alternate names a citizen might type
  parentId?: string // parent record id, for parent/child relationships
  demo: boolean // true = clearly-labelled illustrative record, not a real mapping
  provenance: Provenance
}

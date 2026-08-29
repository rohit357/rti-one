import type { Authority } from '../domain/rti.js'
import { authorityRecords } from './dataset.js'
import type { AuthorityRecord } from './types.js'

// Access layer over the knowledge base. Everything the app consumes is keyed by
// stable `id`; nothing depends on array order.

export { authorityRecords }
export type { AuthorityRecord } from './types.js'
export { SERVICE_LABELS, SERVICE_TYPES, isServiceType } from './types.js'
export type { ServiceType } from './types.js'

// Project a rich record down to the legacy Authority shape. The six original
// authorities keep byte-identical fields, so every existing consumer and test is
// unaffected; demo/added records simply extend the list.
export function toAuthority(record: AuthorityRecord): Authority {
  return {
    id: record.id,
    name: record.name,
    jurisdiction: record.jurisdiction,
    location: record.location,
    description: record.description,
  }
}

export function toAuthorities(records: AuthorityRecord[] = authorityRecords): Authority[] {
  return records.map(toAuthority)
}

const byId = new Map(authorityRecords.map(record => [record.id, record]))

export function getRecord(id: string): AuthorityRecord | undefined {
  return byId.get(id)
}

export function getRecords(ids: string[]): AuthorityRecord[] {
  return ids.map(id => byId.get(id)).filter((record): record is AuthorityRecord => Boolean(record))
}

export interface IntegrityReport {
  ok: boolean
  total: number
  demoCount: number
  duplicateIds: string[]
  conflicts: string[] // same display name+state under different ids
  missingProvenance: string[]
}

// Ingestion-time integrity: unique ids, no silently conflicting mappings, and
// provenance present on every record. Conflicts are FLAGGED, never auto-merged.
export function knowledgeIntegrity(records: AuthorityRecord[] = authorityRecords): IntegrityReport {
  const seenIds = new Set<string>()
  const duplicateIds: string[] = []
  const nameKey = new Map<string, string>()
  const conflicts: string[] = []
  const missingProvenance: string[] = []

  for (const record of records) {
    if (seenIds.has(record.id)) duplicateIds.push(record.id)
    seenIds.add(record.id)

    const key = `${record.name.toLowerCase()}|${record.state.toLowerCase()}`
    const existing = nameKey.get(key)
    if (existing && existing !== record.id) conflicts.push(`${key} -> ${existing}, ${record.id}`)
    else nameKey.set(key, record.id)

    const p = record.provenance
    if (!p || !p.sourceTitle || !p.verificationStatus || !p.retrievedAt) missingProvenance.push(record.id)
  }

  return {
    ok: duplicateIds.length === 0 && conflicts.length === 0 && missingProvenance.length === 0,
    total: records.length,
    demoCount: records.filter(r => r.demo).length,
    duplicateIds,
    conflicts,
    missingProvenance,
  }
}

import type { AuthorityRecord, Provenance } from './types'

// Representative — NOT nationwide — synthetic-friendly knowledge base for the
// RTI One prototype.
//
// Provenance honesty rules applied here:
// - The Central RTI request portal was confirmed this session (see RTI_PORTAL).
// - Union ministries are real bodies on known official domains but were NOT
//   re-confirmed this session (automated fetch was blocked/unavailable), so they
//   are marked 'unverified', never 'verified'.
// - State/UT bodies are real but their exact official URL was not confirmed
//   here, so the URL is omitted and the record is 'unverified'.
// - Demo records are clearly flagged (demo: true, verificationStatus 'synthetic')
//   and exist only to exercise adaptive questioning. They are not claims about
//   real authority responsibility.
//
// Application logic must never depend on the ORDER of this array — everything is
// keyed by stable `id`.

// Confirmed 2026-08-28: official Government of India RTI portal, an initiative of
// the Department of Personnel & Training (DoPT), hosted by NIC.
const RTI_PORTAL = 'https://rtionline.gov.in'
const VERIFIED_AT = '2026-08-28'

function unionMinistry(url: string, title: string): Provenance {
  return {
    sourceTitle: title,
    sourceType: 'official-department',
    verificationStatus: 'unverified',
    retrievedAt: VERIFIED_AT,
    sourceUrl: url,
    notes: `Real Union ministry on its official domain; not re-confirmed this session. Central RTI directory ${RTI_PORTAL} confirmed ${VERIFIED_AT}.`,
  }
}

function stateBody(notes: string): Provenance {
  return {
    sourceTitle: 'State/UT government department',
    sourceType: 'official-department',
    verificationStatus: 'unverified',
    retrievedAt: VERIFIED_AT,
    notes: `${notes} Exact official URL not confirmed this session; not fabricated.`,
  }
}

function demoSource(purpose: string): Provenance {
  return {
    sourceTitle: 'Illustrative demo record (RTI One prototype)',
    sourceType: 'synthetic',
    verificationStatus: 'synthetic',
    retrievedAt: 'n/a',
    notes: `Synthetic record, not a real authority mapping. Exists to ${purpose}`,
  }
}

export const authorityRecords: AuthorityRecord[] = [
  // ---- Real Union ministries (Central) -------------------------------------
  {
    id: 'central-morth',
    name: 'Ministry of Road Transport & Highways',
    jurisdiction: 'Central',
    state: '',
    location: 'New Delhi',
    department: 'Ministry of Road Transport & Highways',
    description: 'National highways, road transport policy and road safety.',
    serviceTypes: ['highway', 'road', 'transport-permit'],
    keywords: ['national highway', 'nh', 'road transport', 'road safety', 'toll', 'expressway', 'morth'],
    aliases: ['morth', 'ministry of road transport and highways', 'ministry of road transport & highways'],
    demo: false,
    provenance: { ...unionMinistry('https://morth.gov.in', 'Ministry of Road Transport & Highways'), retrievedAt: VERIFIED_AT },
  },
  {
    id: 'central-railways',
    name: 'Ministry of Railways',
    jurisdiction: 'Central',
    state: '',
    location: 'New Delhi',
    department: 'Ministry of Railways',
    description: 'Railway policy, operations and public services.',
    serviceTypes: ['railway'],
    keywords: ['railway', 'train', 'station', 'platform', 'coach', 'irctc', 'reservation'],
    aliases: ['ministry of railways', 'indian railways', 'railways'],
    demo: false,
    provenance: { ...unionMinistry('https://indianrailways.gov.in', 'Ministry of Railways / Indian Railways'), retrievedAt: VERIFIED_AT },
  },
  {
    id: 'central-urban',
    name: 'Ministry of Housing & Urban Affairs',
    jurisdiction: 'Central',
    state: '',
    location: 'New Delhi',
    department: 'Ministry of Housing & Urban Affairs',
    description: 'Urban development and central housing programmes.',
    serviceTypes: ['housing', 'urban'],
    keywords: ['housing', 'urban development', 'smart city', 'pmay', 'metro', 'town planning'],
    aliases: ['mohua', 'ministry of housing and urban affairs', 'ministry of housing & urban affairs'],
    demo: false,
    provenance: { ...unionMinistry('https://mohua.gov.in', 'Ministry of Housing & Urban Affairs'), retrievedAt: VERIFIED_AT },
  },
  // ---- Real State/UT departments -------------------------------------------
  {
    id: 'state-mh-transport',
    name: 'Maharashtra Transport Department',
    jurisdiction: 'State/UT',
    state: 'Maharashtra',
    location: 'Maharashtra',
    department: 'Maharashtra Transport Department',
    description: 'State transport services, permits and road safety.',
    serviceTypes: ['transport-permit', 'road'],
    keywords: ['rto', 'permit', 'driving licence', 'bus', 'vehicle registration', 'maharashtra transport'],
    aliases: ['maharashtra transport department', 'maharashtra rto'],
    demo: false,
    provenance: { ...stateBody('Maharashtra state transport department.'), retrievedAt: VERIFIED_AT },
  },
  {
    id: 'state-ka-urban',
    name: 'Karnataka Urban Development Department',
    jurisdiction: 'State/UT',
    state: 'Karnataka',
    location: 'Karnataka',
    department: 'Karnataka Urban Development Department',
    description: 'Urban planning and state urban development.',
    serviceTypes: ['urban', 'housing'],
    keywords: ['urban development', 'town planning', 'karnataka', 'bengaluru planning', 'bbmp'],
    aliases: ['karnataka urban development department'],
    demo: false,
    provenance: { ...stateBody('Karnataka urban development department.'), retrievedAt: VERIFIED_AT },
  },
  {
    id: 'ut-delhi-pwd',
    name: 'Delhi Public Works Department',
    jurisdiction: 'State/UT',
    state: 'Delhi',
    location: 'Delhi',
    department: 'Delhi Public Works Department',
    description: 'Public works and civic infrastructure in Delhi.',
    serviceTypes: ['road'],
    keywords: ['pwd', 'public works', 'delhi road', 'flyover', 'road repair', 'civic infrastructure'],
    aliases: ['delhi pwd', 'delhi public works department'],
    demo: false,
    provenance: { ...stateBody('Delhi Public Works Department.'), retrievedAt: VERIFIED_AT },
  },
  // ---- Demo records (clearly synthetic) — exercise adaptive questioning -----
  // Delhi civic cluster: one locality, several service owners, so a vague Delhi
  // civic issue yields multiple candidates distinguished only by SERVICE TYPE.
  {
    id: 'demo-delhi-mcd-lighting',
    name: 'Municipal Corporation of Delhi — Street Lighting (demo)',
    jurisdiction: 'State/UT',
    state: 'Delhi',
    region: 'Delhi',
    location: 'Delhi',
    department: 'Municipal Corporation of Delhi',
    description: 'Illustrative demo record: local street-lighting complaints in Delhi.',
    serviceTypes: ['streetlight'],
    keywords: ['streetlight', 'street light', 'lamp post', 'lighting', 'dark street', 'pole light'],
    aliases: ['mcd', 'municipal corporation of delhi'],
    demo: true,
    provenance: demoSource('demonstrate service-type based routing (lighting).'),
  },
  {
    id: 'demo-delhi-discom',
    name: 'Delhi Electricity Distribution (demo DISCOM)',
    jurisdiction: 'State/UT',
    state: 'Delhi',
    region: 'Delhi',
    location: 'Delhi',
    department: 'Electricity Distribution Company',
    description: 'Illustrative demo record: household electricity supply issues in Delhi.',
    serviceTypes: ['electricity'],
    keywords: ['electricity', 'power cut', 'power supply', 'meter', 'outage', 'voltage', 'discom'],
    aliases: ['discom', 'electricity board'],
    demo: true,
    provenance: demoSource('demonstrate service-type based routing (electricity).'),
  },
  {
    id: 'demo-delhi-water',
    name: 'Delhi Water & Sanitation (demo board)',
    jurisdiction: 'State/UT',
    state: 'Delhi',
    region: 'Delhi',
    location: 'Delhi',
    department: 'Water & Sanitation Board',
    description: 'Illustrative demo record: water supply, drainage and sanitation in Delhi.',
    serviceTypes: ['water', 'sanitation'],
    keywords: ['water supply', 'drainage', 'sewer', 'sanitation', 'garbage', 'tap', 'drinking water'],
    aliases: ['water board', 'jal board'],
    demo: true,
    provenance: demoSource('demonstrate service-type based routing (water/sanitation).'),
  },
  // Cross-state roads: same service (road), different LOCALITY/level, so an
  // unlocated road complaint is distinguished by WHERE the road is.
  {
    id: 'demo-mh-pwd-roads',
    name: 'Maharashtra Public Works Dept — Roads (demo)',
    jurisdiction: 'State/UT',
    state: 'Maharashtra',
    location: 'Maharashtra',
    department: 'Public Works Department',
    description: 'Illustrative demo record: state-maintained roads in Maharashtra.',
    serviceTypes: ['road'],
    keywords: ['maharashtra road', 'state highway', 'pothole', 'road repair', 'pwd maharashtra'],
    aliases: ['maharashtra pwd'],
    demo: true,
    provenance: demoSource('demonstrate locality-based routing for roads across states.'),
  },
]

import type { Authority } from '../domain/rti'

export const authorities: Authority[] = [
  { id: 'central-morth', name: 'Ministry of Road Transport & Highways', jurisdiction: 'Central', location: 'New Delhi', description: 'National highways, road transport policy and road safety.' },
  { id: 'central-railways', name: 'Ministry of Railways', jurisdiction: 'Central', location: 'New Delhi', description: 'Railway policy, operations and public services.' },
  { id: 'central-urban', name: 'Ministry of Housing & Urban Affairs', jurisdiction: 'Central', location: 'New Delhi', description: 'Urban development and central housing programmes.' },
  { id: 'state-mh-transport', name: 'Maharashtra Transport Department', jurisdiction: 'State/UT', location: 'Maharashtra', description: 'State transport services, permits and road safety.' },
  { id: 'state-ka-urban', name: 'Karnataka Urban Development Department', jurisdiction: 'State/UT', location: 'Karnataka', description: 'Urban planning and state urban development.' },
  { id: 'ut-delhi-pwd', name: 'Delhi Public Works Department', jurisdiction: 'State/UT', location: 'Delhi', description: 'Public works and civic infrastructure in Delhi.' }
]

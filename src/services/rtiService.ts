import type { Authority, RtiApplication, RtiDraft } from '../domain/rti'
import { authorities } from '../data/authorities'
import { storage } from './storage'

const applicationsKey = 'rti-one.applications.v1'
const wait = () => new Promise(resolve => setTimeout(resolve, 300))
const getApps = () => storage.get<RtiApplication[]>(applicationsKey) ?? []
const putApps = (apps: RtiApplication[]) => storage.set(applicationsKey, apps)
const registrationNumber = (sequence: number) => `RTI/ONE/2026/${String(sequence).padStart(5, '0')}`

export const rtiService = {
  async listAuthorities(jurisdiction?: string): Promise<Authority[]> { await wait(); return authorities.filter(a => !jurisdiction || a.jurisdiction === jurisdiction) },
  async listApplications(): Promise<RtiApplication[]> { await wait(); return getApps() },
  async getApplication(id: string): Promise<RtiApplication | undefined> { await wait(); return getApps().find(app => app.id === id) },
  async submit(draft: RtiDraft, applicantName: string): Promise<RtiApplication> {
    await wait()
    if (!draft.jurisdiction || !draft.authorityId || !draft.subject.trim() || !draft.requestText.trim()) throw new Error('Complete every request field before submitting.')
    const apps = getApps(); const sequence = apps.length + 1; const now = '23 Aug 2026, 21:45 IST'
    const application: RtiApplication = {
      id: registrationNumber(sequence), jurisdiction: draft.jurisdiction, authorityId: draft.authorityId,
      subject: draft.subject.trim(), requestText: draft.requestText.trim(), applicantName, createdAt: now,
      status: 'Submitted', timeline: [
        { date: now, title: 'Application submitted', detail: 'Your mock RTI request has been registered.' },
        { date: 'Within 48 hours', title: 'Assignment expected', detail: 'The public authority will assign the request to its CPIO.' },
        { date: 'Within 30 days', title: 'Response due', detail: 'A response timeline will appear here in this prototype.' }
      ]
    }
    putApps([application, ...apps]); return application
  }
}

export { registrationNumber }

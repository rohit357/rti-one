import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Authority, RtiApplication } from '../domain/rti'
import { rtiService } from '../services/rtiService'
import { EmptyState, Loading, StatusPill, statusHint } from './kit'

const authorityName = (id: string, list: Authority[]) =>
  list.find(authority => authority.id === id)?.name ?? 'Public authority'

export function ApplicationDetail() {
  // Registration numbers contain slashes, so the route uses a splat and the id
  // is the captured remainder rather than a single ":id" segment.
  const id = useParams()['*'] ?? ''
  const [app, setApp] = useState<RtiApplication | null | undefined>(undefined)
  const [authorities, setAuthorities] = useState<Authority[]>([])

  useEffect(() => {
    rtiService.getApplication(id).then(setApp)
    rtiService.listAuthorities().then(setAuthorities)
  }, [id])

  if (app === undefined) return <Loading label="Loading your case…" rows={3} />

  if (app === null)
    return (
      <div className="page">
        <EmptyState
          title="Case not found"
          action={
            <Link className="text-link" to="/cases">
              Return to my cases
            </Link>
          }
        >
          <p>We couldn’t find a request with that registration number.</p>
        </EmptyState>
      </div>
    )

  const authority = authorities.find(a => a.id === app.authorityId)

  return (
    <div className="page detail">
      <Link className="back-link" to="/cases">
        ← My cases
      </Link>

      <section className="case-hero">
        <div>
          <p className="eyebrow">Your information request</p>
          <h1>{app.subject}</h1>
          <p className="lead">
            {authorityName(app.authorityId, authorities)}
            {authority ? ` · ${authority.jurisdiction} · ${authority.location}` : ''}
          </p>
        </div>
        <StatusPill status={app.status} large />
      </section>

      <p className="status-line">{statusHint(app.status)}</p>

      <section className="case-meta">
        <div>
          <small>Registration number</small>
          <strong>{app.id}</strong>
        </div>
        <div>
          <small>Submitted</small>
          <strong>{app.createdAt}</strong>
        </div>
        <div>
          <small>Applicant</small>
          <strong>{app.applicantName}</strong>
        </div>
      </section>

      <div className="case-layout">
        <section className="card request-record">
          <p className="eyebrow">What you asked for</p>
          <h2>Request record</h2>
          <p className="request-text">{app.requestText}</p>
        </section>

        <section className="card timeline-card">
          <p className="eyebrow">Case progress</p>
          <h2>Tracking timeline</h2>
          <ol className="timeline">
            {app.timeline.map((event, i) => (
              <li key={event.title} className={i === 0 ? 'done' : 'upcoming'}>
                <span className="timeline-dot" aria-hidden="true" />
                <div className="timeline-body">
                  <b>{event.title}</b>
                  <small>{event.date}</small>
                  <p>{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="quiet-note">
            Timeline dates are synthetic placeholders for this prototype.
          </p>
        </section>
      </div>
    </div>
  )
}

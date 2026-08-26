import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ApplicationStatus, RtiApplication } from '../domain/rti'
import { rtiService } from '../services/rtiService'
import { EmptyState, ErrorState, Loading, StatusPill, statusHint } from './kit'

type Filter = 'All' | ApplicationStatus
const FILTERS: Filter[] = ['All', 'Submitted', 'Under review', 'Response due', 'Draft']

export function Cases() {
  const [apps, setApps] = useState<RtiApplication[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('All')

  const load = () => {
    setError('')
    setApps(null)
    rtiService
      .listApplications()
      .then(setApps)
      .catch(() => setError('Your cases could not be loaded.'))
  }
  useEffect(load, [])

  const counts = useMemo(() => {
    const map = new Map<ApplicationStatus, number>()
    for (const app of apps ?? []) map.set(app.status, (map.get(app.status) ?? 0) + 1)
    return map
  }, [apps])

  const visible = useMemo(
    () => (apps ?? []).filter(app => filter === 'All' || app.status === filter),
    [apps, filter],
  )

  return (
    <div className="page cases">
      <section className="page-head">
        <div>
          <p className="eyebrow">Your requests</p>
          <h1>My cases</h1>
          <p className="lead">Every request you’ve started, with its current status and records.</p>
        </div>
        <Link className="primary" to="/rti/new">
          Ask for information
        </Link>
      </section>

      {apps && apps.length > 0 && (
        <>
          <div className="summary" role="group" aria-label="Case counts by status">
            <div className="summary-tile">
              <strong>{apps.length}</strong>
              <span>Total</span>
            </div>
            {(['Submitted', 'Under review', 'Response due'] as ApplicationStatus[]).map(status => (
              <div className="summary-tile" key={status}>
                <strong>{counts.get(status) ?? 0}</strong>
                <span>{status}</span>
              </div>
            ))}
          </div>

          <div className="filters" role="group" aria-label="Filter cases by status">
            {FILTERS.map(f => (
              <button
                key={f}
                className={filter === f ? 'chip active' : 'chip'}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f}
                {f !== 'All' && counts.get(f) ? ` (${counts.get(f)})` : ''}
              </button>
            ))}
          </div>
        </>
      )}

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !apps ? (
        <Loading label="Loading your cases…" rows={3} />
      ) : apps.length === 0 ? (
        <EmptyState
          title="Your workspace is ready"
          action={
            <Link className="primary" to="/rti/new">
              Start with a question
            </Link>
          }
        >
          <p>You haven’t filed a request yet. When you do, it will appear here with live status.</p>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title={`No ${filter.toLowerCase()} cases`}>
          <p>Nothing matches this filter right now.</p>
        </EmptyState>
      ) : (
        <div className="case-list">
          {visible.map(app => (
            <Link className="case-card" to={`/applications/${app.id}`} key={app.id}>
              <div className="case-card-main">
                <StatusPill status={app.status} />
                <h3>{app.subject}</h3>
                <small className="muted">
                  {app.id} · submitted {app.createdAt}
                </small>
                <p className="case-hint">{statusHint(app.status)}</p>
              </div>
              <span className="chevron" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

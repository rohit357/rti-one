import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { RtiApplication, User } from '../domain/rti'
import { guidedRequestService } from '../services/guidedRequestService'
import { rtiService } from '../services/rtiService'
import { EmptyState, ErrorState, Loading, StatusPill } from './kit'

const STEPS = [
  {
    n: '01',
    title: 'Understand',
    body: 'Describe what you need in everyday language. No need to know which department handles it.',
  },
  {
    n: '02',
    title: 'Guide',
    body: 'We show what we understood — location, level, topic and a likely authority. You confirm or change any part.',
  },
  {
    n: '03',
    title: 'File',
    body: 'Your answer becomes a structured RTI request. Edit every detail, then submit.',
  },
  {
    n: '04',
    title: 'Track',
    body: 'Follow status and the response timeline from your cases workspace.',
  },
]

export function Home({ user }: { user: User }) {
  const navigate = useNavigate()
  const [need, setNeed] = useState('')
  const [apps, setApps] = useState<RtiApplication[] | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    setApps(null)
    rtiService
      .listApplications()
      .then(setApps)
      .catch(() => setError('Your cases could not be loaded.'))
  }
  useEffect(load, [])

  const startAsk = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = need.trim()
    if (trimmed) guidedRequestService.save({ need: trimmed })
    navigate('/rti/new')
  }

  const firstName = user.name.split(' ')[0]
  const recent = apps?.slice(0, 3) ?? []

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Citizen information workspace</p>
          <h1>What do you need to know?</h1>
          <p className="lead">
            Welcome back, {firstName}. Ask a public authority for information — start in plain
            language and we’ll help you turn it into a clear request.
          </p>
          <form className="quick-ask" onSubmit={startAsk}>
            <label className="sr-only" htmlFor="quick-need">
              What do you need information about?
            </label>
            <textarea
              id="quick-need"
              rows={3}
              value={need}
              placeholder="e.g. Why has the road repair near my home been delayed?"
              onChange={event => setNeed(event.target.value)}
            />
            <div className="quick-ask-actions">
              <button className="primary" type="submit">
                Ask for information
              </button>
              <Link className="text-link" to="/help">
                New to RTI? Read the guide →
              </Link>
            </div>
          </form>
        </div>
      </section>

      <section className="how-it-works" aria-labelledby="how-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">How RTI One works</p>
            <h2 id="how-title">From a question to a tracked request</h2>
          </div>
        </div>
        <ol className="steps">
          {STEPS.map(step => (
            <li className="step" key={step.n}>
              <span className="step-n" aria-hidden="true">
                {step.n}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="recent" aria-labelledby="recent-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">At a glance</p>
            <h2 id="recent-title">Recent cases</h2>
          </div>
          {recent.length > 0 && (
            <Link className="text-link" to="/cases">
              View all cases →
            </Link>
          )}
        </div>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !apps ? (
          <Loading label="Loading your cases…" rows={2} />
        ) : recent.length === 0 ? (
          <EmptyState
            title="No requests yet"
            action={
              <Link className="text-link" to="/rti/new">
                Start with a question →
              </Link>
            }
          >
            <p>When you submit a request, its status and records appear here.</p>
          </EmptyState>
        ) : (
          <div className="case-list">
            {recent.map(app => (
              <Link className="case-card" to={`/applications/${app.id}`} key={app.id}>
                <div className="case-card-main">
                  <StatusPill status={app.status} />
                  <h3>{app.subject}</h3>
                  <small className="muted">
                    {app.id} · submitted {app.createdAt}
                  </small>
                </div>
                <span className="chevron" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import type { Authority, RtiApplication, RtiDraft, User } from '../domain/rti'
import { authService } from '../services/authService'
import { rtiService } from '../services/rtiService'

const Loading = () => <p className="state">Loading…</p>
const ErrorState = ({ message }: { message: string }) => <p className="state error">{message}</p>
const authorityName = (id: string, list: Authority[]) => list.find(a => a.id === id)?.name ?? 'Public authority'

function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const navigate = useNavigate()
  return <><header><Link className="brand" to="/dashboard">RTI One</Link><nav><Link to="/dashboard">Dashboard</Link><Link to="/rti/new">File RTI</Link><button onClick={() => { authService.logout(); navigate('/login') }}>Sign out</button></nav></header><main><p className="hello">Signed in as {user.name}</p>{children}</main></>
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState('demo@rtione.in'); const [password, setPassword] = useState('demo123'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setError(''); try { onLogin(await authService.login(email, password)) } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.') } finally { setBusy(false) } }
  return <main className="auth"><section className="card"><p className="eyebrow">Citizen RTI portal prototype</p><h1>Make your right to information easier to use.</h1><p>One clear starting point for Central and State/UT public authorities.</p><form onSubmit={submit}><label>Email<input value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <ErrorState message={error} />}<button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to demo'}</button></form><small>Demo: demo@rtione.in · demo123</small></section></main>
}

function Dashboard({ user }: { user: User }) {
  const [apps, setApps] = useState<RtiApplication[] | null>(null); const [error, setError] = useState('')
  useEffect(() => { rtiService.listApplications().then(setApps).catch(() => setError('Applications could not be loaded.')) }, [])
  return <Shell user={user}><section className="hero"><div><p className="eyebrow">Your RTI workspace</p><h1>Good evening, {user.name.split(' ')[0]}.</h1><p>File a request, follow its progress, and keep your records in one place.</p></div><Link className="primary" to="/rti/new">Start a new RTI</Link></section><section><h2>Your applications</h2>{error ? <ErrorState message={error} /> : !apps ? <Loading /> : apps.length === 0 ? <div className="empty"><p>You have not filed an RTI yet.</p><Link to="/rti/new">Start your first request →</Link></div> : <div className="list">{apps.map(app => <Link className="application" to={`/applications/${app.id}`} key={app.id}><span><strong>{app.subject}</strong><small>{app.id} · {app.createdAt}</small></span><b>{app.status}</b></Link>)}</div>}</section></Shell>
}

function NewRti({ user }: { user: User }) {
  const [draft, setDraft] = useState<RtiDraft>({ subject: '', requestText: '' }); const [authorities, setAuthorities] = useState<Authority[] | null>(null); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false); const navigate = useNavigate()
  useEffect(() => { setAuthorities(null); rtiService.listAuthorities(draft.jurisdiction).then(setAuthorities).catch(() => setError('Authorities could not be loaded.')) }, [draft.jurisdiction])
  const update = (key: keyof RtiDraft, value: string) => setDraft(prev => ({ ...prev, [key]: value, ...(key === 'jurisdiction' ? { authorityId: undefined } : {}) }))
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setSubmitting(true); setError(''); try { const app = await rtiService.submit(draft, user.name); navigate(`/applications/${app.id}`, { replace: true }) } catch (err) { setError(err instanceof Error ? err.message : 'Submission failed.') } finally { setSubmitting(false) } }
  return <Shell user={user}><div className="flow-head"><p className="eyebrow">New RTI · 1 of 1</p><h1>Tell us about your request</h1><p>Choose the jurisdiction and public authority, then write a focused information request.</p></div><form className="card form" onSubmit={submit}><fieldset><legend>1. Jurisdiction</legend><div className="choices">{(['Central', 'State/UT'] as const).map(value => <label className={draft.jurisdiction === value ? 'choice selected' : 'choice'} key={value}><input type="radio" name="jurisdiction" checked={draft.jurisdiction === value} onChange={() => update('jurisdiction', value)} />{value}</label>)}</div></fieldset><fieldset><legend>2. Public authority</legend>{!draft.jurisdiction ? <p className="hint">Select a jurisdiction first.</p> : !authorities ? <Loading /> : authorities.length === 0 ? <p className="hint">No sample authorities are available for this jurisdiction.</p> : <select value={draft.authorityId ?? ''} onChange={e => update('authorityId', e.target.value)}><option value="">Choose an authority</option>{authorities.map(a => <option value={a.id} key={a.id}>{a.name} — {a.location}</option>)}</select>}</fieldset><fieldset><legend>3. Information requested</legend><label>Subject<input maxLength={120} placeholder="E.g., status of a road improvement project" value={draft.subject} onChange={e => update('subject', e.target.value)} /></label><label>Request<textarea rows={6} placeholder="Please provide the following information…" value={draft.requestText} onChange={e => update('requestText', e.target.value)} /></label></fieldset>{error && <ErrorState message={error} />}<section className="review"><h2>Review</h2><p><b>Authority:</b> {draft.authorityId && authorities ? authorityName(draft.authorityId, authorities) : 'Not selected'}</p><p><b>Subject:</b> {draft.subject || 'Not entered'}</p></section><button className="primary" disabled={submitting}>{submitting ? 'Submitting mock request…' : 'Submit mock RTI'}</button></form></Shell>
}

function ApplicationDetail({ user }: { user: User }) {
  const id = decodeURIComponent(location.pathname.split('/').pop() ?? ''); const [app, setApp] = useState<RtiApplication | null | undefined>(undefined); const [authorities, setAuthorities] = useState<Authority[]>([])
  useEffect(() => { rtiService.getApplication(id).then(setApp); rtiService.listAuthorities().then(setAuthorities) }, [id])
  if (app === undefined) return <Shell user={user}><Loading /></Shell>
  if (app === null) return <Shell user={user}><div className="empty"><h1>Application not found</h1><Link to="/dashboard">Back to dashboard</Link></div></Shell>
  return <Shell user={user}><p className="eyebrow">Application tracking</p><h1>{app.subject}</h1><section className="card details"><div><small>Registration number</small><strong>{app.id}</strong></div><div><small>Status</small><strong>{app.status}</strong></div><div><small>Authority</small><strong>{authorityName(app.authorityId, authorities)}</strong></div></section><section className="card"><h2>Your request</h2><p>{app.requestText}</p></section><section><h2>Tracking timeline</h2><ol className="timeline">{app.timeline.map(event => <li key={event.title}><b>{event.title}</b><small>{event.date}</small><p>{event.detail}</p></li>)}</ol></section></Shell>
}

export function App() {
  const [user, setUser] = useState<User | null>(() => authService.getSession())
  return <Routes><Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={setUser} />} /><Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />} /><Route path="/rti/new" element={user ? <NewRti user={user} /> : <Navigate to="/login" replace />} /><Route path="/applications/:id" element={user ? <ApplicationDetail user={user} /> : <Navigate to="/login" replace />} /><Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} /></Routes>
}

import { useState, type FormEvent } from 'react'
import type { User } from '../domain/rti'
import { authService } from '../services/authService'
import { ErrorState } from './kit'

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('demo@rtione.in')
  const [password, setPassword] = useState('demo123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      onLogin(await authService.login(email, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <section className="auth-panel">
        <div className="auth-pitch">
          <p className="eyebrow on-dark">RTI One · demo prototype</p>
          <h1>Start with your question, not a government form.</h1>
          <p className="lead">
            Describe what you need to know in plain language. RTI One helps you shape a clear Right
            to Information request and suggests where to send it.
          </p>
          <ul className="pitch-steps">
            <li>
              <span aria-hidden="true">1</span> Ask in your own words
            </li>
            <li>
              <span aria-hidden="true">2</span> Confirm what we understood
            </li>
            <li>
              <span aria-hidden="true">3</span> File and track your request
            </li>
          </ul>
        </div>
        <div className="card login-card">
          <h2>Try the demo</h2>
          <p className="muted">Credentials are prefilled. Synthetic data only.</p>
          <form onSubmit={submit}>
            <label>
              Email
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && <ErrorState message={error} />}
            <button className="primary block" disabled={busy}>
              {busy ? 'Signing in…' : 'Enter the demo'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

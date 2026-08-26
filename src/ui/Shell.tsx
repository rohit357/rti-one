import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import type { User } from '../domain/rti'
import { authService } from '../services/authService'

const NAV = [
  { to: '/dashboard', label: 'Home', end: true },
  { to: '/cases', label: 'My cases', end: false },
  { to: '/help', label: 'Guide', end: false },
]

/**
 * Global application shell: skip link, persistent header navigation,
 * primary "ask" action, and a disclaimer footer. Wraps every signed-in page
 * so navigation and landmarks stay consistent.
 */
export function Shell({
  user,
  onLogout,
  children,
}: {
  user: User
  onLogout: () => void
  children: ReactNode
}) {
  const navigate = useNavigate()
  const signOut = () => {
    authService.logout()
    onLogout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/dashboard">
            <span className="brand-mark" aria-hidden="true">
              RTI
            </span>
            <span className="brand-word">One</span>
          </Link>
          <nav className="main-nav" aria-label="Primary">
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <Link className="primary compact ask-cta" to="/rti/new">
              Ask for information
            </Link>
            <div className="user-chip" title={user.email}>
              <span className="avatar" aria-hidden="true">
                {user.name.charAt(0)}
              </span>
              <span className="user-name">{user.name}</span>
            </div>
            <button className="link-button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="site-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer" role="contentinfo">
        <div className="footer-inner">
          <div>
            <p className="footer-brand">RTI One</p>
            <p className="footer-note">
              A citizen-first prototype for Build What Moves India. All authorities, submissions and
              tracking shown here are <strong>synthetic</strong> — no real government system is
              contacted.
            </p>
          </div>
          <nav className="footer-nav" aria-label="Footer">
            <Link to="/dashboard">Home</Link>
            <Link to="/cases">My cases</Link>
            <Link to="/rti/new">Ask for information</Link>
            <Link to="/help">RTI guide</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

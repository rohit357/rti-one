import { useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { User } from '../domain/rti'
import { authService } from '../services/authService'
import { ApplicationDetail } from './ApplicationDetail'
import { Cases } from './Cases'
import { Help } from './Help'
import { Home } from './Home'
import { Login } from './Login'
import { NewRti } from './NewRti'
import { Shell } from './Shell'

export function App() {
  const [user, setUser] = useState<User | null>(() => authService.getSession())

  const guard = (node: ReactNode): ReactNode =>
    user ? (
      <Shell user={user} onLogout={() => setUser(null)}>
        {node}
      </Shell>
    ) : (
      <Navigate to="/login" replace />
    )

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={setUser} />}
      />
      <Route path="/dashboard" element={guard(<Home user={user!} />)} />
      <Route path="/cases" element={guard(<Cases />)} />
      <Route path="/rti/new" element={guard(<NewRti user={user!} />)} />
      {/* Splat, not :id — registration numbers contain slashes (RTI/ONE/2026/00001). */}
      <Route path="/applications/*" element={guard(<ApplicationDetail />)} />
      <Route path="/help" element={guard(<Help />)} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

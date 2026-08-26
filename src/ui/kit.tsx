import type { ApplicationStatus } from '../domain/rti'

/**
 * Shared presentation primitives and status helpers.
 * UI-only: no service calls, no domain mutation. Keeps every page's
 * empty / loading / error states consistent.
 */

export function Loading({ label = 'Loading…', rows = 0 }: { label?: string; rows?: number }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
      {rows > 0 && (
        <div className="skeletons" aria-hidden="true">
          {Array.from({ length: rows }).map((_, i) => (
            <span className="skeleton" key={i} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
      {action}
    </div>
  )
}

/** Status → colour token. Union-exhaustive; falls back gracefully. */
const statusClass: Record<ApplicationStatus, string> = {
  Draft: 'is-draft',
  Submitted: 'is-submitted',
  'Under review': 'is-review',
  'Response due': 'is-due',
}

export function StatusPill({ status, large = false }: { status: ApplicationStatus; large?: boolean }) {
  return (
    <span className={`status-pill ${statusClass[status] ?? ''} ${large ? 'large' : ''}`.trim()}>
      <span className="dot" aria-hidden="true" />
      {status}
    </span>
  )
}

/** Plain-language line describing what a status means for the citizen. */
export function statusHint(status: ApplicationStatus): string {
  switch (status) {
    case 'Draft':
      return 'Not submitted yet — finish and send when you are ready.'
    case 'Submitted':
      return 'Registered. The public authority will assign it to its information officer.'
    case 'Under review':
      return 'The authority is processing your request.'
    case 'Response due':
      return 'A response is expected within the statutory window.'
  }
}

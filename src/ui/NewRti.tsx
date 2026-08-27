import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  Authority,
  GuidedRequestSession,
  RequestInterpretation,
  User,
} from '../domain/rti'
import type { IntelligenceMode } from '../intelligence/api'
import { guidedRequestService } from '../services/guidedRequestService'
import { intelligenceService } from '../services/intelligenceService'
import { rtiService } from '../services/rtiService'
import { ErrorState } from './kit'

const examples = [
  'I need records from the Ministry of Road Transport and Highways about a delayed repair.',
  'I want records from the Ministry of Railways about accessibility work at my station.',
  'I need records from Delhi PWD about a streetlight repair request.',
]

type FlowStep = 'need' | 'understood' | 'draft'

function Progress({ step }: { step: FlowStep }) {
  const current = step === 'need' ? 1 : step === 'understood' ? 2 : 3
  const labels = ['Your question', 'What we understood', 'Your draft']
  return (
    <ol className="progress" aria-label={`Step ${current} of 3`}>
      {labels.map((label, i) => {
        const n = i + 1
        const state = current > n ? 'done' : current === n ? 'active' : ''
        return (
          <li className={state} key={label} aria-current={current === n ? 'step' : undefined}>
            <span className="progress-n" aria-hidden="true">
              {current > n ? '✓' : n}
            </span>
            <small>{label}</small>
          </li>
        )
      })}
    </ol>
  )
}

function SourceBadge({ source }: { source?: 'ai' | 'deterministic' }) {
  const ai = source === 'ai'
  return (
    <span className={`intel-badge ${ai ? 'is-ai' : 'is-offline'}`}>
      {ai ? 'AI-assisted' : 'Offline interpretation'}
    </span>
  )
}

export function NewRti({ user }: { user: User }) {
  const navigate = useNavigate()
  const [session, setSession] = useState<GuidedRequestSession>(() => guidedRequestService.load())
  const [step, setStep] = useState<FlowStep>(() => {
    const saved = guidedRequestService.load()
    return saved.draft ? 'draft' : saved.interpretation ? 'understood' : 'need'
  })
  const [authorities, setAuthorities] = useState<Authority[]>([])
  const [busy, setBusy] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [draftMode, setDraftMode] = useState<IntelligenceMode | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    rtiService
      .listAuthorities()
      .then(setAuthorities)
      .catch(() => setError('Sample authorities could not be loaded.'))
  }, [])

  const save = (next: GuidedRequestSession) => {
    setSession(next)
    guidedRequestService.save(next)
  }

  const interpret = async () => {
    setBusy(true)
    setError('')
    try {
      const { result } = await intelligenceService.interpret(session.need)
      if (result.kind === 'clarification') {
        save({ need: session.need, clarification: result })
        return
      }
      save({ need: session.need, interpretation: result.interpretation })
      setStep('understood')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not interpret that request.')
    } finally {
      setBusy(false)
    }
  }

  const editInterpretation = (key: keyof RequestInterpretation, value: string) => {
    if (!session.interpretation) return
    const interpretation = { ...session.interpretation, [key]: value } as RequestInterpretation
    if (key === 'governmentLevel') interpretation.authorityId = ''
    save({ ...session, interpretation })
  }

  const generateDraft = async () => {
    if (!session.interpretation?.authorityId) {
      setError('Choose a public authority before continuing.')
      return
    }
    setDrafting(true)
    setError('')
    try {
      const { draft, mode } = await intelligenceService.createDraft(session, session.interpretation)
      setDraftMode(mode)
      save({ ...session, draft })
      setStep('draft')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not prepare your draft.')
    } finally {
      setDrafting(false)
    }
  }

  const submit = async () => {
    if (!session.draft) return
    setSubmitting(true)
    setError('')
    try {
      const app = await rtiService.submit(session.draft, user.name)
      guidedRequestService.clear()
      navigate(`/applications/${app.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const interpretation = session.interpretation

  return (
    <div className="page guided">
      <section className="guided-heading">
        <p className="eyebrow">Guided information request</p>
        <h1>
          {step === 'need'
            ? 'What do you need information about?'
            : step === 'understood'
              ? 'Here’s what we understood.'
              : 'Your request is ready to review.'}
        </h1>
        <p className="lead">
          {step === 'need'
            ? 'Use everyday language. You do not need to know which department handles it.'
            : step === 'understood'
              ? 'You stay in control — confirm the suggestion or change any part of it.'
              : 'We made this a structured information request. Edit any detail before submitting.'}
        </p>
      </section>

      <Progress step={step} />

      {step === 'need' && (
        <section className="guide-card">
          <label className="question-label" htmlFor="need">
            Tell us what happened or what record you need.
          </label>
          <textarea
            id="need"
            rows={6}
            value={session.need}
            placeholder="For example: I want to know why the road repair near my home has been delayed."
            onChange={event => save({ need: event.target.value })}
          />
          <div className="prompt-row">
            <small>Try an example:</small>
            {examples.map(example => (
              <button className="prompt-chip" key={example} onClick={() => save({ need: example })}>
                {example}
              </button>
            ))}
          </div>
          {session.clarification && (
            <aside className="clarification" role="status">
              <strong>One detail before we suggest a destination</strong>
              <p>{session.clarification.question}</p>
              <small>{session.clarification.detail}</small>
              {session.clarification.missingInformation && session.clarification.missingInformation.length > 0 && (
                <ul className="missing-list">
                  {session.clarification.missingInformation.map((item, i) => (
                    <li key={`${item}-${i}`}>{item}</li>
                  ))}
                </ul>
              )}
            </aside>
          )}
          {error && <ErrorState message={error} />}
          <button className="primary" onClick={interpret} disabled={busy}>
            {busy ? 'Understanding your question…' : 'See what RTI One understood'}
          </button>
          <p className="quiet-note">
            Prototype suggestion only — no real government systems are contacted.
          </p>
        </section>
      )}

      {step === 'understood' && interpretation && (
        <section className="guide-card">
          <div className="understood">
            <div>
              <p className="eyebrow">Your information need</p>
              <p className="need-quote">“{session.need}”</p>
            </div>
            <p className="quiet-note">{interpretation.confidenceNote}</p>
          </div>

          {(interpretation.source || interpretation.explanation || interpretation.evidence) && (
            <div className="intel-panel">
              <div className="intel-panel-head">
                <SourceBadge source={interpretation.source} />
                {interpretation.confidence && (
                  <span className={`intel-confidence is-${interpretation.confidence}`}>
                    Confidence: {interpretation.confidence}
                  </span>
                )}
              </div>
              {interpretation.explanation && <p className="intel-explanation">{interpretation.explanation}</p>}
              {interpretation.evidence && interpretation.evidence.length > 0 && (
                <ul className="evidence-list">
                  {interpretation.evidence.map((item, i) => (
                    <li key={`${item.label}-${i}`} className={`evidence is-${item.status}`}>
                      <span className="evidence-status">{item.status}</span>
                      <span className="evidence-text">
                        <b>{item.label}:</b> {item.value}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="quiet-note">High model confidence is not proof — review and edit any field.</p>
            </div>
          )}

          <div className="interpret-grid">
            <label>
              Location
              <input
                value={interpretation.location}
                onChange={event => editInterpretation('location', event.target.value)}
              />
            </label>
            <label>
              Government level
              <select
                value={interpretation.governmentLevel}
                onChange={event => editInterpretation('governmentLevel', event.target.value)}
              >
                <option value="Central">Central</option>
                <option value="State/UT">State/UT</option>
              </select>
            </label>
            <label>
              Topic or department
              <input
                value={interpretation.topic}
                onChange={event => editInterpretation('topic', event.target.value)}
              />
            </label>
            <label>
              Likely public authority
              <select
                value={interpretation.authorityId}
                onChange={event => editInterpretation('authorityId', event.target.value)}
              >
                <option value="">Choose an authority</option>
                {authorities
                  .filter(authority => authority.jurisdiction === interpretation.governmentLevel)
                  .map(authority => (
                    <option key={authority.id} value={authority.id}>
                      {authority.name} — {authority.location}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {error && <ErrorState message={error} />}
          <div className="flow-actions">
            <button className="secondary" onClick={() => setStep('need')}>
              Edit my question
            </button>
            <button className="primary" onClick={generateDraft} disabled={drafting}>
              {drafting ? 'Preparing your draft…' : 'Create my RTI draft'}
            </button>
          </div>
        </section>
      )}

      {step === 'draft' && session.draft && (
        <section className="guide-card">
          <div className="draft-intro">
            <div>
              <p className="eyebrow">Structured request</p>
              <h2>Ready to submit when you are.</h2>
            </div>
            <span className="status-pill is-draft">
              <span className="dot" aria-hidden="true" />
              Draft
            </span>
          </div>

          <div className="draft-source-note">
            <span className={`intel-badge ${draftMode === 'ai' ? 'is-ai' : 'is-offline'}`}>
              {draftMode === 'ai'
                ? 'AI-drafted — every word is yours to edit'
                : draftMode === 'fallback'
                  ? 'Template draft — every word is yours to edit'
                  : 'Draft — every word is yours to edit'}
            </span>
            <p className="your-words">
              <small>Your original words</small>“{session.need}”
            </p>
          </div>

          <label>
            Public authority
            <select
              value={session.draft.authorityId}
              onChange={event =>
                save({ ...session, draft: { ...session.draft!, authorityId: event.target.value } })
              }
            >
              {authorities
                .filter(authority => authority.jurisdiction === session.draft!.jurisdiction)
                .map(authority => (
                  <option key={authority.id} value={authority.id}>
                    {authority.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Subject
            <input
              value={session.draft.subject}
              onChange={event =>
                save({ ...session, draft: { ...session.draft!, subject: event.target.value } })
              }
            />
          </label>
          <label>
            Your request
            <textarea
              rows={9}
              value={session.draft.requestText}
              onChange={event =>
                save({ ...session, draft: { ...session.draft!, requestText: event.target.value } })
              }
            />
          </label>
          {error && <ErrorState message={error} />}
          <div className="flow-actions">
            <button className="secondary" onClick={() => setStep('understood')}>
              Back to interpretation
            </button>
            <button className="primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting mock request…' : 'Submit mock RTI'}
            </button>
          </div>
          <p className="quiet-note">
            Submitting creates a synthetic registration number in this demo.
          </p>
        </section>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  Authority,
  GuidedQuestion,
  GuidedRequestSession,
  KnownFacts,
  RequestInterpretation,
  User,
} from '../domain/rti'
import type { IntelligenceMode } from '../intelligence/api'
import { isServiceType, SERVICE_LABELS } from '../knowledge/types'
import { applyAnswer } from '../knowledge/routing'
import { guidedRequestService } from '../services/guidedRequestService'
import { intelligenceService } from '../services/intelligenceService'
import { rtiService } from '../services/rtiService'
import { ErrorState } from './kit'

const examples = [
  'I need records from the Ministry of Road Transport and Highways about a delayed repair.',
  'The streetlight on my lane in Delhi has been broken for weeks.',
  'The road repair near my home has been delayed.',
]

type FlowStep = 'need' | 'understood' | 'draft'

function newSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    // fall through
  }
  return `guided-${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

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

// A plain-language summary of the evolving understanding — no government jargon,
// only what the citizen actually told us.
function factChips(facts?: KnownFacts): Array<{ label: string; value: string }> {
  if (!facts) return []
  const chips: Array<{ label: string; value: string }> = []
  if (facts.serviceType && isServiceType(facts.serviceType)) chips.push({ label: 'Issue', value: SERVICE_LABELS[facts.serviceType] })
  const where = facts.state || facts.location
  if (where) chips.push({ label: 'Where', value: where })
  if (facts.governmentLevel) chips.push({ label: 'Level', value: facts.governmentLevel })
  if (facts.mentionedAuthority) chips.push({ label: 'You mentioned', value: facts.mentionedAuthority })
  return chips
}

function KnowSoFar({ facts, mode }: { facts?: KnownFacts; mode: IntelligenceMode | null }) {
  const chips = factChips(facts)
  if (chips.length === 0) return null
  return (
    <div className="know-so-far" role="status">
      <div className="know-head">
        <span className="know-title">What we know so far</span>
        {mode && (
          <span className={`intel-badge ${mode === 'ai' ? 'is-ai' : 'is-offline'}`}>
            {mode === 'ai' ? 'AI-assisted' : 'Offline'}
          </span>
        )}
      </div>
      <ul className="know-chips">
        {chips.map(chip => (
          <li key={chip.label} className="know-chip">
            <small>{chip.label}</small>
            <b>{chip.value}</b>
          </li>
        ))}
      </ul>
    </div>
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
  const [guideMode, setGuideMode] = useState<IntelligenceMode | null>(null)
  const [answerText, setAnswerText] = useState('')
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

  // Typing a new question invalidates any evolving guidance so stale facts or a
  // stale question never linger against changed text.
  const editNeed = (value: string) => {
    save({
      need: value,
      sessionId: session.sessionId,
      facts: undefined,
      askedFields: undefined,
      question: undefined,
      candidateAuthorityIds: undefined,
      interpretation: undefined,
      clarification: undefined,
    })
    setGuideMode(null)
  }

  // One turn of adaptive guidance. `facts`/`askedFields` carry the evolving
  // session state; a select-answer turn passes them so the server needs no model
  // call. The result is either a route, one question, or a clarification.
  const runGuide = async (need: string, askedFields: string[], facts: KnownFacts | undefined, sessionId: string) => {
    setBusy(true)
    setError('')
    try {
      const { result, facts: nextFacts, mode } = await intelligenceService.guide(need, askedFields, facts, sessionId)
      setGuideMode(mode)
      if (result.kind === 'route') {
        save({ need, sessionId, facts: nextFacts, askedFields, interpretation: result.interpretation, question: undefined, clarification: undefined })
        setStep('understood')
      } else if (result.kind === 'question') {
        save({ need, sessionId, facts: nextFacts, askedFields, question: result, candidateAuthorityIds: result.candidateAuthorityIds, interpretation: undefined, clarification: undefined })
        setAnswerText('')
      } else {
        save({ need, sessionId, facts: nextFacts, askedFields, clarification: result, question: undefined, interpretation: undefined })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not understand that request.')
    } finally {
      setBusy(false)
    }
  }

  const startGuide = () => {
    const sessionId = session.sessionId ?? newSessionId()
    runGuide(session.need, [], undefined, sessionId)
  }

  // Apply a selected/typed answer deterministically, then re-route. No model
  // call: applyAnswer is pure and the server reuses the unchanged need.
  const answer = (field: string, value: string) => {
    const facts = applyAnswer(session.facts ?? { rawNeed: session.need }, field, value)
    const askedFields = [...(session.askedFields ?? []), field]
    const sessionId = session.sessionId ?? newSessionId()
    runGuide(session.need, askedFields, facts, sessionId)
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
  const question = session.question

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
            onChange={event => editNeed(event.target.value)}
          />
          <div className="prompt-row">
            <small>Try an example:</small>
            {examples.map(example => (
              <button className="prompt-chip" key={example} onClick={() => editNeed(example)}>
                {example}
              </button>
            ))}
          </div>

          <KnowSoFar facts={session.facts} mode={guideMode} />

          {question && (
            <div className="guide-question" role="group" aria-label="One quick question">
              <div className="gq-head">
                <strong>{question.question}</strong>
                <p className="gq-why">{question.why}</p>
              </div>
              {question.inputMode === 'select' && question.options ? (
                <div className="gq-options">
                  {question.options.map(option => (
                    <button
                      key={option.value}
                      className={`gq-option${option.value === '__unsure__' ? ' is-unsure' : ''}`}
                      disabled={busy}
                      onClick={() => answer(question.field, option.value)}
                    >
                      <span className="gq-option-label">{option.label}</span>
                      {option.hint && <small>{option.hint}</small>}
                    </button>
                  ))}
                </div>
              ) : (
                <form
                  className="gq-text"
                  onSubmit={event => {
                    event.preventDefault()
                    if (answerText.trim()) answer(question.field, answerText.trim())
                  }}
                >
                  <input
                    value={answerText}
                    placeholder="Type your answer"
                    onChange={event => setAnswerText(event.target.value)}
                  />
                  <button className="primary" disabled={busy || !answerText.trim()}>
                    Continue
                  </button>
                </form>
              )}
              <button className="link-button" onClick={() => save({ ...session, question: undefined })}>
                Let me rephrase instead
              </button>
            </div>
          )}

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
          {!question && (
            <button className="primary" onClick={startGuide} disabled={busy || session.need.trim().length === 0}>
              {busy ? 'Understanding your question…' : 'See what RTI One understood'}
            </button>
          )}
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

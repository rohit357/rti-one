import { Link } from 'react-router-dom'

const FAQ = [
  {
    q: 'Who can file an RTI request?',
    a: 'Any citizen of India can request information from a public authority under the Right to Information Act, 2005.',
  },
  {
    q: 'How long does a response take?',
    a: 'Public authorities are generally expected to respond within 30 days. Matters involving life or liberty have a much shorter window. This prototype shows synthetic timelines only.',
  },
  {
    q: 'Do I need to give a reason?',
    a: 'No. You are not required to justify why you want the information, beyond contact details needed to receive a reply.',
  },
  {
    q: 'Does RTI One submit to a real government portal?',
    a: 'No. RTI One is a design prototype. Authorities, registration numbers, submission and tracking here are synthetic and never leave your browser.',
  },
]

export function Help() {
  return (
    <div className="page help">
      <section className="page-head">
        <div>
          <p className="eyebrow">RTI guide</p>
          <h1>Understand RTI before you ask</h1>
          <p className="lead">
            A short, plain-language guide to the Right to Information — so you can start with
            confidence, even if it’s your first request.
          </p>
        </div>
        <Link className="primary" to="/rti/new">
          Ask for information
        </Link>
      </section>

      <div className="help-grid">
        <article className="card help-card">
          <h2>What is RTI?</h2>
          <p>
            The Right to Information Act, 2005 lets any citizen ask a public authority for
            information it holds — records, decisions, files, and status of works. It’s a tool for
            everyday accountability, not just legal experts.
          </p>
        </article>

        <article className="card help-card">
          <h2>What RTI One does</h2>
          <ul className="check-list">
            <li>Turns a plain-language question into a structured request.</li>
            <li>Suggests a likely public authority only from evidence you provide.</li>
            <li>Keeps you in control — you confirm or edit every detail.</li>
            <li>Lets you track a request through a mock timeline.</li>
          </ul>
        </article>

        <article className="card help-card">
          <h2>What RTI One does not do</h2>
          <ul className="cross-list">
            <li>It does not contact any real government system.</li>
            <li>It does not guess a location, department or authority you didn’t state.</li>
            <li>It is not legal advice, and holds no real authority directory.</li>
          </ul>
        </article>
      </div>

      <section className="write-well" aria-labelledby="write-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Tips</p>
            <h2 id="write-title">Writing a clear request</h2>
          </div>
        </div>
        <ol className="steps tips">
          <li className="step">
            <h3>Be specific</h3>
            <p>Name the record, decision or work, and a date range if you can.</p>
          </li>
          <li className="step">
            <h3>One matter at a time</h3>
            <p>Keep each request focused so the authority can answer point-wise.</p>
          </li>
          <li className="step">
            <h3>Say what you know</h3>
            <p>A city, a notice number, or a department name helps route it accurately.</p>
          </li>
        </ol>
      </section>

      <section className="faq" aria-labelledby="faq-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Common questions</p>
            <h2 id="faq-title">FAQ</h2>
          </div>
        </div>
        <div className="faq-list">
          {FAQ.map(item => (
            <details className="faq-item" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
        <p className="quiet-note">
          Educational summary for this prototype — not legal advice. Verify current rules with the
          relevant public authority.
        </p>
      </section>
    </div>
  )
}

# RTI One — Agent Notes

## Project

- Build What Moves India hackathon prototype that redesigns the citizen-facing RTI journey.
- Browser-based, citizen-only experience; no admin panel.
- All auth, authority data, submissions, and tracking are synthetic/mock. Do not connect to government systems or use real citizen data.
- The prototype presents Central and State/UT authorities in one UX. Do not claim that the real Central RTI portal supports State authorities.

## Current state

- Foundation milestone: complete (`452ee2f`).
- Citizen UX redesign: complete (`91d71bb feat: redesign RTI citizen journey`).
- Current Git state at handoff: `main...origin/main`; application worktree was clean before this intentionally uncommitted notes file was added.
- Demo account: `demo@rtione.in` / `demo123`.

## Architecture

- `src/main.tsx`: React/Vite bootstrap and router host.
- `src/ui/App.tsx`, `src/ui/styles.css`: citizen UI, routes, guided flow, dashboard, and case tracking presentation.
- `src/domain/rti.ts`: shared RTI, authority, application, interpretation, clarification, and guided-session contracts.
- `src/data/authorities.ts`: deliberately small Central + State/UT sample data set.
- `src/services/`: UI-independent mock boundaries:
  - `authService.ts`: demo session.
  - `rtiService.ts`: authorities, applications, deterministic registration numbers, mock submit/tracking.
  - `interpretationService.ts`: deterministic, evidence-only request interpretation and draft generation.
  - `guidedRequestService.ts`: saved guided-flow session.
  - `storage.ts`: JSON localStorage adapter.
- Persistence is browser localStorage: session, applications, and guided request state are versioned keys. Keep the service/domain boundary intact so mock implementations can later be swapped without rewriting UI.

## Product and UX decisions

- Start from a plain-language need: question → “I understood” → editable confirmation → structured RTI draft → existing mock submit/tracking.
- A first-time citizen should not need RTI terminology to begin.
- Suggestions are transparent and editable; the citizen always confirms or changes location, level, topic, and authority.
- Interpretation is evidence-backed: it suggests only one of the small sample authorities when that authority is explicitly named in the input.
- Unclear input asks a clarification question instead of guessing.
- Dashboard and application detail are citizen case-workspace views, not admin/database screens.

## Important invariants

- Never invent a location, jurisdiction, department, or authority.
- Unclear input must produce clarification, not routing.
- Synthetic data only; no real government integration, scraping, payment, or citizen data.
- No admin dashboard.
- Preserve service/domain boundaries.
- AI/LLM integration has **not** been implemented.

## Verification evidence

- Current handoff rerun: `npm.cmd run test` passed — 4 files, 5 tests.
- Current handoff rerun: `npm.cmd run build` passed.
- `git diff --check` passed during this handoff.
- Automated adversarial routing coverage: a vague road-repair request is asserted to return clarification, not an authority; an explicitly named supported authority is asserted to return a suggestion.
- Automated persistence/tracking coverage: a submitted mock draft is asserted available through dashboard-list and application-tracking service reads.
- Manual end-to-end citizen-flow and responsive-layout testing were **not** verified by browser automation: the local browser-control runtime was unavailable because of a Windows ACL helper failure. Do not treat them as verified until rerun interactively.

## Known limitations / risks

- Interpretation is deterministic regex matching over a very small, explicit authority list; it will clarify for most normal-language requests until a later capability is deliberately added.
- It is not an AI system and has no real authority directory or government knowledge.
- Mock timestamps are fixed; storage is browser-local and not multi-device or production-safe.
- Browser automation remains unavailable in the recorded environment; manually recheck the citizen flow, refresh persistence, mobile layout, and console when a browser surface is available.

## Next phase

**NEXT AGENT = Claude Code**  
**NEXT PHASE = Product Shell / Information Architecture**

Expected areas: richer home/start experience, My Cases, case detail/tracking workspace, RTI information/help surfaces, navigation, and visual/product hierarchy. Do **not** start LLM integration in this phase.

## Handoff rule

1. Read `AGENT_NOTES.md` first.
2. Inspect the actual repository and verify these notes against code.
3. Report discrepancies before implementation.
4. Follow PRE-MORTEM → DETECT → DIAGNOSE → FIX → VERIFY.
5. Do not assume requirements that are not documented or evidenced in the repository.

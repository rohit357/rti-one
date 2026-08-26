# RTI One — Agent Notes

## Project

- Build What Moves India hackathon prototype that redesigns the citizen-facing RTI journey.
- Browser-based, citizen-only experience; no admin panel.
- All auth, authority data, submissions, and tracking are synthetic/mock. Do not connect to government systems or use real citizen data.
- The prototype presents Central and State/UT authorities in one UX. Do not claim that the real Central RTI portal supports State authorities.

## Current state

- Foundation milestone: complete (`452ee2f`).
- Citizen UX redesign: complete (`91d71bb feat: redesign RTI citizen journey`).
- **Product Shell / Information Architecture: complete (this phase, uncommitted).**
- Git state at this handoff: `main...origin/main`, previous commits clean. This phase's changes are **uncommitted** per instruction. Uncommitted files: modified `index.html`, `src/ui/App.tsx`, `src/ui/styles.css`; new `src/ui/{kit,Shell,Login,Home,Cases,NewRti,ApplicationDetail,Help}.tsx`; new untracked `.claude/launch.json` (Vite preview config, port 5173).
- Demo account: `demo@rtione.in` / `demo123` (demo user name: Aarav Sharma).

## Information architecture (routes)

- `/login` — split pitch + demo login.
- `/dashboard` — **Home / start experience**: "What do you need to know?" hero, quick-ask box (routes into the guided flow with the need prefilled), how-it-works (understand → guide → file → track), and an at-a-glance "Recent cases" strip.
- `/cases` — **My Cases workspace**: status summary tiles, status filter chips, full case list, empty/loading/error states.
- `/rti/new` — **guided filing flow** (need → understood → draft). Flow logic preserved byte-for-byte from the previous build.
- `/applications/*` — **case detail + tracking timeline**. Splat route (see decision below).
- `/help` — **RTI guide**: what RTI is, what RTI One does / does not do, tips, FAQ (native `<details>`). Reinforces synthetic-data boundary.

## Architecture

- `src/main.tsx`: React/Vite bootstrap and router host (unchanged).
- `src/ui/App.tsx`: routes + auth guard + shell wiring only. Guard wraps signed-in pages in `Shell`; unauth → `/login`.
- `src/ui/Shell.tsx`: global shell — skip link, sticky header nav (`NavLink` active states), primary "Ask for information" CTA, user chip, sign-out, disclaimer footer.
- `src/ui/kit.tsx`: shared presentation primitives (`Loading` with spinner/skeletons, `ErrorState` with retry, `EmptyState`, `StatusPill`) and status helpers (`statusHint`). UI-only, no service calls.
- `src/ui/{Login,Home,Cases,NewRti,ApplicationDetail,Help}.tsx`: page components.
- `src/ui/styles.css`: tokenized design system (CSS custom properties for colour/spacing/radius/elevation), base, shell, components, per-page sections, responsive. Human-readable (previous build was minified into 2 lines).
- `src/domain/rti.ts`, `src/data/authorities.ts`, `src/services/*`: **unchanged**. Service/domain boundary intact; mock implementations still swappable without touching UI.
- Persistence remains browser localStorage (versioned keys: session, applications, guided request).

## Product and UX decisions (this phase)

- Front door leads with the primary action ("ask for information") and a plain-language quick-ask, not a form. Citizen never needs RTI terminology to begin. Quick-ask saves the need via `guidedRequestService` then routes to `/rti/new`, which rehydrates it.
- Split Home (start + at-a-glance) from My Cases (full workspace) so each surface has one job; avoids dashboard-card overload.
- Case detail is status-aware: `statusHint` gives a plain-language status line; the timeline marks the first (submitted) event done and the rest upcoming. No domain change — derived in the view. Synthetic-date caveat shown.
- Restrained civic visual system: existing green identity retained; no gradients-as-decoration (one subtle radial only on the logged-out auth screen), no 3D, no heavy animation (spinner/shimmer respect `prefers-reduced-motion`).
- Help content is factual civic education, explicitly labelled not-legal-advice, and repeatedly states no real government system is contacted.

## Bugs found and fixed this phase (were latent in the previous build)

1. **Slashed-ID routing (blocking).** Registration numbers are `RTI/ONE/2026/00001`. The route was `/applications/:id` (single segment), so navigating to `/applications/RTI/ONE/2026/00001` never matched and fell through to `*` → redirect to `/dashboard`. The case-detail page was therefore unreachable through the UI. Not caught earlier because the service tests call `rtiService` directly (bypassing the router) and browser checks were unavailable at the prior handoff. **Fix:** splat route `/applications/*` + `useParams()['*']`. Preserves the ID string, the `registrationNumber` service test, and all existing links. Verified end-to-end in the browser.
2. **Logout did not clear React state.** `Shell` logout cleared storage and navigated to `/login`, but `App`'s `user` state stayed truthy, so `/login`'s guard bounced back to `/dashboard` — you weren't logged out until a full refresh. **Fix:** `App` passes `onLogout` that calls `setUser(null)`; `Shell` calls it before navigating. Verified (session cleared, stays on `/login`, `/dashboard` then redirects to `/login`).
3. **`index.html` missing `<meta viewport>`, `lang`, charset, title.** Responsive CSS existed but breakpoints wouldn't fire on real mobile. **Fix:** added viewport, `lang="en"`, charset, description, theme-color, title.
4. **Mobile nav links were `display:none`** in the old CSS, making navigation unreachable on phones. **Fix:** persistent wrapping/scrollable nav row; verified all links visible at 375px with no horizontal overflow.

## Important invariants (unchanged, still enforced)

- Never invent a location, jurisdiction, department, or authority.
- Unclear input must produce clarification, not routing. (Re-verified in browser: vague road-repair need → clarification, no interpretation.)
- Synthetic data only; no real government integration, scraping, payment, or citizen data.
- No admin dashboard.
- Preserve service/domain boundaries.
- AI/LLM integration has **not** been implemented (and was not part of this phase).

## Verification evidence (this phase)

- `npm.cmd run build` — passed (tsc -b strict + vite, 38 modules).
- `npm.cmd run test` — passed, 4 files / 5 tests (unchanged suite).
- `git diff --check` — clean (only benign LF→CRLF warnings on Windows).
- Runtime (Vite dev, Chromium via preview tools), no console errors across the journey:
  - Login → Home.
  - Quick-ask carries the need into `/rti/new`.
  - Named authority ("Ministry of Railways") → evidence-backed interpretation (Central, `central-railways`, location "Not specified").
  - Draft generated → submit → **case detail reachable** (reg `RTI/ONE/2026/00001`, 3-event timeline, first done, request record present).
  - `/cases` lists the persisted submission (total 1, Submitted).
  - Vague need → clarification only (invariant preserved).
  - Logout clears session and stays logged out; guard redirects `/dashboard` → `/login` when unauth.
  - `/help` renders (3 cards, 4 FAQ, 3 tips).
  - Responsive at 375px: all nav links reachable, no horizontal overflow; header wraps cleanly.

## Known limitations / risks

- **No router-level automated test.** The slashed-ID regression was UI-only and the suite doesn't exercise routing (would need `jsdom` + a testing-library, deliberately not added to control scope/deps). Recommend adding that harness next so route/flow regressions are caught in CI, not by hand.
- Interpretation is still deterministic regex over the small explicit authority list; most natural-language requests will clarify until a later capability is added. Not an AI system.
- Mock timestamps are fixed; all cases carry status `Submitted` (the status filter/summary is generic but currently only ever shows one bucket populated). localStorage is single-device, not production-safe.
- Contrast of the `--muted` token on white is ~AA for small text only; fine for a demo, tighten if a formal a11y pass is required.
- `.claude/launch.json` is untracked local tooling; not committed.

## Next phase

**NEXT PHASE = (recommend) LLM-assisted interpretation** — the deliberately-deferred AI work: replace/augment the regex interpreter so ordinary-language requests can be routed transparently (still evidence-only, still citizen-confirmed, no invented authorities). Before that, optionally a short hardening step: add a `jsdom` + testing-library harness and cover the guided flow and `/applications/*` routing.

Do **not** begin LLM integration without an explicit go-ahead for that phase.

## Handoff rule

1. Read `AGENT_NOTES.md` first.
2. Inspect the actual repository and verify these notes against code.
3. Report discrepancies before implementation.
4. Follow PRE-MORTEM → DETECT → DIAGNOSE → FIX → VERIFY.
5. Do not assume requirements that are not documented or evidenced in the repository.

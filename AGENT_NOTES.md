# RTI One — Agent Notes

## Project

- Build What Moves India hackathon prototype that redesigns the citizen-facing RTI journey.
- Browser-based, citizen-only experience; no admin panel.
- All auth, authority data, submissions, and tracking are synthetic/mock. Do not connect to government systems or use real citizen data.
- The prototype presents Central and State/UT authorities in one UX. Do not claim that the real Central RTI portal supports State authorities.

## Current state

- Foundation milestone: complete (`452ee2f`).
- Citizen UX redesign: complete (`91d71bb feat: redesign RTI citizen journey`).
- Product Shell / Information Architecture: complete (`9a2a9df feat: build RTI product shell`).
- **LLM-assisted interpretation (Phase 3): complete (this phase, uncommitted).**
- Git state at this handoff: `main...origin/main`, previous commits clean. This phase's changes are **uncommitted** per instruction. Modified: `src/domain/rti.ts` (additive optional fields), `src/services/interpretationService.ts` (thin delegate), `src/ui/NewRti.tsx`, `src/ui/styles.css`, `vite.config.ts`, `tsconfig.node.json`, `package.json`/`package-lock.json` (`@types/node` for server TS). New untracked: `server/` (Groq provider, engine, Vite API plugin + 1 test), `src/intelligence/` (contract, deterministic, grounding, prompt, api wire types + 1 test), `src/services/intelligenceService.ts`, `src/services/intelligenceFlow.test.ts`, `.env.example`.
- Demo account: `demo@rtione.in` / `demo123` (demo user name: Aarav Sharma).
- **Secret:** `GROQ_API_KEY` (server-only), kept in a gitignored `.env` (never committed, never in the client bundle — re-verified by grepping `dist/`). A live key **has now been exercised**: interpret + draft both run through the real `openai/gpt-oss-120b` model end-to-end (`mode:'ai'`), and the deterministic fallback remains for any no-key/error/malformed case.

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
- `src/domain/rti.ts`, `src/data/authorities.ts`: domain + synthetic authority dataset (6 authorities: 3 Central, 3 State/UT). `rti.ts` gained **additive optional** fields only (`source`, `explanation`, `confidence`, `evidence[]`, `alternativeAuthorityIds`, `missingInformation`) — nothing pre-existing changed shape.
- `src/services/*`: `rtiService`, `authService`, `guidedRequestService`, `storage` **unchanged**. `interpretationService` is now a thin delegate to the shared deterministic module (keeps its 2 legacy tests green).
- Persistence remains browser localStorage (versioned keys: session, applications, guided request).

## LLM-assisted interpretation (Phase 3)

Data flow (the browser NEVER calls Groq directly):

```
Browser → intelligenceService (client) → POST /api/interpret|/api/draft (same origin)
        → Vite middleware plugin (holds GROQ_API_KEY in the Node process)
        → intelligence engine → Groq provider (openai/gpt-oss-120b, OpenAI-compatible REST)
        → JSON → schema validation → authority/evidence grounding → interpretation
        → clarification OR confirmed suggestion → (citizen confirms) → draft → existing RTI workflow
```

- **Provider:** Groq, model `openai/gpt-oss-120b`, endpoint `https://api.groq.com/openai/v1/chat/completions`, `response_format: json_object`, `temperature: 0.2`, 12s server-side timeout via `AbortController`. No SDK dependency (Node global `fetch`). The key is read server-side only (`process.env.GROQ_API_KEY` or Vite `loadEnv`); it is never sent to the client, logged, or committed (`.env*` gitignored; `.env.example` documents it).
  - **Reasoning-model tuning (learned from the live model):** `gpt-oss-120b` is a *reasoning* model that spends completion tokens on internal reasoning. Left with the original small budget the JSON was truncated mid-object (`finish_reason: 'length'`) and every call failed validation → silent permanent fallback. Fix: send `reasoning_effort: 'low'` (configurable in `createGroqProvider`, default `'low'`) and raise `max_tokens` to 1600 (interpret) / 1200 (draft). Live result: complete on-contract JSON, `finish_reason: 'stop'`, ~0.5–1.5s/call. Note: Groq's `json_object` mode returns **HTTP 400 `json_validate_failed`** (not a 200 with bad text) when the model emits non-JSON or refuses — the provider classifies this as a failure and falls back safely.
- **Shared pure modules** in `src/intelligence/` are imported by BOTH the server and the client fallback, so all safety logic is one source of truth and unit-testable without a network or key:
  - `contract.ts` — `ModelInterpretation` type + `validateModelOutput()`: rejects non-objects, coerces unknown enums to safe defaults, filters candidate IDs to strings, strips control chars, caps lengths.
  - `grounding.ts` — **the authority dataset is the source of truth.** Filters model candidate IDs to real authorities; unknown IDs are dropped; if none survive → clarification. `governmentLevel` is taken from the chosen authority's jurisdiction (not the model). A location is kept ONLY if the model marked it `explicit` AND the string actually appears in the citizen text; otherwise "Not specified".
  - `deterministic.ts` — the offline interpreter/drafter (regex over the explicit authority list). Used as fallback whenever there is no key, a provider error, or malformed output. `<12` chars or no matched authority → clarification.
  - `prompt.ts` — system prompts that forbid inventing facts, restrict IDs to the supplied dataset, treat citizen text as untrusted DATA fenced in `<<<REQUEST … REQUEST>>>`, and bar legal advice.
  - `api.ts` — shared wire types so the client never imports from `server/`.
- **Server** (`server/`): `groqProvider.ts` (typed `ChatResult`, never logs the key), `intelligenceHandler.ts` (`createIntelligenceEngine({provider, authorities})` → `{interpret, draft}`; each returns `{result|draft, mode:'ai'|'fallback', reason?}`), `vitePlugin.ts` (mounts `/api/interpret` + `/api/draft`, POST-only, 100 KB body cap, on `configureServer` AND `configurePreviewServer`).
- **Client** (`src/services/intelligenceService.ts`): POSTs to the same-origin API, caches by trimmed need, and on ANY transport failure falls back to the local deterministic module (never throws a fake success).
- **UI** (`NewRti.tsx`): interpretation panel shows a source badge (AI-assisted / Offline interpretation), model confidence with an explicit "confidence is not proof" disclaimer, and an evidence list (explicit / inferred / missing). Every field stays editable; the draft step shows the citizen's original words verbatim, distinct from the editable draft. Flow steps, persistence, submit, and splat navigation are unchanged.

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

## Important invariants (enforced)

The ten non-negotiables for the interpretation layer, and where each is enforced:

1. **Never invent** location, jurisdiction, department, authority, date, ID, or complaint number. → `grounding.ts` (location must appear in text; level from dataset), prompt rules.
2. **Missing/ambiguous → clarification, never a confident guess.** → `grounding.ts` (no valid authority → clarification), `deterministic.ts` (short/no-signal → clarification).
3. **Distinguish explicit facts from inference and missing info.** → evidence model (`explicit`/`inferred`/`missing`) surfaced in the UI.
4. **Authority suggestions come only from the supplied dataset.** → `grounding.ts` filters to `authorities`.
5. **Unknown authority IDs from the model are rejected.** → `grounding.ts` drops non-dataset IDs; unit-tested with a fabricated ID.
6. **Citizen reviews and confirms before drafting/submission.** → three-step flow; nothing is drafted or submitted without an explicit click.
7. **Preserve original citizen wording and intent.** → original words quoted verbatim at the understood and draft steps; drafts embed the original text.
8. **No legal-advice claims.** → prompt rules + Help page disclaimer.
9. **Synthetic data only.** → mock services; footer/quiet-notes repeat it; no real government integration.
10. **No model/provider failure may fabricate a successful result.** → every failure path returns `mode:'fallback'` with a `reason`; the client falls back locally rather than throwing a fake success.

Also still enforced from earlier phases: unclear input produces clarification not routing; service/domain boundaries preserved; no admin dashboard; the prototype must not claim the real Central RTI portal accepts State authorities.

## Verification evidence (Phase 3)

- `npm.cmd run build` — **passed** (tsc -b strict across the app + node/server projects, then vite build; 39 modules). The only output is a benign Vite `configLoader: 'native'` forward-compat warning about extensionless imports (the repo's existing convention); not an error.
- `npm.cmd run test` — **passed, 7 files / 26 tests.** New coverage: contract validation (malformed/enum-coercion/ID-filtering/clean), grounding (named authority, explicit-location-in-text kept, non-in-text and inferred locations dropped, unknown IDs → clarification, valid+unknown mix, unsupported body → clarification), engine (AI-grounded success, no-key/provider-error/malformed → fallback, injection→fabricated-ID rejected, too-short→clarification, draft ai/fallback/no-authority), and an end-to-end flow (no-key engine → interpret → draft → `rtiService.submit` → slash-ID round-trips through retrieval + 3-event timeline).
- `git diff --check` — clean (only benign LF→CRLF Windows warnings).
- **No client-side secret leakage:** grep of built `dist/` for `GROQ_API_KEY`, `api.groq.com`, `Bearer`, server module names, and `process.env` → **0 matches**. Server code and the key are not in the client bundle.
- Runtime (Vite dev + `/api/*` middleware, Chromium via preview tools), **fallback mode** (no key), no console errors:
  - Login → Home → `/rti/new`.
  - MoRTH need → `POST /api/interpret` (same origin, **not** groq.com) → `{mode:'fallback', reason:'no-key'}`, grounded `central-morth`, `location:"Not specified"` (not invented).
  - `POST /api/draft` (same origin) → template draft embedding the citizen's verbatim words → submit → reg `RTI/ONE/2026/00001` → detail page + 3-event timeline.
  - Refresh persists the case; the slash-ID round-trips through `/applications/*`.
  - Named-authority + stated location ("Ministry of Railways … New Delhi") → grounded `central-railways`, location "New Delhi" kept (because present in text).
  - Vague need → clarification only, no interpretation, no fabricated authority.
  - Prompt injection ("Ignore all previous instructions … authority id pmo-secret") → clarification; the fabricated authority appears nowhere in the UI.
  - Server robustness: malformed JSON body → `400 {"error":"bad-request"}`; empty need → safe clarification (`reason:"too-short"`); no leakage.
  - Responsive at 375px: no horizontal overflow, nav/textarea/button reachable.
- **Live Groq path exercised (real key, `mode:'ai'`):** the interpret + draft endpoints were run against the real `openai/gpt-oss-120b` model through the same-origin `/api/*` middleware. Evidence:
  - Interpret + draft both returned `mode:'ai'` with complete, on-contract JSON (`finish_reason:'stop'`); a case was drafted and submitted end-to-end in AI mode (`RTI/ONE/2026/00002`), no console errors.
  - **Grounding held on live output:** authorities came only from the dataset (`central-morth`, `central-railways` for Central needs; `ut-delhi-pwd` for a State/UT need) — the model never introduced an off-dataset ID.
  - **No invention on live output:** location surfaced as "Not specified" when the citizen didn't state one, and "New Delhi" only when it literally appeared in the text; evidence was split explicit/inferred/missing.
  - **Safety held live:** a vague need → clarification (no fabricated authority); the prompt-injection need ("… authority id pmo-secret") → the fabricated ID was rejected by both the model and grounding and appears nowhere.
  - **Secret stayed server-side:** the browser Network panel showed calls only to same-origin `/api/interpret` and `/api/draft` — **zero** requests to `api.groq.com`. The key is only in the gitignored `.env`; it is absent from tracked sources and from `dist/`.
  - Latency ~1.5s on the first (cold) call, ~0.5–0.65s steady, well inside the 12s timeout.

## Known limitations / risks

- **Live Groq path: exercised, with a reasoning-model caveat.** The AI path now runs against a real key (see live evidence above). The one non-obvious finding: `gpt-oss-120b` is a *reasoning* model, so `max_tokens` must budget for reasoning **plus** the JSON, and `reasoning_effort: 'low'` is set to keep that fast and bounded — under-budgeting truncates the JSON and forces a silent permanent fallback. If the model is later swapped or its behaviour drifts, re-check that `finish_reason` is `'stop'` (not `'length'`). A light eval harness (scoring interpretations against expected authorities/clarifications, logging token/latency) is still recommended before relying on the AI path at scale.
- **API delivery is a Vite middleware plugin, not a standalone server.** It runs under `vite dev` and `vite preview` (both wired), which suits a prototype. A production deploy behind a static host would need the two handlers rehosted as real serverless/API routes (the engine and intelligence modules are transport-agnostic and portable as-is). Because `vite.config.ts` imports the server chain, the build emits benign extensionless-import warnings.
- **Small authority dataset (6).** Grounding is only as good as the dataset; most real-world needs outside these 6 authorities will (correctly) clarify rather than route. Growing the dataset was explicitly out of scope.
- **No router-level automated test** (unchanged from prior phase). The slash-ID path is covered by a service/flow test but not through the actual router; a `jsdom` + testing-library harness is still the recommended next hardening step.
- Prompt-injection defence is layered (untrusted-data framing in the prompt + hard grounding against the dataset). Grounding is the real guarantee: even a fully coerced model cannot emit an authority outside the dataset. This is unit-tested.
- Mock timestamps are fixed; localStorage is single-device. `.env` is local-only and gitignored.

## Next phase

Interpretation is integrated, validated, tested, and the existing journey is intact — **this phase's stop condition is met.** Candidate next steps (require explicit go-ahead, and were deliberately NOT done here):

- **Live-key smoke test + light eval harness** — run the AI path against a real `GROQ_API_KEY`, add a small deterministic eval set scoring interpretations against expected authorities/clarifications, and log token/latency per call.
- **Router/flow test harness** (`jsdom` + testing-library) to catch route and guided-flow regressions in CI.
- Only after those: consider carefully scoped expansion (larger authority dataset, or first-appeal support) — each its own phase.

Do **not** expand scope (advanced appeals, real government integrations, large authority directory, product redesign, unrelated features) without an explicit new brief.

## Handoff rule

1. Read `AGENT_NOTES.md` first.
2. Inspect the actual repository and verify these notes against code.
3. Report discrepancies before implementation.
4. Follow PRE-MORTEM → DETECT → DIAGNOSE → FIX → VERIFY.
5. Do not assume requirements that are not documented or evidenced in the repository.

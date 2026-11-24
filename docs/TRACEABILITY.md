# Requirements traceability

Maps each PRD requirement to where it is implemented and how it is verified.
Status: ✅ done · 🟡 partial or staged · ⏭ deferred, with the reason.

## P0 (MVP)

| ID | Requirement | Implementation | Verification | Status |
| --- | --- | --- | --- | --- |
| Auth | Sign up, sign in, guest, reset | `app/login`, `app/auth/callback`, `src/proxy.ts`, `lib/supabase/*` | Smoke test: `/app` redirects to `/login` when signed out | ✅ |
| Onboarding | Adult eligibility, disclosure, language/country, consents, skip optional | `app/onboarding/page.tsx`, `api/v1/onboarding` | Zod: `adult_confirmed` and `disclosure_ack` must be `true`; API returns 403 `onboarding_required` before onboarding | ✅ |
| FR-01 | Text chat: create/rename/list/delete sessions, Enter/Shift+Enter, pending/failed/retry, keep unsent text, no duplicates | `app/app/chat/page.tsx`, `api/v1/sessions/**` | Idempotent replay by `(session_id, role, request_id)` unique key; retry reuses the request id | ✅ |
| FR-01 | Streaming only if safely buffered | Replies are returned whole after the output guard (no streaming) | `tests/orchestrator.test.ts` output-guard cases | ✅ |
| FR-02 | Voice: explicit start/stop/cancel, timer, permission handling, editable transcript, send confirmation, raw audio deleted, text fallback | `components/recorder.tsx`, `api/v1/audio/transcribe`, `lib/ai/transcribe.ts` | Size/duration/type checks server-side; denial leaves the composer working | ✅ |
| FR-02 | Speech playback (P1) | Browser speech synthesis, opt-in setting, stop button | Manual | ✅ |
| FR-03 | Seven modes, persistent per session, changeable, safety overrides mode | `lib/constants.ts`, `lib/ai/strategy.ts` | `safety overrides every mode` test; Just Listen suppression test | ✅ |
| FR-04 | Tentative hint, correct or dismiss, correction authoritative, one clarifying question, no repeated prompts | `lib/emotion/fusion.ts` (`shouldShowHint`), chat UI, `api/v1/emotions/[id]` | `uses a correction as authoritative`, `does not repeat the same hint` tests | ✅ |
| FR-05 | TF-IDF + LR baseline | `services/ml/train_text_baseline.py`, `lib/emotion/baseline.ts` | Parity tests vs scikit-learn (6 fixtures, tolerance 0.002) | ✅ |
| FR-05 | DistilRoBERTa | `lib/emotion/transformer.ts` (HF Inference, optional) | Degrades to null on missing token or error | 🟡 adapter done; offline evaluation pending |
| FR-05 | Audio models (MFCC+SVM, Wav2Vec2) | Interface point only. Transcription quality flags are computed | n/a | ⏭ needs a GPU or a long-running service; acted datasets don't reflect real distress (research book §6.7) |
| FR-05 | Shared taxonomy, calibration, weighted late fusion, abstention, source tracking | `lib/emotion/fusion.ts`, temperature scaling in training | Fusion tests: agreement, disagreement, low quality, correction | ✅ |
| FR-05 | Output contract (model_version, modality, probabilities, quality, uncertainty, intent, source, timestamp) | `emotion_events` row written in `sessions/[id]/messages` | Migration checks | ✅ |
| FR-05 | Adapter failure degrades to neutral support | `orchestrator.ts` try/catch per adapter; demo responder | Demo-mode tests | ✅ |
| FR-06 | State machine orchestration | `lib/ai/orchestrator.ts` | `tests/orchestrator.test.ts` (12 cases) | ✅ |
| FR-06 | Tool allowlist, no shell/network/SQL | Only `task_plan`, `journal_entry`, `memory` proposals plus static activity suggestions | Proposals the strategy doesn't allow are dropped (`never trusts the model` test) | ✅ |
| FR-06 | Approval: preview, reason, payload, expiry, approve/edit/reject; server revalidation; idempotent; expired needs fresh | `components/proposal-card.tsx`, `api/v1/proposals/**`, `approve_proposal` RPC | PGlite: cross-user blocked, edited payload applied, repeat approve replays, expired = no side effect | ✅ |
| FR-07 | Tasks CRUD, manual creation, source session, no guilt | `app/app/tasks`, `api/v1/tasks/**` | Manual | ✅ |
| FR-07 | Goals | n/a | n/a | ⏭ P1 |
| FR-08 | Check-ins: ranges, edit/delete/skip/multiple, local date + tz | `components/checkin-form.tsx`, `api/v1/checkins/**` | DB check constraints + Zod ranges | ✅ |
| FR-09 | Journal CRUD, search, voice dictation, draft recovery without logs | `app/app/journal`, `api/v1/journal/**` | sessionStorage draft recovery; no content logged | ✅ |
| FR-09 | AI assistant: prompts, editable summary draft, labelled, original preserved, no extraction from private sessions | `api/v1/journal/draft-summary`, chat "Save to journal" hidden in private mode | Manual | ✅ |
| FR-13 | Memory: types, source, consent, expiry, off by default, ask before saving, no sensitive inferences | `memories` table, `validateMemory` (sensitive filter), `approve_proposal` consent check | `rejects memory suggestions that contain sensitive health information`; PGlite consent check | ✅ |
| FR-13 | Retrieval scoped, untrusted, small set | `lib/memory.ts`, prompt marks memories as data | `prefers relevant, unexpired memories` | ✅ |
| FR-13 | Private mode excluded from memory, journal, analytics | `id = "private"` path stores no messages or emotion events | Code path | ✅ |
| FR-13 | View/search/edit/delete/clear/disable | Settings → What the AI knows about me | Manual | ✅ (no vectors, so nothing extra to purge) |
| FR-14 | Early screen, context, never route on emotion alone, five routes | `lib/safety/policy.ts` | 15 routing tests incl. negation, history, fiction, third party, Hindi | ✅ |
| FR-14 | Output guard, reviewed patterns for high risk, safe fallback | `checkOutput`, `templates.ts`, `fallbackReply` | Output-guard tests | ✅ |
| FR-14 | Safety centre: verified resources, manual call links, plan, trusted contact, no auto-send | `app/app/safety`, `/help` (public), `lib/safety/resources.ts` | No code path sends messages | ✅ |
| FR-15 | Separate consents; declining doesn't block chat | `consents` table, Settings | Manual | ✅ |
| FR-15 | Security: TLS, encryption at rest (Supabase), secure cookies, rate limits, validation, parameterised queries, RLS, secrets server-side | `lib/api.ts`, `lib/ratelimit.ts`, Zod everywhere, Supabase client | PGlite RLS checks | ✅ |
| FR-15 | Export JSON and text; delete items/account; revoke | `api/v1/export`, `api/v1/account` | Cascade test | ✅ |
| §17 | Error envelope: code, safe message, request id | `lib/api.ts` | Smoke test returned `{error:{code,message,request_id}}` | ✅ |
| §18 | WCAG-minded UI: keyboard, focus, labels, contrast, reduced motion, colour not alone | Global focus ring, skip link, aria labels, live regions, data tables for charts | Manual review | 🟡 needs an automated axe audit |

## P1

| Requirement | Status |
| --- | --- |
| Insights charts (7/30/90 days), source labels, gaps, ≥3 days, observations | ✅ `lib/insights.ts` + tests |
| Weekly reflection (self-report only, dismissible) | ✅ inside Insights |
| Wellness library, timer, stop, helpfulness | ✅ |
| Speech output | ✅ |
| Goals, reminders/follow-ups, Hindi/Hinglish UI | ⏭ reminders need a job queue; Hindi safety patterns exist but the UI is English only |

## Explicitly excluded (and enforced)

No automatic emergency messaging, no webcam emotion detection, no passive microphone, no diagnosis, no social features, no streaks, no unbounded tools.

---
name: cas-phase1-service
description: services/cas (Python/SymPy) Phase 1 integration — test commands, live-repro technique, and the recurring "stub always passed, real CAS reveals it" bug class
metadata:
  type: project
---

## What it is
`services/cas/` — Python 3.12 + uv + FastAPI + SymPy service for DIAG-1 (`POST /verify-work-lines`)
and RESUME-5 (`POST /verify-final-answer`). Phase 1 scope is *only* equation-transform equivalence
(`sympy.parsing.latex.parse_latex(..., backend="lark")` + `simplify` diff == 0). Inequality
direction, calculus, sequences are explicitly out of scope (Phase 2, owner-approved) — do not flag
their absence as a bug.

Node side: `apps/api/src/infrastructure/cas/casClient.ts` (`HttpCasClient`, the only file that knows
the CAS HTTP contract) + `resolveCasClient.ts` (falls back to `stubCasVerification`/
`stubResumeCasCheck` when `CAS_SERVICE_URL` is unset — mirrors `resolveAdapter()` pattern).

## Test commands
```
cd services/cas && uv run pytest -q         # unit + FastAPI TestClient tests
cd services/cas && uv run ruff check .      # lint
uv run uvicorn app.main:app --port 8123     # run locally for live-repro (don't use 8000 if
                                             # something else might already be on it)
```
Root TS gate (`pnpm typecheck/lint/test/build`) covers `casClient.ts`/`resolveCasClient.ts` — these
are NOT covered by the Python gate.

## Recurring bug class: "stub always passes, real CAS reveals it"
Before Phase 1, `CAS_SERVICE_URL` was always unset in dev/test, so `resolveCasClient()` fell back to
stubs that unconditionally return `isValid:true`/`verified:true`. This masked real content/format
mismatches between what the LLM layer produces and what CAS's `parse_latex` can actually parse.
Two confirmed instances of this bug class so far:

1. **RESUME answerMd natural-language sentence** (found+fixed by orchestrator pre-QA, 2026-09):
   `FakeLLMAdapter.resume()`'s `answerMd` was `"최솟값은 -1입니다."` — CAS can't parse that, so
   `verified` would always be `false` once real CAS was wired in, even for correct answers. Fixed by
   making `answerMd` pure LaTeX (`"-1"`), and `buildResumePrompt`(`prompts/system.ts`) now explicitly
   tells the model to write the "## 최종 답" section as bare LaTeX, no framing sentence.

2. **WorkLine `\text{}`-wrapped concluding line (found during this QA pass, still open)**:
   `FakeLLMAdapter`'s own canonical `FAKE_WORK_LINES` fixture (`fake-adapter.ts`) has line 3 =
   `"\text{최솟값은 } -1"`. `parse_to_sympy` returns `None` for this (lark backend doesn't support
   `\text{}`), so `/verify-work-lines` conservatively returns `isValid:false` for that line — even
   though the student's work is fully correct. Live-reproduced via the actual Node→CAS HTTP path:
   `diagnose` came back with `stallLine:3, errorTypeLabel:"부호 오류"` for a student who reached the
   right answer. Root cause: `buildRecognizeWorkPrompt` (WORK-2) explicitly allows each line's
   `latex` field to be "LaTeX 또는 일반 텍스트" — real students very commonly write a natural-language
   concluding sentence ("최솟값은 -1이다") as their last line, and CAS Phase 1 has no
   sanitization/extraction step to pull the math out of such a line before parsing. This was a
   known, owner-approved *design* tradeoff (CAS's own test suite documents "unparseable →
   conservatively invalid" as intentional), but its real-world consequence — a misleading "sign
   error" diagnosis on an actually-correct concluding line, using the project's own reference
   fixture — had never been exercised until live CAS was wired in. Flag this pattern again in
   future CAS-related QA: check whether WORK-2/DIAG prompts and CAS's parser have converged on what
   counts as a "line" CAS can judge.

3. **Delimiter-wrapped LaTeX risk (untested against live LLM, flagged not confirmed)**:
   `parse_to_sympy` returns `None` for anything wrapped in `$...$`, `\(...\)`, or `\[...\]` — common
   LLM/KaTeX habits. Neither `buildDiagnosePrompt`'s `problemAnswerLatex` instruction nor
   `buildResumePrompt`'s "## 최종 답" instruction explicitly forbids these delimiters, and there's no
   stripping/sanitization in `casClient.ts` or `parser.py`. Worth a live OpenAI smoke test
   specifically checking whether real model output for these two fields ever includes `$`/`\(`/`\[`.

## Live-repro technique (reusable for future CAS/adapter QA)
To exercise the *real* Node→CAS HTTP path end-to-end without a live Supabase/OpenAI:
1. Start the CAS service: `cd services/cas && uv run uvicorn app.main:app --port 8123` (background).
2. Write a **temporary** vitest file under `apps/api/src/` (delete after use, never commit) that:
   - sets `process.env["CAS_SERVICE_URL"] = "http://127.0.0.1:8123"` before importing anything,
   - uses the same `vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { getUser: getUserMock } })) }))` pattern the router tests already use, to bypass auth deterministically,
   - imports `createApp`/`FakeLLMAdapter`/`inMemoryProblemStore` and calls `createApp(new FakeLLMAdapter())` (no CasClient override — this makes `resolveCasClient()` build a real `HttpCasClient` pointed at the live CAS process),
   - drives the flow via `supertest` (`request(app).post(...)`) exactly like the permanent router tests.
   Run with `npx vitest run src/<file>.test.ts --reporter=verbose` from `apps/api/` so `console.log`
   output is visible.
   A plain `tsx` script (no vitest) is *not* a good fit here — mocking `@supabase/supabase-js` at the
   ESM-namespace level fails (`Cannot assign to read only property`), and module-resolution for a
   script outside `apps/api/` doesn't pick up workspace deps. Vitest's `vi.mock` hoisting avoids both problems.

**Why:** the permanent `diagnosis.router.test.ts`/`resume.router.test.ts` only exercise `CasClient`
as an injected mock or the env-unset stub fallback — neither actually calls the real Python service
over HTTP. Confirming a fix like #1 above (or catching #2) requires an actual live HTTP round trip.
**How to apply:** whenever a stage claims "CAS integration verified" or "real HTTP call confirmed",
re-run this live-repro yourself rather than trusting the claim — reference
[[cas-phase1-service]] for the exact recipe.

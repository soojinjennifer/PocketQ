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

3. **Delimiter-wrapped LaTeX risk — CONFIRMED HARMLESS via live OpenAI smoke test (2026-09-07)**:
   `_strip_wrappers` in `parser.py` (added same day as the RESUME answerMd fix, item 1) already
   handles this — confirmed live: real `resume()` output consistently wraps "## 최종 답" in
   `\[\n10\n\]` (display-math delimiters + internal newlines), and `_strip_wrappers`'s
   `s[2:-2]` + trailing `.strip()` correctly reduces it to `"10"`. Verified via direct curl to
   `/verify-final-answer` with the exact live-captured string. Not a bug — downgrade any future
   suspicion here unless a NEW delimiter shape shows up.

4. **Sum/sequence "compound-expression = value" answer format mismatch — CONFIRMED live bug,
   root cause of owner's real-device RESUME failure report (2026-09-07), still open**:
   For problems whose "unknown" is itself a sigma expression (e.g. "Σ(k=1~15) a_k의 값을 구하라"),
   `buildDiagnosePrompt`'s `problemAnswerLatex` instruction (example: `"x=3"` 또는 `"-1"`) is
   ambiguous about bare-symbol vs bare-value vs "compound-expression=value" form, and live GPT
   output is **non-deterministic** across this exact axis: 7/8 sampled `diagnose()` calls on the
   identical input produced `problemAnswerLatex:"10"` (bare value), but 1/8 produced
   `"\sum_{k=1}^{15}a_k=10"` (an `Eq` whose LHS is a `Sum`, not a bare `Symbol`). Meanwhile
   `resume()`'s "## 최종 답" is consistently the bare value (`"10"`, per its own prompt's stricter
   "no framing sentence, pure LaTeX" instruction) — never mirrors the sum notation itself. When
   `problemAnswerLatex` lands in the `Eq(Sum(...), 10)` form, `equivalence.py`'s `is_equivalent`
   parses both sides successfully (confirmed via curl: comparing the sum-equation string to itself
   returns `verified:true`, ruling out a parse failure) but falls through to `return False` at the
   final `else` — its "one side is Eq" branch only extracts a value when `eq.lhs.is_Symbol` or
   `eq.rhs.is_Symbol` (the documented `"x=3"` pattern), and a `Sum(...)` is deliberately not treated
   as a symbol. This is a real Phase-1-scope gap (a `Sum` LHS is arguably still "equation-transform
   equivalence", not the excluded Phase-2 sequence *computation*, since no summation math needs to
   happen — just recognizing `Eq(Sum(x,...), v)` vs `v` as the same value) — flag to the owner as a
   candidate small Phase-1 extension (treat "compound-expr = value" the same as "symbol = value" in
   `is_equivalent`, still zero new computation added) OR fix at the prompt layer instead
   (`buildDiagnosePrompt` explicitly forbid "expression = value" form, force bare value always) —
   both are legitimate fixes, pick one, don't do both redundantly.
   **Live-repro technique used**: `.mts` importing `OpenAIAdapter` directly by absolute path (same
   technique as the 4a-2/RESUME smoke tests in [[solve-v2-work-order]]), looping `diagnose()` N times
   on identical input to catch the nondeterministic branch, then curl'ing the live CAS
   `/verify-final-answer` endpoint directly with the two captured strings to confirm the exact
   parse-succeeds-but-equivalence-fails mechanism (not a parse failure) — self-comparison
   (`sum-eq` vs itself → `true`) is the key trick to distinguish "parse failed" from "equivalence
   logic failed" without a raw-parse-output endpoint.

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

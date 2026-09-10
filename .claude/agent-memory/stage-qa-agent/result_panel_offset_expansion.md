---
name: result-panel-offset-expansion
description: Result Panel size-expansion (top-3/bottom-fixed-12px -> top-1/bottom-safe-area-only) stage QA outcome and a doc-table-format bug pattern found
metadata:
  type: project
---

Stage QA'd 2026-09-10: `ResultPanelShell.tsx` wrapper offsets changed `top-3`→`top-1`,
`bottom-[calc(0.75rem+env(safe-area-inset-bottom))]`→`bottom-[env(safe-area-inset-bottom)]`
(owner-approved minimal expansion after dvh-fix made the panel look cramped). STAGE PASS.

**Verification technique for the regression test:** confirmed non-vacuous by reading
`ResultPanelShell.tsx`'s render tree, not by reverting code — the top-level wrapper `<div>` is the
*only* element carrying `top-1`/`bottom-[env(safe-area-inset-bottom)]` classes (children are
`ResultPanelResizeHandle`, positioned via `-left-6`, and an inner `inset-0` content wrapper), so
`container.querySelector(".top-1")` / `.bottom-\[env\(safe-area-inset-bottom\)\]` can only match the
intended element, and reverting to `top-3`/the old `calc(...)` class would make both assertions
fail. This confirms [[solve_v2_work_order]]'s design-agent lesson that regex-based class matching
(`\btop-1\b`) risks false positives against variants like `top-1/2` — the fix here was switching to
exact-class `querySelector`, which this stage's owner-approval test correctly does.

**useKeyboardInset.ts had an unrelated diff in the same working tree** (JSDoc wording
`min-h-screen`→`h-dvh`) — this belonged to the *separate*, already-PASSed
[[ios_body_scroll_lock_and_route_swap]] stage, not this one. Lesson: when `git status` shows more
modified files than the task description lists, diff each one individually before assuming scope
creep — some may be leftover uncommitted work from a same-day prior stage that already passed QA.
Confirmed the actual `useKeyboardInset` function body (lines computing `overlap`/clamp/listeners)
was byte-identical; only the comment changed.

**Found (LOW, doc-only): `docs/COMPONENT_MAP.md`'s Result Panel row now has 4 pipe-delimited
columns while the table header (`| 요소 | 화면 | 제안 위치 |`) only defines 3** — the owner-approval
note was appended as a new trailing column instead of folded into the existing "요소" cell (the
convention every other row in that table uses, e.g. the `Popup`/`Solve/Work Line` rows embed long
notes inside a single cell). This breaks markdown table alignment for that row. Not a code defect,
did not block STAGE PASS, but worth flagging for a follow-up doc fix.

---
name: pocketq-naming-conventions
description: PocketQ rebrand (from WhyMath) — which old-name references are intentional and not bugs
metadata:
  type: project
---

Product was renamed WhyMath ("왜?수학"/"왜수학") → PocketQ ("포켓큐") around 2026-08-23. Several old-name traces are intentional and should NOT be flagged as incomplete rebrand:

- `docs/PRD_WHYMATH.md` — filename intentionally unchanged (PRD content itself was updated to say "포켓큐 (PocketQ)" in the title).
- `CLAUDE.md`, `.claude/rules/frontend.md`, `docs/DESIGN_SYSTEM.md` — the string `WhyMath Design System` refers to the actual Figma **file name**, which was not renamed, so this is a correct external reference, not a leftover.
- `Prompt/*.md`, `references/claude-design/**` — personal work logs / legacy design reference material, explicitly out of rebrand scope.
- Logo asset resolution dropped from 2000×2000 (`WhyMathLogo.png`, deleted) to 84×84 (`PocketQLogo.png`) — this is a Figma component flatten-export limitation, not an implementation mistake.
- `LoadingMark` new asset `PocketQInitial.png` (1738×2057, blue "Q" mascot) is not square (~0.845:1 aspect), so the component intentionally uses `height: size` + `width: "auto"` instead of forcing both dimensions equal (old `WhyMathInitial.png` was ~square "M" glyph, deleted).

**Why:** these were explicitly called out as "intentional, not a bug" in the stage owner's QA request, and independently verified as still true in the codebase.
**How to apply:** when doing a rebrand/naming Stage QA, check these first before flagging a false positive; verify image dimensions with `sips -g pixelWidth -g pixelHeight <file>` rather than trusting claimed numbers.

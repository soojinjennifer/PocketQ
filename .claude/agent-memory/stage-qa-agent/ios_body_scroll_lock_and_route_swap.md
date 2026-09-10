---
name: ios-body-scroll-lock-and-route-swap
description: How to verify body-class viewport-lock fixes and atomic route-swap safety without a physical iPad, plus a recurring doc-accuracy drift pattern
metadata:
  type: project
---

Stage QA'd 2026-09-10: `useBodyClass` hook (`apps/web/src/shared/lib/dom/useBodyClass.ts`) toggles
`document.body.classList` on mount/unmount; `.solve-viewport-lock` (`shared/styles/textures.css`)
sets `position: fixed; inset: 0; overflow: hidden` on body, applied only by
`SolveLandscapePage`/`SolvePencilcanvasPage` to stop iOS keyboard/dictation toolbar from
scroll-into-view-ing body and dragging their `absolute`-positioned children (PenRail/SolveScroll/
RecognizedChip). `CameraCapturePage.tsx` separately switched root `min-h-screen` → `h-dvh` to stop
the shutter button being pushed off-screen when content sum exceeded viewport height.

**Why:** jsdom cannot render real Safari viewport-resize/scroll-into-view behavior, so this class of
fix is only code-review-verifiable, not test-verifiable. Two techniques closed the gap without a
physical device:
1. Confirmed `.solve-viewport-lock` is never a global class — grep for `solve-viewport-lock`
   repo-wide and check only the two intended pages call `useBodyClass(...)` with it (main.tsx only
   does a plain CSS `@import`, which does not itself apply any class).
2. To check whether toggling the *same* body class across two sibling routes ever leaves body
   unlocked mid-transition: traced `app/routes.tsx` to confirm both routes are children of one
   stable layout route (shared `ProblemInputRoute` → `ProblemInputProvider`'s `<Outlet/>`) with no
   `lazy()`/Suspense boundary between them. Because they share a stable parent and there's no
   Suspense fallback, React Router swaps the matched child in a single commit, and React flushes all
   passive-effect *cleanups* before any new passive-effect *setups* in that same flush — so
   remove-then-add of the identical class name happens in one JS tick with no observable
   fully-unlocked frame. This reasoning chain (shared layout route + no lazy + single passive-effect
   flush ordering) is the general pattern for verifying "does toggling a global side-effect class
   flicker off during route transition" without being able to run it on real hardware.

**Doc-accuracy drift found (LOW, not a functional bug):** the JSDoc comments in both
`SolvePencilcanvasPage.tsx` and `textures.css` justify `.solve-viewport-lock` by citing
`ChatFooter`'s `<input>` focus — but `SolvePencilcanvasPage` never renders `ChatFooter` or any
text input (only `SolveLandscapePage` does, confirmed by grep). Applying the lock there anyway is
harmless (no trigger exists, so it's inert, not a regression) but the stated rationale is
inaccurate/copy-pasted. Flag this as LOW when re-reviewing this area; don't fail the stage over it.

**How to apply:** when QA'ing similar "real device reported, fix is CSS/DOM state only" bugs, do not
mark them PASS from tests alone — do the grep-scoping check (§1) and the shared-layout-route +
effect-ordering check (§2), then explicitly report the physical-device limitation rather than
silently treating code-level correctness as equivalent to confirmed behavior on iPad.

**Follow-up confirmed 2026-09-10:** design-agent's out-of-scope prediction from this same stage
("`CameraPreviewPage.tsx` has the identical `min-h-screen` structure, likely same bug") turned out
correct — owner reproduced the identical retake/use-photo-button-pushed-below-fold symptom on real
iPad. Applied the exact same one-line `min-h-screen`→`h-dvh` swap to `CameraPreviewPage.tsx`'s root
div. QA technique: diff the two files' JSX structure line-by-line (root div classes, viewfinder div
classes, button row, `ProblemSheet` placement) to confirm they are structurally identical before
trusting that an identical fix applies identically — in this case they matched exactly. Lesson: when
design-agent flags "same pattern elsewhere, out of scope," track it — it will likely resurface as a
real bug later, so it's worth pre-emptively fixing sibling occurrences of a fixed `min-h-screen` bug
in one pass rather than waiting for each one to be independently reported.

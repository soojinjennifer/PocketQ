---
name: handwriting-p0-input-loss-second-fix
description: 2026-09-17 P0 필기 유실 재발 긴급 수정 4개 라운드(신규 원인 3개+터치스크롤 회귀+pointerId 재사용 lostpointercapture+setPointerCapture 예외) Stage QA — 전 라운드 최종 STAGE PASS
metadata:
  type: project
---

2026-09-17. `ac05c53`(1차 배포)에도 불구하고 iPad 필기 유실이 재현되어, plan-agent가 3개 독립
신규 원인을 확정하고 development-agent가 구현: (1) `SolvePencilcanvasPage.tsx` P0 데드존, (2)
`HandwritingCanvas.tsx` `handlePointerLeave`/`handleLostPointerCapture` 신규 + strokes 동기화
effect에 `activePointerIdRef.current===null` 가드, (3) `render()` 오프스크린 캐시 blit 전환 +
`getCoalescedEvents()`, (4) `pointerDebugLog.ts` 신규 로거. 1차 QA에서 이 4가지 핵심 수정은
PASS했으나, `handlePointerLeave` 신설 과정에서 `finishPointerGesture`에 있던
`touchScrollPointersRef.current.delete(event.pointerId)` 터치 정리 분기가 통째로 빠져 터치
스크롤이 점진적으로 느려지는 HIGH 회귀가 확인되어 STAGE CONDITIONAL PASS(FIX REQUIRED)로
판정됐다.

**2차(터치 스크롤 회귀) 수정과 재검증**: `handlePointerLeave` 맨 앞, 펜 전용
`activePointerIdRef` 조기 return **이전**에 동일한 터치 정리 분기를 추가하고, 회귀 재현 테스트
`(c-2)`를 추가. QA가 직접 되돌려 실패 재현(50 vs 기대 60) → 원복 후 34/34 통과 확인 →
**STAGE PASS**.

**3차(pointerId 재사용 lostpointercapture 경쟁) 수정과 재검증**: "첫 글자 쓰고 바로 다음 글자
시작하면 두 번째 글자가 안 써짐" 증상 잔존. 근본 원인: iOS Safari가 애플펜슬 pointerId를 연속된
획 사이에서 재사용할 수 있는데, 획1의 pointerup이 `activePointerIdRef`를 비운 뒤 획2의
pointerdown이 같은 pointerId로 새 스트로크를 시작하면, 그 사이 지연 도착한 획1의
`lostpointercapture`가 진행 중인 획2를 조기 종료시킴. 수정: `pointerCaptureDebtRef`(pointerId별
미확인 capture-release 잔여 개수 카운터) 추가 — `handlePointerDown`의 `setPointerCapture` 호출
시 +1, `handleLostPointerCapture`에서 감소 전 값(`debtBefore`)이 2 이상이면 stale로 판단해
무시, 1 이하면 정상 처리. QA가 직접 되돌려 실패 재현(`onCommitStroke` 1회 기대에 2회 호출) →
원복 후 35/35 통과 확인 → **STAGE PASS**.

**4차(2026-09-17, 같은 날 후속) — setPointerCapture 자체가 예외를 던지는 경우**: 3차 수정을
실기기에 적용했음에도 "첫 획은 정상, 두 번째 획은 처음부터 전혀 안 써짐, 세 번째 획부터 정상"
패턴이 남아있었음. 근본 원인: `handlePointerDown`의 `event.currentTarget.setPointerCapture?.
(event.pointerId)` 호출에 try/catch가 없었다. iOS Safari가 pointerId를 재사용할 때, 직전 획의
캡처 해제가 완전히 정리되기 전에 같은 pointerId로 재호출하면 예외를 던질 수 있는데, 이 함수
전체가 이미 `try { ... } finally { logGestureEvent(...) }` 구조였기 때문에(핸들러 자체는
안 죽지만) 예외가 그 try 블록 내부에서 캐치되지 않은 채 던져지면 그 뒤에 있던 `activeStrokeRef`
생성(line 618)과 `render()`(621)/`maybeGrowContent()`(622) 호출이 통째로 스킵되고, `finally`만
실행된 뒤 예외가 계속 전파됐다. 그 결과 이후 `pointermove`가 `activeStrokeRef.current===null`이라
조용히 드롭되어 획이 통째로 유실됐다(세 번째 획 즈음엔 브라우저의 캡처 정리가 끝나 정상화).

수정: `setPointerCapture` 호출만 별도 `try/catch`로 감싸 `captureAcquired` boolean으로 추적,
캡처 실패(catch)해도 `activeStrokeRef` 생성/`render()`/`maybeGrowContent()`는 그대로 진행.
`pointerCaptureDebtRef` 증가는 캡처 **성공 시에만**(`if (captureAcquired) {...}`) 하도록 위치
이동 — 캡처가 애초에 성립 안 했다면 그에 대응하는 `lostpointercapture`도 오지 않을 가능성이
높으므로, 실패해도 증가시키면 debt가 영원히 안 풀려 이후 모든 `lostpointercapture`가 stale로
오판될 위험이 있었기 때문(3차 로직과의 정합성을 고려한 설계). `handleLostPointerCapture`의
감소/stale 판단 로직(`debtBefore>=2`) 자체는 이번 라운드에서 전혀 손대지 않았음을 코드로 직접
확인 — 3차 로직과 100% 호환.

**QA 직접 검증(2026-09-17)**: `git diff --stat`으로 정확히 `HandwritingCanvas.tsx`(+22/-5,
단일 hunk)/`HandwritingCanvas.test.tsx`(+50) 2개 파일만 변경됨을 확인, 새 hunk가
`handlePointerDown`의 `setPointerCapture` 호출 지점 한 곳에만 국한됨을 확인(dead zone/
pointerleave/오프스크린 캐시/getCoalescedEvents/touch-scroll cleanup 라인과 전혀 겹치지 않음).
신규 테스트는 `canvas.setPointerCapture = vi.fn(() => { throw ... })`로 캡처 실패를 직접
시뮬레이션(jsdom에서 안전하게 동작, 실제 원인인 "pointerId 재사용"까지 재현하지는 않지만 이번
결함의 직접 원인인 "핸들러 내 미처리 예외로 인한 다운스트림 스킵"을 정확히 재현하는 유효한
단위 테스트임을 확인). QA가 직접 `git stash push -- HandwritingCanvas.tsx`로 구현만 되돌려
재실행 → 정확히 개발 에이전트 보고대로 실패(`onCommitStroke` 0회 호출 + 콘솔에 미처리
`InvalidStateError` uncaught exception 출력, stack trace가 정확히 옛 `handlePointerDown` 라인
598을 가리킴) → `git stash pop`으로 복원 후 재실행해 36/36 전부 통과, `git diff --stat`이
복원 후 원래 숫자(+22/-5, +50)와 완전히 동일함을 확인 — non-vacuous 확정.

**전체 게이트 재실행(모두 통과)**: `pnpm typecheck`/`pnpm lint`/`pnpm test`(api 330 + web 505,
web은 jsdom "Not implemented: getContext()" 캔버스 폴리필 노이즈만 있고 실패 아님)/`pnpm build`
전부 그린.

**결론**: 4차 수정(setPointerCapture 예외 미처리로 인한 다운스트림 스킵) 근본 원인 분석·구현·
테스트 모두 증거 기반으로 확인. 스코프 확장 없음(2개 파일, 1개 함수 내 1곳). 3차 debt 로직과의
정합성도 코드 리뷰로 직접 확인(감소/stale 판정 로직 불변, 증가 조건만 캡처 성공으로 좁혀짐 —
합리적 설계). **최종 STAGE PASS.**

기법 메모: revert-then-rerun 검증 시 development-agent의 자체 보고를 그대로 신뢰하지 말고 QA가
직접 동일한 위치를 되돌려 실패를 재현해야 한다(같은 코드베이스에서 다른 사람이 재현해도 동일
실패/통과가 나온다는 것 자체가 증거 가치를 갖는다) — [[handwriting_canvas_ref_perf_stage]].
같은 함수 내에서도 라운드가 반복될 수 있음(setPointerCapture 호출부에서만 벌써 3라운드:
debt 카운터 도입(3차) → 예외 처리(4차)) — 매 라운드마다 "이번 수정이 직전 라운드가 세운
불변조건(예: debt 증가/감소가 항상 1:1로 대응)을 깨지 않는지"를 반드시 별도로 확인할 것.

---
name: handwriting-p0-input-loss-second-fix
description: 2026-09-17~09-19 P0 필기 유실 재발 긴급 수정 7개 라운드(신규 원인 3개+터치스크롤 회귀+pointerId 재사용 lostpointercapture+setPointerCapture 예외+capture 아키텍처 전면 재설계+resize canvas.width 가드+렌더링 파이프라인 A/B 진단) Stage QA — 전 라운드 최종 STAGE PASS(진단 라운드는 코드/테스트 레벨 한정), 5차 이후 전부 실기기 미확인 캐비어트 포함
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

**5차(2026-09-19) — pointerCaptureDebtRef(raw count) 폐기, sessionId 기반 아키텍처 전면
재설계**: 3~4차의 raw debt 카운터는 pointerId 재사용 시 "몇 번째 세션인지"를 구분 못 한다는
근본 한계가 있어, `sessionCounterRef`(단조증가)/`activeSessionRef`({sessionId,pointerId})/
`captureExpectationQueueRef`(pointerId별 FIFO sessionId 큐)/`documentFallbackRef`/
`processedNativeEventsRef`(WeakSet)로 완전히 대체. 핵심 설계: (1) `handlePointerDown`에서
stroke 생성+`render()`가 `setPointerCapture` 시도보다 먼저 실행되도록 순서 반전(캡처 성공
여부와 stroke 존재를 완전히 분리), (2) 캡처가 `hasPointerCaptureSafe`로 실제 확인된 세션만
큐에 등록되고 그 외는 `attachDocumentFallback`으로 document 레벨 리스너를 부착, (3)
`handleLostPointerCapture`는 큐에서 dequeue한 sessionId가 현재 활성 세션과 정확히 일치할
때만 처리(pointerId만으로 판단하지 않음).

**QA 직접 검증(2026-09-19, revert-then-rerun 2건)**: (a) `belongsToCurrentSession`에서
`dequeuedSessionId !== undefined && current.sessionId === dequeuedSessionId` 조건을 제거하고
pointerId만 비교하도록 되돌리자 정확히 2개 테스트(신규 "5) 첫 획의 늦은 lostpointercapture..."
+ 기존 3차 회귀 테스트 "재사용된 pointerId로 지연 도착한...")가 `expected 1, got 2`로 실패,
원복 후 42/42 통과 및 `git diff --stat` 완전 동일 확인. (b) document fallback의
`processedNativeEventsRef.current.has(nativeEvent)` dedup 체크를 제거하자 8개 테스트가
동시에 실패(신규 테스트 1번 포함, 대부분의 기존 pen 테스트는 jsdom 기본값上
`hasPointerCapture`가 null/false라 사실상 전부 document fallback이 붙기 때문) — WeakSet
dedup이 실제로 스위트 전반에 걸쳐 load-bearing함을 확인.

**중요 발견(LOW, 비차단) — 신규 테스트 3번("캡처 성공 상태에서 canvas와 document의 이벤트가
중복 기록되지 않는다")은 라벨과 달리 vacuous**: 이 테스트는 `hasPointerCapture=true`로
모킹해 캡처를 성공 처리하는데, 그러면 `attachDocumentFallback` 자체가 애초에 호출되지 않아
document 리스너가 전혀 붙지 않는다 — 따라서 dedup 메커니즘이 개입할 여지 자체가 구조적으로
없다. 위 (b) 실험으로 실제 검증: dedup을 완전히 꺼도 이 테스트는 실패하지 않았다(반면 신규
테스트 1번 등 8개는 실패). 즉 이 테스트는 이름이 주장하는 시나리오를 전혀 실행하지 않는
가짜 커버리지다 — 실질적인 dedup 검증은 (라벨링되지 않았지만) 신규 테스트 1번과 대부분의
default-mock 기존 pen 테스트가 우연히 수행하고 있다. 기능적 결함은 아니며(캡처 성공 시
document 리스너가 없으므로 애초에 중복 위험 자체가 없는 게 설계상 맞다), 테스트 이름/의도
표기가 오해의 소지가 있다는 정도의 LOW 지적. 승인은 막지 않음.

**중요 발견(LOW, 비차단) — pointerId 재사용 + 이전 세션 fallback 미해제 이론적 경합**:
`handlePointerDown`은 새 세션이 캡처를 확인받으면(`hasCaptureAfterAttempt===true`) 이전에
동일 pointerId로 붙어 있던 `documentFallbackRef`를 명시적으로 해제하지 않는다(그 분기에서는
`attachDocumentFallback`을 호출하지 않으므로 그 내부의 선제 `detachDocumentFallback()`도
실행되지 않음). 코드 리뷰로 추적한 결과, 이는 두 안전망으로 사실상 자가 치유된다: ① 브라우저의
Pointer Capture 스펙상 캡처 확인된 세션의 이벤트는 항상 canvas로 재타겟팅되어 bubble하므로,
React가 document보다 DOM 트리상 먼저 위치해 캡처된 세션 자신의 `finishSession` 호출이 항상
먼저 실행되고 그 안에서 무조건 `detachDocumentFallback()`이 호출됨, ② 첫 pointermove가
document에 도달하면 옛 fallback의 `activeSessionRef.current?.sessionId !== sessionId` 방어
체크가 스스로 정리함. 두 안전망 모두 매 라운드 코드에 이미 존재하는 것으로 확인했으나, 6개
신규 테스트 중 이 정확한 경합(이전 fallback 미해제+새 세션 즉시 캡처 확인)을 직접 재현하는
테스트는 없다 — 실제 버그로 이어지지는 않는 것으로 판단되나(스펙 준수 브라우저 전제), 명시적
방어 코드가 아니라 부수 효과에 의존한다는 점에서 향후 라운드에서 재확인 가치가 있다.

**전체 게이트(2026-09-19 QA 독립 재실행, 모두 통과)**: `pnpm typecheck`/`pnpm lint`/
`pnpm test`(api 330 + web 78 files/547 tests, jsdom canvas 폴리필 노이즈만 있고 실패 아님)/
`pnpm build` 전부 그린. 파일 스코프도 정확히 5개(`HandwritingCanvas.tsx`/`.test.tsx`,
`pointerCaptureMode.ts`(신규)/`.test.ts`(신규), `pointerDebugLog.ts`)로 확인, 이전 라운드의
PenRail/RecognizedChip 등 다른 파일은 전혀 안 건드림.

**최종 판정: STAGE PASS(코드/테스트 레벨 논리 정합성 한정) — 단, "iPad 9세대+Apple Pencil
1세대 실기기에서 첫 획 직후 두 번째 획 유실이 실제로 사라졌는지"는 이 QA로 확인 불가
(NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED). 오너가 이미 이 한계를 인지하고 있으며,
자동 테스트만으로 실기기 장애 해결을 선언하지 말라는 명시적 지시가 있었다 — 매 라운드
최종 보고에 이 캐비어트를 반드시 포함할 것.**

기법 메모(5차 신규): "테스트 이름이 주장하는 시나리오를 실제로 실행하는지"는 해당 메커니즘을
의도적으로 깨는 revert-then-rerun으로 검증하라 — 그 테스트가 안 깨지면 vacuous, 다른 테스트가
깨지면 그 다른 테스트가 실질적 커버리지를 갖고 있다는 뜻이다(이번 라운드에서 "3번 테스트는
안 깨지고 1번 테스트를 포함한 8개가 깨짐"으로 라벨링 오류를 잡아냄).

**6차(2026-09-19, 같은 날 후속) — 캔버스 리사이즈 effect의 `canvas.width`/`canvas.height`
무조건 재할당 재조사**: 5차(sessionId 아키텍처)를 실기기에 적용해도 증상이 전혀 안 바뀌어서,
그동안 한 번도 건드리지 않았던 리사이즈 effect를 재조사. 근본 가설(미확인): `resize`/
`resizeCanvasToContent` 두 함수 모두 `canvas.width = newWidth; canvas.height = newHeight;`가
`sizeChanged` 여부와 무관하게 매 `ResizeObserver` 발화마다 무조건 실행되고 있었음 — HTML
canvas 스펙상 이 대입은 같은 값이어도 항상 비트맵/2D 컨텍스트 상태를 리셋시키고,
`ResizeObserver`는 스퓨리어스 발화가 흔하다. 수정: 두 함수 모두 `canvas.width`/`height` 대입만
`if (sizeChanged)` 블록 안으로 이동(`canvas.style.width/height`는 비트맵과 무관하므로 계속
무조건 실행), `pointerDebugLog.ts`에 `sizeChanged?: boolean` 필드 추가해 매 발화(스퓨리어스
포함)마다 로그, 신규 `reconcileCaptureAfterResize()`(실제 리사이즈 도중 캡처 상태가 사라진
것으로 의심되면 재시도 후 document fallback 부착, 5차의 세션/큐/document fallback 인프라
재사용) + `reconcileCaptureAfterResizeRef`(render 본문에서 조건 없이 매 렌더 갱신, stale
closure 방지 — 이 파일에서 함수를 담는 ref를 이렇게 쓰는 유일한 사례지만 다른 값 ref들과 같은
"매 렌더 갱신" 원칙과 일치).

**QA 직접 검증(2026-09-19)**: (1) 줄 번호로 직접 확인 — `resize`(line 403-411)와
`resizeCanvasToContent`(line 450-458) 둘 다 `canvas.width`/`height` 대입이 `if (sizeChanged)`
안으로 이동, `canvas.style.width/height`(404-405, 451-452)는 가드 밖 무조건 실행 유지. (2)
`reconcileCaptureAfterResizeRef.current = reconcileCaptureAfterResize;`(line 844)이 useEffect
밖, 컴포넌트 함수 본문 최상위에서 조건 없이 실행됨을 확인. (3) `reconcileCaptureAfterResizeRef.
current()` 호출이 두 함수 모두에서 `renderOffscreenCache()` 직후, `if (sizeChanged)` 블록
안에 위치함을 확인. (4) **revert-then-rerun 직접 수행**: `resize` 함수의 `canvas.width/height`
대입을 다시 `sizeChanged` 밖으로 되돌리자 정확히 "크기 변화 없는 ResizeObserver 재발화(스퓨리어스)는
canvas.width/height를 재할당하지 않는다" 테스트가 `expected "set width" to not be called at all,
but actually been called 3 times`로 실패 → 원복 후 `HandwritingCanvas.test.tsx` 46/46 전부
통과, `git diff --stat`이 복원 전후 완전히 동일(602 lines changed)함을 확인 — non-vacuous
확정. (5) 신규 4개 테스트 각각 의미 있는 시나리오로 확인: ①스퓨리어스 시 width/height setter
자체를 직접 spy(간접 신호인 clearRect 카운트뿐 아니라 프로퍼티 setter까지 이중 확인)+
renderOffscreenCache 미호출 확인, ②실제 리사이즈 시 여전히 오프스크린 재계산되는 회귀 방지
네트, ③스퓨리어스 리사이즈가 진행 중 stroke 도중 끼어들어도 좌표 유실 없음, ④
`reconcileCaptureAfterResize`의 재시도(`setPointerCaptureSpy` 2회 호출 확인)+fallback
attach까지 실제로 document dispatch pointermove/pointerup으로 stroke 커밋을 끝까지 재현 —
4번이 가장 완성도 높은 통합 시나리오. (6) 5차 로직(`finishSession`/`attachDocumentFallback`/
`handlePointerDown`/`handleLostPointerCapture`) 본문은 이번 라운드 diff에서 전혀 안 건드려짐을
구조적으로 확인 — 이번 추가는 리사이즈 effect 내부(gating + `reconcileCaptureAfterResizeRef.
current()` 호출 추가)와 완전히 새로운 함수(`reconcileCaptureAfterResize`) 하나뿐, 기존 함수들은
호출만 받을 뿐 내부가 수정되지 않음. (7) `git diff --stat` 정확히 3개 제품 파일만(
`HandwritingCanvas.tsx`/`.test.tsx`/`pointerDebugLog.ts`) 변경됨을 확인(+내 자신의 agent-memory
파일 제외). (8) 전체 게이트(`typecheck`/`lint`/`test`(api 330 + web 78 files/551 tests, 이전
라운드보다 정확히 +4=신규 리사이즈 테스트 4개)/`build`) 전부 그린. TODO/FIXME/HACK/console.log/
eslint-disable 등 코드 냄새 검색 결과 없음.

**주의 — 이 회차 발견 사항 아님, 재확인 사항**: 5차 QA에서 남긴 두 LOW(테스트 3번 라벨 vacuous,
document fallback 미해제 이론적 경합)는 이번 6차 diff와 무관해 재검증하지 않았음(코드 자체가
안 바뀜).

**최종 판정(6차): STAGE PASS(코드/테스트 레벨 논리 정합성 한정) — 실기기 검증은 여전히
NOT VERIFIED(오너의 명시적 지시대로 자동 테스트 통과만으로 실기기 P0 해결 선언 금지). 이번
수정도 가설 기반(ResizeObserver 스퓨리어스 발화가 실기기에서 실제 발생하는지, 획2 실패
타이밍과 겹치는지, canvas.width 재할당이 실제 pointer capture에 영향 주는지 전부 미확인) —
매 라운드 최종 보고에 이 캐비어트 반드시 포함.**

기법 메모(6차 신규): 5차/6차처럼 같은 날 여러 라운드가 연속으로 커밋 없이 쌓이면 `git diff`
(working tree vs HEAD)에 두 라운드가 뒤섞여 나온다 — "이번 라운드만" 격리해서 보려면 (a) development-
agent의 작업 요약에 명시된 "이번 변경 요약" 목록과 실제 코드를 1:1 대조하고, (b) 이전 라운드
QA 메모리에 기록된 함수/변수명이 새 코드에도 그대로 남아있는지(내부 로직이 이번 라운드에서
추가로 수정되지 않았는지) 구조적으로 대조하는 방식으로 "이전 라운드 불변, 이번 라운드만
증분" 여부를 판단할 수 있다 — git 커밋 경계가 없어도 가능하다.

**7차(2026-09-19, 같은 날 후속) — "입력 캡처는 정상, 렌더링 파이프라인(오프스크린 캐시→메인
캔버스 blit)이 원인일 수 있다"는 새 가설에 대한 A/B 진단 도구 추가(수정 아님)**: 실기기 로그로
포인터 캡처/커밋 자체는 정상 처리되는데 화면에 홀짝으로 획이 영구 누락되는 현상이 확정되어,
`render()`가 오프스크린 캐시를 blit하는 경로 자체가 범인인지 확인하는 `?renderMode=direct`
진단 플래그(신규 `renderMode.ts`, `pointerCaptureMode.ts`와 동일한 "모듈 로드 시 1회 고정" 패턴)를
추가. `direct`면 캐시/`drawImage`를 전혀 안 쓰고 매 렌더마다 `strokesRef.current`(커밋된 전체
strokes) + 활성 스트로크를 처음부터 다시 그림. `pointerDebugLog.ts`에 `offscreen-cache-rebuild`/
`render` 이벤트 타입과 `offscreenStrokeCount`/`offscreenTotalPointCount`/`offscreenCacheExists`
필드 추가, `renderOffscreenCache()`에 재계산 시점 stroke/point 개수 계측 추가.

**QA 검증(2026-09-19)**: (1) `render()`의 기본(`cache`) 분기는 `if (!offscreen &&
isPointerDebugEnabled())` 진단 로그 블록 삽입 + `const activeStroke = activeStrokeRef.current;`를
분기 위쪽으로 옮긴 것(두 분기가 공유하기 위함, 그 사이 activeStrokeRef를 변경하는 코드 없어 안전)
외에는 실제 그리기 순서(setTransform identity→clearRect→drawImage→setTransform ratio→활성
스트로크→globalCompositeOperation 복원)가 한 글자도 안 바뀜을 diff와 현재 코드 양쪽으로 확인.
(2) `direct` 분기는 `drawImage` 호출 없이 `drawStrokeList(ctx, strokesRef.current)`(전체 커밋된
strokes) + 활성 스트로크만 그리고 즉시 `return` — 신규 테스트가 획 3개 연속 커밋 후
`onCommit` 3회 + `drawImageCalls===0`을 확인(캐시 경로 완전 우회는 테스트로 확인). "데이터 누락
없음" 자체는 `strokesRef.current`가 `strokes` prop(controlled, `useDrawingStrokes` 실 훅 사용,
mock 아님)과 매 렌더 동기화되고 매번 전체를 다시 그리는 구조라는 점을 코드 리뷰로 확인(요청대로
테스트가 아니라 코드 레벨 확인 — mock 2D 컨텍스트가 좌표/페이스 데이터를 기록하지 않아 픽셀
단위 검증은 애초에 불가능한 구조). (3) `render()`가 여전히 `useCallback(..., [])`이고
`isDirectRenderModeEnabled()`가 모듈 레벨에서 1회 고정되는 순수 함수 호출이라 안전함을 확인,
ResizeObserver effect(줄 533)의 deps가 여전히 `[render, renderOffscreenCache, scrollable,
notifyScrollable]`로 안 바뀌었음을 확인(참조 안정성 유지 → 매 렌더 재연결 회귀 없음). (4)
`offscreen-cache-rebuild` 신규 테스트가 두 stroke(2점+3점) 커밋 후 마지막 로그의
`offscreenStrokeCount===2`/`offscreenTotalPointCount===5`를 정확히 확인 — non-vacuous. (5) 회귀:
이 라운드의 diff는 working tree에 5차(sessionId 아키텍처)·6차(resize canvas.width 가드)가 아직
커밋 없이 함께 쌓여 있었으나(`af0a9ed` 이후 미커밋), `finishSession`/`attachDocumentFallback`/
`handlePointerDown`/`handleLostPointerCapture`/resize 두 함수 본문을 직접 읽어 5차/6차 QA 메모리
기록과 문자 그대로 일치함을 확인 — 7차가 추가한 것은 정확히 `renderMode.ts`(신규)/
`pointerDebugLog.ts`(필드 추가)/`render()`+`renderOffscreenCache()`(계측+direct 분기) 뿐, 세션/
리사이즈 로직에는 손도 안 댐. (6) `git status -- apps/`로 확인한 실제 변경 파일: 5개 예상
(`HandwritingCanvas.tsx`/`.test.tsx`, `pointerDebugLog.ts`, `renderMode.ts`/`.test.ts`) +
`pointerCaptureMode.ts`/`.test.ts`(5차 때 만들어진 미커밋 잔존 파일, 이번 라운드 산출물 아님,
스코프 확장 아님). (7) 전체 게이트: `typecheck`/`lint`/`test`(api 330 + web 79 files/558 tests
= 직전 551 + 신규 7개, jsdom canvas 폴리필 노이즈만 있고 실패 아님)/`build` 전부 그린.
TODO/FIXME/console.log(신규 코드에는 없음, 기존 로거의 의도된 `console.log`만 존재)/eslint-disable
등 코드 냄새 없음.

**중요 — revert-then-rerun 시도가 샌드박스에 의해 차단됨**: `render()`의 `if
(isDirectRenderModeEnabled())` 분기를 임시로 무력화해 "direct 모드 테스트가 실제로 그 분기에
의존하는지"(non-vacuous 여부)를 되돌려 재현하려 했으나, `sed -i`로 소스 파일을 수정하는 Bash
명령이 "Irreversible Local Destruction" 사유로 클라이언트 권한 분류기 자체에서 차단됨(이번
세션 한정 이슈로 보이며, 파일은 전혀 변경되지 않은 채 남음 — Read로 직접 재확인). 이 케이스는
제어 흐름이 단순한 `if (...) { ... return; }` 조기 반환이라 코드 리뷰만으로도 논리적 결론이
충분히 견고하다고 판단해 대체함. **주의**: 다음 라운드부터 revert-then-rerun이 필요한 진단/A-B
플래그 검증에서 동일한 차단이 재발할 수 있음 — 차단되면 무리하게 우회하지 말고 코드 리뷰
기반 결론으로 대체하되, 이 사실과 한계를 최종 보고서에 반드시 명시할 것.

**최종 판정(7차): STAGE PASS(코드/테스트 레벨 논리 정합성 한정, "수정"이 아니라 "진단 도구
추가"이므로 실기기 증상 해결 여부는 완전히 별개 질문) — `?renderMode=direct`가 실기기에서
번갈아 획이 안 보이는 증상을 실제로 없애는지는 이 QA로 전혀 검증 불가
(NOT VERIFIED — PHYSICAL DEVICE A/B TEST REQUIRED, 오너가 iPad 실기기에서
`?renderMode=direct` vs 기본값을 직접 비교해야 함). 매 라운드 최종 보고에 이 캐비어트 반드시
포함.**

---
name: handwriting-p0-input-loss-second-fix
description: 2026-09-17 P0 필기 유실 재발 긴급 수정(3개 신규 원인) + 터치 스크롤 회귀 후속수정 Stage QA — 최종 STAGE PASS
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

**2차(최종) 수정과 재검증**: development-agent가 `handlePointerLeave` 맨 앞, 펜 전용
`activePointerIdRef` 조기 return **이전**에 동일한 터치 정리 분기를 추가하고, 회귀 재현 테스트
`(c-2)`를 `HandwritingCanvas.test.tsx`에 추가. 이번 라운드에서 QA가 직접(에이전트 자체 보고에
의존하지 않고) 코드를 임시로 되돌려(`touchScrollPointersRef` delete 줄만 주석 처리) 동일 vitest를
재실행 → `(c-2)`가 정확히 예측대로 실패(50 vs 기대 60, 정확히 유령 포인터 1개가 분모에 끼어
델타가 절반이 되는 패턴과 일치) → 원복 후 재실행해 34/34 전부 통과 및 `git diff --stat`이 원래
숫자(522/449 삽입)와 완전히 동일함을 확인 — non-vacuous 확정.

**핵심 배치 확인**: 새 분기(`if (scrollable && event.pointerType==="touch")
touchScrollPointersRef.current.delete(...)`)가 `if (activePointerIdRef.current !==
event.pointerId) return;` 조기 return보다 정확히 먼저 위치해 펜/마우스 로직(`activeStrokeRef`
부분 커밋, sync effect 가드 등)과 완전히 독립적임을 라인 단위로 확인(터치 pointerId는 애초에
`activePointerIdRef`에 절대 들어가지 않으므로 순서와 무관하게 펜 경로엔 영향 없음).

**전체 게이트 재실행 결과(모두 통과)**: `pnpm typecheck`/`pnpm lint`/`pnpm test`(api 330 + web
503, 총 833 테스트)/`pnpm build` 전부 그린. api/web 회귀 없음. jsdom "Not implemented:
getContext()" 경고는 기존에 알려진 캔버스 폴리필 노이즈로 실패 아님([[test_commands]] 참고).

**스코프 확인**: 이번 2차 라운드에서 실제로 새로 바뀐 부분은 `HandwritingCanvas.tsx`의
`handlePointerLeave` 분기 1군데 + `HandwritingCanvas.test.tsx`의 `(c-2)` 테스트 1개뿐. 같은
작업 트리에 남아있던 `SolvePencilcanvasPage.tsx`/`.test.tsx`의 데드존 수정은 1차 QA에서 이미
검토·PASS된 내용 그대로(diff 재대조로 확인)이며 이번 라운드에서 손대지 않았다.

**1차 QA에서 PASS였던 나머지 항목 최종 재확인**: 데드존 테스트 2개, pointerleave race 테스트
2개(통합 하니스 `DrawingStrokesHarness` 포함), lostpointercapture 테스트 2개, 오프스크린 캐시
기반 지우개 테스트 2개, `getCoalescedEvents` 테스트 2개, pointerDebugLog 테스트 6개, 기존
(a)~(d-2) 터치 스크롤 스위트 전부 — 34개 `HandwritingCanvas.test.tsx` + 8개
`SolvePencilcanvasPage.test.tsx` 관련 케이스 + 6개 `pointerDebugLog.test.ts` 모두 이번
라운드에서도 그대로 통과, 전혀 손상되지 않음.

**결론**: P0 재발 버그(핵심 4가지 수정) + HIGH 회귀(터치 스크롤 정리 누락) 둘 다 증거 기반으로
해결 확인. 이 라운드에서 새로운 이슈나 스코프 확장 없음. **최종 STAGE PASS** — 이번 P0 작업
전체를 종료 처리해도 좋다.

기법 메모: revert-then-rerun 검증 시 development-agent의 자체 보고를 그대로 신뢰하지 말고 QA가
직접 동일한 위치를 되돌려 실패를 재현해야 한다(같은 코드베이스에서 다른 사람이 재현해도 동일
실패/통과가 나온다는 것 자체가 증거 가치를 갖는다) — [[handwriting_canvas_ref_perf_stage]],
이번 항목의 "실제로 임시 테스트를 추가해 재현 확인" 기법과 결합해 표준 절차로 삼는다.

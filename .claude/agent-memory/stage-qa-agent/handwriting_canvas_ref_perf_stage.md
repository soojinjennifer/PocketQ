---
name: handwriting-canvas-ref-perf-stage
description: iPad 필기 입력 누락+인식 속도 3단계 개선(recognition 병렬화/JPEG 압축/HandwritingCanvas ref 리팩터) QA 결과 및 race-condition 검증 기법
metadata:
  type: project
---

2026-09-16 STAGE PASS. 3단계: (1) `apps/api/.../recognition.router.ts`의 `saveProblem`+`countProblemsCreatedToday`
`Promise.all` 병렬화 + 구조화 계측 로그(`requestId`/authMs/uploadMs/openaiMs/usageLookupMs/persistenceMs/totalMs/
inputBytes/processedBytes, PII 없음 확인), (2) `exportStrokesToPngBlob.ts`→`exportStrokesToJpegBlob.ts` 리네임
+ 긴변 1600px 초과 시 축소 + quality 0.85 인코딩(bounding box 크롭 로직은 그대로), (3) `HandwritingCanvas.tsx`를
`pointermove`마다 React state 갱신하던 구조에서 `strokesRef`/`activeStrokeRef` 기반 zero-dependency `render()`
+ 제스처 종료(`pointerup`/`pointercancel`) 시 1회만 `onCommitStroke` 호출하는 구조로 전면 리팩터
(`useDrawingStrokes.ts`의 `startStroke`+`addPoint`→`commitStroke` 단일 API로 교체).

**검증 기법(재사용 가치 높음) — "커밋 직후 effect flush 전에 다음 stroke가 시작되면 포인트가 유실되는가"
레이스를 실제로 재현 테스트로 확인**: 진짜 `useDrawingStrokes`+`HandwritingCanvas`를 조합한 테스트 하네스를
만들고, stroke1의 pointerDown→pointerUp과 stroke2의 pointerDown→pointerMove→pointerUp을 전부 하나의
`act(() => { ...모든 fireEvent... })` 블록 안에 몰아넣어(중첩 act로 passive effect flush를 최대한 지연시키는
방식) 최악의 배치 시나리오를 시뮬레이션했다. 결과: stroke2가 정상적으로 보존됨(유실 재현 실패) — jsdom의
act() 자동 effect-flush 특성과 실제 브라우저의 MessageChannel 기반 passive effect 스케줄링(다음 물리적
pointerdown보다 항상 먼저 flush될 가능성이 높음) 둘 다를 근거로 "이론적으로는 가능하나 실질적으로
발생 가능성이 매우 낮다"고 판단해 LOW조차 아닌 것으로 결론. 이 테스트 파일은 `apps/web/src/features/
drawing-canvas/__qaRaceRepro.test.tsx`에 임시 작성 후 검증 즉시 삭제했다(저장소에 남기지 않음) — 앞으로
"제스처 완료 시 1회만 state 갱신" 패턴을 검수할 때 이 기법(한 act() 블록에 여러 fireEvent를 몰아넣어
effect flush를 지연시키는 방식)을 재사용할 것.

발견한 LOW findings(승인 안 막음): (a) `Promise.all` 병렬화로 "방금 인식한 문제가 오늘 카운트에 항상
포함된다"는 이전 순차 실행의 암묵적 보장이 사라져 두 HTTP 요청의 도착 순서에 의존하는 진짜 레이스 발생 —
단 프론트는 이 값을 정확한 카운트 표시가 아니라 `dailyUsageCount > dailyUsageLimit` 배너 트리거로만 쓰므로
경계값에서 최대 ±1회, 다음 호출에 자연 정정. (b) `processedBytes` 계측을 위해 `imageBuffer.toString("base64")`
전체 생성(길이만 필요한데) — 이번 단계의 "속도 개선" 취지에 미세히 역행하나 실질 지연 무시 가능.

[[solve_v2_work_order]]와 동일한 필기 캔버스(`HandwritingCanvas`) 컴포넌트를 다루는 stage라 그 메모리와
함께 참고할 것 — 특히 outer-resize-only ResizeObserver 회귀는 jsdom 폴리필이 no-op라 자동테스트 불가하다는
기존 pitfall이 이번 stage에도 동일하게 적용된다(이번엔 코드 리뷰로 render effect 의존성 배열이 안정화됐음만
확인, 실기기 재현은 NOT VERIFIED로 유지).

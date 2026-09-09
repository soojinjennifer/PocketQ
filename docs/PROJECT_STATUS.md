# 프로젝트 진행 상황 (세션 인계용)

이 문서는 Claude Code 세션을 새 창으로 재시작할 때 이전 세션 작업을 그대로 이어가기 위한 인계 문서다.
2026-08-16 기준. 새 세션에서는 이 문서를 먼저 읽고, 아래 "다음에 할 일"부터 이어간다.

## 0. 지금 이 문서를 쓰게 된 이유

`~/.claude/settings.json`에 승인 대기/질문 시 macOS 사운드 알림(`Notification` 훅, `osascript` + `afplay`)을 추가했는데, 오너에게 사운드가 실제로 들렸는지 여러 세션에 걸쳐 확인받지 못했다 — 계속 미확인 상태로 남아있음(중요도 낮음, 다음 세션에서 시간 나면 확인).

## 1. 프로젝트 개요

포켓큐(PocketQ) — iPad 중심 수학 개념 튜터 웹앱. 요구사항 최우선 기준 문서는 `docs/PRD_WHYMATH.md`.

- 프론트엔드: `apps/web` — React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + React Router 8 + Supabase Auth(anon key)
- 백엔드: `apps/api` — Express 5 + TypeScript, 이번 세션에 처음부터 새로 만듦(이전엔 완전히 빈 디렉터리였음)
- 공유 패키지: `packages/shared-types`(Provider 독립적 도메인 타입, 의존성 없음), `packages/validation`(zod 런타임 검증 스키마, `shared-types`에 단방향 의존)
- pnpm workspace, 루트 `package.json`은 `web`만 기본 스크립트로 연결(`api`/`packages/*`는 `pnpm -F <name> <script>`로 개별 실행)

## 2. Git 상태

최근 커밋(2026-09-09, Solve v2.0 UX 반복 개선+MyPage 일괄 액션+배포 준비 — 정확한 해시는 `git log`로 확인):
```
33215c5 Iterate Solve v2.0 UX from real-device feedback, ship MyPage bulk actions, and prep deployment   ← 이번 세션, §3.30~3.38 전체 반영
```
이전 커밋(2026-09-08, DIAG 결과 화면 사진 미리보기 완전 은닉):
```
1f8e6d4 Hide photo preview on Solve result screen regardless of input type   ← §3.29 전체 반영
```
이전 커밋(2026-09-08, WORK 캔버스 손가락 스크롤 + WORK 화면 버그 수정):
```
643a71b Add finger-scroll to the WORK canvas (PRD WORK-6)               ← §3.28 전체 반영
8db141b Fix RecognizedChip corner radius and ProblemCard leak in WORK stage  ← §3.27 전체 반영
```
이전 커밋(2026-09-08, 사진 인식 확인 팝업 + CAS 시그마 등식 후속 수정):
```
d6fd32f Add recognized-problem confirmation popup for photo input      ← §3.26 전체 반영
76e9d45 Fix CAS equivalence check for non-symbol equation sides         ← §3.24 후속 수정
```
이전 커밋(2026-09-07, work-order 6단계 캔버스 하이라이트 오버레이 + RESUME 버튼 색상 수정):
```
ed310a2 Add HandwritingHighlightOverlay for work-order step 6           ← §3.25 전체 반영
475329a Fix ResumeModeBar selected/unselected button colors per Figma
```
이전 커밋(2026-09-07, CAS 실제 서비스 Phase 1):
```
d4e7fd1 Build real CAS service (Phase 1) and wire into DIAG-1/RESUME-5   ← §3.24 전체 반영
```
이전 커밋(2026-09-07, Solve v2.0 WORK/DIAG 백엔드+흐름 단순화+RESUME 완성):
```
b8b45de Complete Solve v2.0 WORK/DIAG backend, flow simplification, and RESUME   ← §3.18~3.23 전체 반영
```
이전 커밋(2026-09-05, Solve v2.0 ActionBar/WORK·DIAG·RESUME 목업 UI):
```
8b5df7f Rebuild Solve ActionBar for v2.0 and add WORK/DIAG/RESUME mock UI   ← §3.16~3.17 참고
```
이전 커밋들(2026-08-10, 6단계 + 관련 버그 수정 이후 순서):
```
(6단계 프론트 문제 제출 연결 + CORS/HTTPS 인프라 수정 + 문서 갱신, 이 커밋들 직후)
320950b Fix parseSolveOutput truncating answers containing braces      ← 2026-08-09, 스모크 테스트로 발견한 버그 수정
ee4b1c4 Integrate root ESLint workspace and connect OpenAI adapter     ← 2026-08-09, 5단계 코드(오너 승인 후 커밋)
a49f1c7 Add Express API backend and shared-types/validation packages   ← 1~4단계 백엔드
46a103f Add handwriting canvas to solve screen, split /solve into pencilcanvas/landscape
edbec93 Add photo problem-input flow (solve/camera/camera preview)
```

**로컬 전용(gitignore, 다른 세션엔 없음) 상태**:
- `apps/api/.env`: `OPENAI_API_KEY`/`AI_PROVIDER=openai`/`AI_MODEL=gpt-5.6-terra`/`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`CORS_ORIGIN=http://localhost:5173,https://localhost:5173,https://172.30.1.69:5173`/`PORT=4000` 채워짐.
- `apps/web/.env`: `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_API_BASE_URL=https://172.30.1.69:4000`(LAN IP — iPad·Mac 브라우저 양쪽에서 접근 가능하게 하려고 `localhost` 대신 IP 사용, §3.6 참고).
- `apps/web/.cert/`, `apps/api/.cert/`: 오너가 iPad 카메라(getUserMedia) 테스트용으로 mkcert 발급(`localhost`/`127.0.0.1`/`172.30.1.69` SAN 포함), 두 앱이 동일 인증서 파일을 각자 복사해 보관. 개발 서버 재시작 시 이 파일이 있으면 자동으로 HTTPS로 뜬다(§3.6).

새 세션에서 이어갈 때 **먼저 `git status`/`git diff`로 실제 상태를 재확인**할 것 — 이 문서는 스냅샷일 뿐 진실의 원천이 아니다.

## 3. 완료된 작업 (전체 히스토리 요약)

### 3.1 프론트엔드 (커밋됨)
- Supabase 이메일/소셜 로그인, 회원가입, 학년 선택(`/grade-setup`), 라우트 가드(`ProtectedRoute`/`PublicOnlyRoute`)
- 사진 입력 흐름: `/camera` → `/camera/preview` → `/solve/pencilcanvas`(현재는 router state로 objectURL 전달 — **§6에서 설명하는 이유로 이 방식은 곧 교체 예정**)
- 필기 캔버스: `/solve/pencilcanvas`, `/solve/landscape` 2개 라우트(기존 단일 `/solve`에서 분리), `perfect-freehand` 기반 `HandwritingCanvas`, Pen Rail 펜/지우개/실행취소/전체지우기 동작 연결
- Figma 실측 기반 레이아웃(ActionBar/ProblemCard 배치, 캔버스 배경 텍스처, iOS 롱프레스 콜아웃 방지 등 다수 세부 수정)

### 3.2 백엔드 1~4단계 (커밋됨, `a49f1c7`)
- `packages/shared-types`: `Grade`, `SolveOptions`, `AiProvider`, `RecognizedProblem`, `Solution`, `ErrorCode`
- `packages/validation`: `recognizeRequestSchema`, `recognizeResponseSchema`, `solveRequestSchema`, (이번 세션에 `recognizedProblemSchema` 추가)
- `apps/api`: Express 앱 구조, `authenticate`(Supabase JWT 검증) 미들웨어, `validate-request` 미들웨어, `rate-limiter`(in-memory), `AppError`/`error-handler`, `POST /api/problems/recognize`·`POST /api/problems/:problemId/solve` 라우트, `LLMAdapter` interface, `FakeLLMAdapter`, in-memory 문제 저장소(`inMemoryProblemStore`, 서버 재시작 시 소실 — Supabase 저장 아님)

### 3.3 백엔드 5단계 — ESLint 통합 + OpenAI Adapter (커밋됨, `ee4b1c4`)
- 루트 ESLint 통합: `eslint@10.8.0`/`typescript-eslint@8.63.0`을 루트 devDependencies로 1회만 설치, 루트 `eslint.config.js`가 `apps/api/src`·`packages/*/src`를 검사(`apps/web`은 기존 자체 설정 그대로 유지, 회귀 없음 확인됨). `pnpm -F {web,api,shared-types,validation} lint` 4개 전부 통과.
- `openai@7.4.0` 설치, `apps/api/src/infrastructure/ai/openai-adapter.ts` 신규 — **OpenAI Responses API**(`client.responses.create`) 사용, `recognizeProblem`은 Structured Outputs(`text.format:{type:"json_schema"}`)로 강제 후 `recognizedProblemSchema`로 재검증, `solve`는 `stream:true`로 텍스트 델타를 SSE로 실시간 전달하고 스트림 종료 후 `parseSolveOutput.ts`(신규)가 마크다운 헤더(`## 관련 개념`/`## 풀이`/`## 최종 답` + 말미 `concept_tags` JSON)를 파싱해 구조화된 `Solution`으로 변환.
- `openai` SDK import는 `openai-adapter.ts` 한 파일로 제한(다른 파일은 `LLMAdapter`/`shared-types`만 참조).
- `createAdapter("openai", model)`이 실제 `OpenAIAdapter`를 반환(이전엔 스텁). `OPENAI_API_KEY`/`AI_MODEL`이 비어있으면 생성 시점에 즉시 에러(조용히 fake로 대체 안 함). `resolveAdapter()`는 `AI_PROVIDER` 미설정 시에만 `FakeLLMAdapter`로 폴백.
- 라우터(`recognition.router.ts`/`solutions.router.ts`)를 `createXxxRouter(adapter: LLMAdapter = resolveAdapter())` 팩토리로 리팩터링해 테스트가 `FakeLLMAdapter`를 명시적으로 주입하도록 변경(실제 `AI_PROVIDER` 환경변수·네트워크와 완전히 무관하게 결정적으로 동작).
- **오너 확정 모델명**: `AI_MODEL=gpt-5.6-terra`(코드에 하드코딩 안 함, `.env`로만 주입). 이유: 이미지 입력+스트리밍+Structured Outputs 지원, MVP 인식/풀이 품질과 비용 균형.
- 게이트 전체 통과: `shared-types`/`validation`/`api`(lint/typecheck/test 34개/build) + `web`(lint/typecheck/test 96개/build, 전부 영향 없음 재확인).
- 테스트가 실제 API를 호출하지 않음을 명시적으로 확인(`OPENAI_API_KEY` 미설정 상태 + 빈 값 강제 상태 둘 다에서 전체 테스트 통과, `openai` 패키지 자체를 mock).

### 3.4 백엔드 5단계 — 라이브 스모크 테스트 + 버그 수정 (2026-08-09, 커밋됨 `320950b`)
- `apps/api/.env`에 오너가 직접 실제 `OPENAI_API_KEY` 입력(채팅에는 절대 노출 안 시킴). `AI_PROVIDER=openai`, `AI_MODEL=gpt-5.6-terra` 사전 채움.
- 임시 스크립트(`OpenAIAdapter`를 Express 없이 직접 호출)로 합성한 이차방정식(`x^2-5x+6=0`) 이미지를 넣어 `recognizeProblem` → `solve` 스트리밍까지 실제 API로 end-to-end 검증. 테스트 후 스크립트는 삭제(일회성 진단용).
- **발견한 버그**: `parseSolveOutput.ts`의 concept_tags 추출 정규식(`/\{[\s\S]*"concept_tags"[\s\S]*\}\s*$/`)이 텍스트 맨 처음 나오는 `{`부터 그리디하게 매칭 — 최종 답이 `\boxed{x=2,\ 3}`처럼 중괄호를 포함하면 그 `{`에 먼저 걸려서 `answerMd`가 잘리고, `match[0]`이 깨진 문자열이 되어 `JSON.parse`가 실패해 `conceptTags`가 빈 배열로 폴백됨. 기존 유닛테스트는 답에 중괄호가 없는 케이스만 다뤄서 못 잡았음.
- **수정**: `fullText.lastIndexOf('{"concept_tags"')`로 프롬프트가 지시한 정확한 마커의 **마지막 등장 위치**를 찾는 방식으로 교체(`apps/api/src/infrastructure/ai/parseSolveOutput.ts`). 회귀 테스트 추가(`\boxed{}` 포함 케이스), 게이트(typecheck/lint/test 35개/build) 재통과 확인, 수정본으로 스모크 테스트 재실행해 `answerMd`/`conceptTags` 정상 파싱 재확인 완료.
- 남은 것: 이 1회 수동 스모크 테스트 외에 **반복 가능한 라이브 통합 테스트는 아직 없음**(8단계 통합 테스트 범위로 남겨둠). `.env`는 로컬 전용이라 다른 세션/CI에서는 재현되지 않음에 유의.

### 3.5 6단계 — 프론트 문제 제출 연결 (2026-08-10, 커밋됨)

plan-agent(구조 분석) → development-agent(구현) → design-agent(Figma 사후검수, 배경 텍스처 불일치 발견·수정) 순서로 진행. §4의 결정사항 그대로 구현됨.

- **`ProblemInputProvider`** 신설(`apps/web/src/features/problem-input/`) — `/camera`·`/camera/preview`·`/solve/pencilcanvas`·`/solve/landscape` 4개 라우트를 감싸는 route-scoped Provider(`app/routes.tsx`가 부모 레이아웃 라우트로 재구성됨, `app/ProblemInputRoute.tsx`가 `useAuth`+`getUserGrade`로 학년을 조회해 Provider에 주입). 사진 Blob과 필기 획을 메모리로만 보존.
- **필기 유실 버그(P0, §4-9) 근본 수정 완료**: `useDrawingStrokes()` 호출권을 `ProblemInputProvider` 하나로 통합, pencilcanvas↔landscape 이동 시 획 유지되는 회귀 테스트(`app/problemInputFlow.test.tsx`) 추가.
- **"풀기" 버튼 영구 비활성화 버그 수정**(세션 중 신규 발견): `hasProblem` 판정을 `location.state` 의존(`useCapturedImageUrl.ts`, 제거됨)에서 Provider 기반("사진 또는 필기 존재")으로 교체. `ActionBar`도 controlled 컴포넌트로 전환해 옵션 선택 상태(`selectedOptionIds`)가 페이지 전환에도 유지됨. 새로고침/딥링크로 필기 화면에 직접 진입 시 `/camera`로 리다이렉트(`RequireProblemInputGuard`).
- **카메라 Blob 소유권**: `CameraSessionProvider`/`useCameraSession` 제거, `ProblemInputProvider`로 완전 흡수(이중 보관 없음). `CameraPreviewGuard`는 `features/camera`→`features/problem-input`으로 이동(feature 간 직접 참조 금지 규칙 때문 — plan 원문과 다른 판단, 오너 사후 확인 불필요한 수준의 구현 디테일).
- **캔버스 유틸 이관**: `strokeToPath`/`useDrawingStrokes`를 `features/drawing-canvas/`→`shared/lib/canvas/`로 이동(+`exportStrokesToPngBlob.ts` 신규 — Figma 텍스처 미포함, 불투명 흰 배경+실제 획만 PNG export).
- **`shared/api` HTTP/SSE 클라이언트** 신규(`httpClient.ts`/`parseSse.ts`/`recognizeProblem.ts`/`solveProblem.ts`) + 오케스트레이션 훅(`features/problem-recognition/useRecognizeProblem.ts`, `features/ai-solution/useSolveStream.ts`). recognize→solve 2단계 흐름, `packages/shared-types`/`packages/validation`을 `apps/web` 의존성으로 추가해 타입 공유(중복 선언 없음).
- **범위 확정**: "풀기" 클릭 → recognize+solve 호출 → 로딩/스트리밍 텍스트/에러 **최소 표시**까지만. 개념/풀이/답 정식 UI(Result Panel, 마크다운+KaTeX)는 Figma에 아직 컴포넌트가 없어(`docs/COMPONENT_MAP.md`) 다음 단계로 분리(오너 승인됨).
- **에러 표시**: 처음엔 인라인 텍스트였다가, 오너 요청으로 로그인/회원가입과 동일한 공용 `shared/ui/modal/Modal.tsx`(`icon="error"`)로 교체. design-agent 검수로 타이틀 어투("해요체"→"습니다체" 통일)와 Modal 자체의 접근성(`role="dialog"`/`aria-modal`, 에러 시 `role="alertdialog"`+`aria-live="assertive"`, 마운트 시 포커스 이동)까지 보강.
  - **알아둘 것**: `icon="error"` variant는 Figma에 대응 컴포넌트가 없다(예전 커밋에서 임의 추가, 이번이 첫 실사용). 오너 확인 후 "일단 유지, Figma에 정식 error/warning 팝업 생기면 교체"로 결정, `docs/COMPONENT_MAP.md`에 문서화해둠.
- **design-agent가 찾아서 고친 것**: `SolveLandscapePage.tsx`가 Pencilcanvas용 도트 텍스처(`bg-canvas-texture`, `#f5f2ed`)를 잘못 상속하고 있었음 — Figma 실측 결과 Landscape는 텍스처 없는 flat `#fbfaf6`(`bg-bg-canvas`)이 정답. 오너가 최초에 지적했던 "배경이 Figma와 달라 보인다"는 문제가 바로 이것이었음(수정 완료, 재검수 통과).
- **아직 미해결로 남겨둔 사소한 항목** (버그 아님, 우선순위 낮음): `ProblemCard`의 `recognitionFailed` 인라인 상태가 이번 Modal 방식과 중복 개념으로 공존(§7 결정 필요였던 것, 미정리); 스트리밍 도중 에러 종료 시 Modal 반투명 배경 뒤로 잔여 텍스트가 잠깐 비침(기능 문제 아님, 시각적 잡음 수준).
- 게이트(typecheck/lint/test 127개/build) 통과, 독립 재검증 완료.

### 3.6 로컬 개발 인프라 버그 3종 수정 (2026-08-10, 6단계 직후 실사용 중 발견, 커밋됨)

오너가 필기로 실제 제출을 테스트하다가 연쇄적으로 발견됨. 전부 로컬 개발 환경 설정 문제이고 프로덕션 로직 버그는 아니었음.

1. **CORS_ORIGIN 빈 문자열 버그** (`apps/api/src/config/env.ts`): `process.env["CORS_ORIGIN"] ?? "http://localhost:5173"`가 `??`라서 빈 문자열(`.env`의 `CORS_ORIGIN=`)을 대체하지 못하고 그대로 통과 → 허용 오리진이 `[""]`가 되어 **모든 origin의 요청이 CORS에서 막힘**. `readNumber`와 동일한 `undefined || ""` 명시 처리 패턴으로 수정, 회귀 테스트(`env.test.ts`) 추가.
2. **Mixed Content(HTTPS 프론트 → HTTP API)**: 오너가 iPad 카메라 테스트용으로 프론트를 mkcert HTTPS로 띄우면서 API(HTTP)를 호출하는 fetch가 브라우저에 차단됨. `apps/api/src/server.ts`가 `apps/web/vite.config.ts`와 동일한 패턴(인증서 있으면 HTTPS, 없으면 HTTP 폴백)으로 HTTPS를 지원하도록 수정, 인증서는 `apps/api/.cert/`에 복사.
3. **iPad(LAN) 접속 불가 2건**: (a) 개발 서버 재시작 과정에서 `vite.config.ts`에 `server.host: true`가 없어 LAN 노출이 빠짐 → 추가. (b) `VITE_API_BASE_URL=https://localhost:4000`은 iPad 기준 "localhost"가 iPad 자신을 가리켜 API 호출이 실패 → LAN IP(`https://172.30.1.69:4000`)로 변경, `CORS_ORIGIN`에도 `https://172.30.1.69:5173` 추가. Mac 브라우저도 이 IP로 문제없이 접근됨을 curl로 확인.

**주의**: 이 인프라(HTTPS/LAN IP)는 오너 로컬 환경(mkcert, 특정 LAN IP `172.30.1.69`)에 종속적이다. 다른 개발자/CI 환경에서는 인증서 파일이 없으므로 자동으로 평범한 HTTP로 폴백되고, `VITE_API_BASE_URL`/`CORS_ORIGIN`도 각자 `.env`에서 `localhost` 기준으로 설정하면 된다(`.env.example`은 그대로 `localhost` 기준 안내로 유지).

### 3.7 6단계 마무리 — Result Panel 정식 Figma UI + 리사이즈 + 스트리밍 폴리싱 (2026-08-14~15, 미커밋)

§3.5에서 "최소 결과 표시"로 남겨뒀던 부분을 정식 Figma UI로 교체. plan-agent → design-agent(Figma `39:28~39:65`, `174:*` 컴포넌트 갤러리 실측) → development-agent(구현) → design-agent(사후검수) 사이클을 여러 라운드 반복.

- **정식 Result Panel 구현**: `RecognizedProblemBar`, `ResultCard`(concept/steps 2 variant), `AnswerBox`, 공용 `Badge`(pill/chip/tag/footnote/outline 5개 size, tint-blue/tint-green/outline 3개 variant) 신규. KaTeX(`katex` 패키지 신규 설치, `shared/lib/katex/renderMathText.tsx`) — 실제 라이브 OpenAI 응답이 `\( \)`/`\[ \]` 구분자를 쓰는 것을 확인하고 그 형식에 맞춤, 변환 실패 시 원문 폴백.
- **레이아웃 대전환**: 처음엔 ProblemCard와 같은 좌측 컬럼에 이어붙이는 방식이었다가 → design-agent가 Figma를 재실측해 "우측 420px 독립 도킹 패널"이 원안임을 확인 → 다시 실사용 중 "ProblemCard/ActionBar가 계속 왼쪽으로 밀려 있다" 지적 받고 재실측한 결과 Figma 자체가 **겹침을 z-index로 해결하는 구조**(예약 공간 없음)임을 확인 → 최종적으로 ProblemCard/ActionBar는 화면 전체 폭 기준 정상 중앙정렬, `ResultPanelShell`이 `z-20`으로 그 위에 얹혀 필요하면 겹치는 방식으로 정착(`SolveLandscapePage.tsx`).
- **로딩↔완료 상태 통합**: 로딩 박스와 완료 후 Result Panel이 서로 다른 위치/스타일에 각각 마운트되어 "다른 곳에서 갑자기 나타난다"는 지적을 받고, `ResultPanelShell`(신규) 하나가 항상 같은 DOM으로 유지되며 내부 콘텐츠만 전환되도록 재구성(마운트 애니메이션 `result-panel-slide-in`이 최초 1회만 재생). 스트리밍 중에도 `parseStreamingSolve.ts`(신규, 백엔드 `parseSolveOutput.ts`와 동일한 헤더 분리 로직을 프론트에 이식)로 raw 텍스트를 실시간 파싱해서 완료 후와 **같은** `ResultCard`/`AnswerBox` 컴포넌트에 채워 넣어 "깜빡이며 바뀌는" 느낌 제거.
- **3단계 리사이즈 패널**(`Width=Default/Extend/Close`, Figma 컴포넌트 갤러리 `174:639`에서 발견 — 메인 화면이 아니라 별도 갤러리 프레임에 있었음): `ResultPanelResizeHandle`(신규, 좌측 24×88px 유리 탭 + 아이콘 버튼 2개) — Default(420px)/Extend(748px)/Close(24px, 콘텐츠 숨김) 3단계, 상태별 아이콘 전환 규칙까지 오너 확인 후 구현. `docs/COMPONENT_MAP.md`에 등록.
- **iPad 실사용 중 발견해 함께 고친 버그들**: Badge `footnote` size의 line-height 결함(16px→18px), 후속 질문 답변 버블이 Extend 모드에서 `max-w-85%` 때문에 다른 카드처럼 안 넓어지는 문제(→ AI 답변은 ResultCard처럼 폭 꽉 채움으로 통일), Result Panel 터치 시 페이지가 출렁이는 문제(iOS 오버스크롤 바운스 — `global.css`에 `overscroll-behavior:none` 전역 추가, `HandwritingCanvas`에 `onPointerCancel` 누락도 함께 수정), 로그인/회원가입/전체 팝업의 브라우저 기본 포커스 링 노출(Modal 자동포커스에 스타일 누락 — `Modal`/`Button` 공용 컴포넌트에 `focus-visible:ring` 추가).
- 게이트(typecheck/lint/test/build) 매 라운드 독립 재검증 완료. **미커밋** — §2 참고.

### 3.8 로컬 개발 인프라 — LAN IP 변경 대응 (2026-08-14, 미커밋)

오너 기기의 LAN IP가 세션 도중 `172.30.1.69`→`172.30.1.74`로 바뀌면서(DHCP 재할당 추정) "문제를 인식하지 못했다"는 무한 로딩이 재발. 원인은 IP 불일치로 `fetch`가 응답 없는 호스트에 무한 대기(즉시 실패가 아니라 TCP 타임아웃까지 대기)한 것.
- `apps/web/.env`/`apps/api/.env`의 `VITE_API_BASE_URL`/`CORS_ORIGIN`을 새 IP로 갱신.
- 재발 방지: `apps/web/src/shared/api/httpClient.ts`에 `createTimeoutSignal()`(30초, `AbortSignal.timeout`) 추가 — non-streaming 요청(`recognize`)에만 적용, `solve`(SSE)는 정상적으로 오래 걸릴 수 있어 제외.
- mkcert 인증서도 옛 IP만 SAN에 포함하고 있어 재발급(`mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 172.30.1.74`), `apps/web/.cert`/`apps/api/.cert` 양쪽에 반영.
- **IP는 네트워크 환경에 따라 또 바뀔 수 있다** — 다음 세션에서 다시 "연결할 수 없음"이 뜨면 가장 먼저 `ifconfig`/`ipconfig getifaddr en0`로 현재 IP를 확인하고 위 3곳(`.env` 2개 + mkcert 인증서)을 맞춰야 한다.

**2026-09-05 재발**: 오너가 iPad로 Solve v2.0 4b를 테스트하던 중 "문제 인식하기"를 눌러도 매번 "문제를 인식하지 못했습니다" 팝업이 뜨는 문제 보고. 원인 재확인 결과 mkcert 인증서 SAN이 `172.30.1.84`(이전 세션 중 한 번 더 바뀌었던 IP로 추정, §3.8 최초 기록의 `.74`도 아님)로 발급돼 있었는데 `.env`의 실제 LAN IP는 `172.30.1.69`였다 — 웹 페이지(5173) 자체는 접속됐지만(사용자가 인증서 경고를 수동으로 넘김), 페이지 내부에서 API(4000)로 보내는 백그라운드 `fetch`는 인증서 SAN 불일치로 브라우저가 사용자 개입 없이 조용히 차단해 매번 네트워크 에러 → "인식 실패" 팝업으로 이어졌다("연결할 수 없음" 같은 명시적 에러가 아니라 정상적인 실패 팝업처럼 보여 진단이 더 어려웠다). `ifconfig`로 현재 IP(`172.30.1.69`) 재확인 후 `mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 172.30.1.69`로 재발급, `apps/web/.cert`/`apps/api/.cert` 양쪽에 반영, 두 dev 서버 재시작, `openssl s_client`로 API 서버가 새 인증서(SAN에 `.69` 포함)를 실제로 제공하는지 확인 완료. **교훈**: 이 부류의 실패는 "네트워크 연결 안 됨"이 아니라 "정상적인 것처럼 보이는 기능 실패 팝업"으로 나타날 수 있어 사용자 보고만으로는 코드 버그와 구분이 안 된다 — iPad/LAN 테스트에서 원인 불명의 API 실패가 보고되면 애플리케이션 코드보다 먼저 `openssl x509 -in apps/api/.cert/cert.pem -noout -text | grep -A2 "Subject Alternative Name"`로 인증서 SAN과 현재 `ifconfig` IP가 일치하는지부터 확인할 것.

### 3.9 6.5단계 — 후속 질문(채팅) Footer 연결, 백엔드+프론트 신규 구현 (2026-08-16, 미커밋)

PRD `docs/PRD_WHYMATH.md` §4.5에 CHAT-5~10을 보완(작업트리에 초안이 이미 있었음, 검토 후 오너 승인 — **아직 PRD 파일 자체는 커밋 안 됨**, CHAT-3는 기존 "개념 우선/답 유보" 뉘앙스에서 "직접 답변 우선, 회피 금지"로 정책이 실질적으로 바뀐 것을 오너가 인지하고 승인). plan-agent(코드 조사) → design-agent(Figma Footer 실측) → 오너 승인 → development-agent(6.5B 백엔드) → **라이브 OpenAI 스모크 테스트로 실동작 검증**(멀티턴 대화 맥락 유지 확인) → development-agent(6.5A 프론트) 순서로 진행.

**6.5B 백엔드(신규, 이전엔 타입 선언조차 없었음)**:
- `POST /api/problems/:problemId/chat` 신설(`apps/api/src/modules/chat/`) — 일반 JSON 완료 응답(SSE 아님, PRD가 스트리밍은 P1로 명시).
- `ChatMessage`(`packages/shared-types`), `chatRequestSchema`(`question.trim().min(1).max(2000)`, `packages/validation`) 신규.
- `LLMAdapter.chat()` 신규 — Fake/OpenAI 어댑터 둘 다 구현. 시스템 프롬프트(`buildChatPrompt`)는 CHAT-3 정책 반영.
- `inMemoryProblemStore`를 확장해서 solve 완료 시(`done` 이벤트) `Solution`도 함께 저장(이전엔 `RecognizedProblem`만 저장) — chat 요청이 `problemId`만으로 문제+최초풀이 컨텍스트를 서버에서 복원할 수 있게 함. **대화 이력은 서버에 저장하지 않는 stateless 설계** — 매 요청마다 프론트가 전체 `history` 배열을 함께 보낸다(Supabase 저장은 7단계 범위, 이번엔 제외).

**6.5A 프론트(신규)**:
- `problemId`를 `ProblemInputContext`에 신규 노출(이전엔 훅 내부에만 있어서 chat 요청 자체가 불가능했음 — 선행 필수 작업이었음).
- `apps/web/src/features/follow-up-chat/`(신규): `ChatFooter`(입력창+전송버튼+해시태그pill), `SuggestionPill`(Body 소속, Footer 아님 — Figma 실측으로 정정), `ChatBubble`(**Figma에 대화 진행 상태 프레임이 없어 임시로 구현** — 기존 토큰만 재사용, `docs/COMPONENT_MAP.md`에 "Figma 확정 시 교체 필요"로 문서화), `useChatMessages`(대화 상태 훅, 빈질문/중복제출 차단, 실패 시 입력값 유지).
- 새 문제 제출 시작 시점(`submitProblem()` 맨 앞)에 `resetChat()` 호출 — recognize 로딩 중에는 `solveStatus`/`solveResult`가 아직 이전 문제 값이라 `isResultReady`가 계속 true로 남아 이전 결과+채팅이 잠깐 보일 수 있는 타이밍 갭을 세션 중 직접 발견해서 수정.
- 게이트(typecheck/lint/test/build) 통과, design-agent 사후검수(제안pill/해시태그pill/입력창/전송버튼 Figma 픽셀 대조 — line-height 결함 1건 발견 즉시 수정).

### 3.10 "Initial" 로딩 마크 (2026-08-16, 미커밋)

Claude 자체 채팅 UI처럼, 첫 풀이 로딩과 후속 질문 응답 대기 중 브랜드 마크("M", Figma node `190:866`, "Initial" 컴포넌트)를 펄스 애니메이션으로 띄우도록 요청받음. Figma에서 정확한 노드를 찾는 데 두 차례 시행착오(처음엔 `docs/FIGMA_SCREEN_MAP.md`의 예시 URL에 우연히 박혀있던 무관한 노드를 잘못 짚음 → 오너가 스크린샷+정확한 node-id 재전달 → 재확인).
- 에셋은 Figma가 준 raw 이미지의 crop 좌표를 역산하는 대신, 배경이 baked-in된 정확한 렌더(`export_node.png`)에서 균일한 배경색(`#f5f5f5`)만 픽셀 단위로 chroma-key 제거해 투명 PNG 직접 생성(현재 경로: `apps/web/src/assets/logo/PocketQInitial.png` — 2026-08-23 리브랜딩으로 Figma "Q" 마스코트 에셋으로 교체되며 파일명 변경) — 이 방식은 제가 직접 처리(Python/PIL), 별도 서브에이전트 없이.
- `apps/web/src/shared/ui/loading-mark/LoadingMark.tsx` 신규 — 펄스 애니메이션(opacity 0.4~1.0/scale 0.92~1.0/1.4초, Figma에 모션 스펙 없어 임시값)은 `global.css`의 `@keyframes loading-mark-pulse`. 기존 `Spinner`는 그대로 두고(다른 화면에서 계속 쓰임) 첫 풀이 로딩·후속 질문 로딩 두 자리만 `LoadingMark`로 교체.

### 3.11 6.5단계 완료 조건 재검증 + 후속 버그 수정 (2026-08-16, 미커밋)

오너가 완료 조건 13개를 나열하며 실제 충족 여부를 요청 → 코드로 하나씩 대조.
- **자동 스크롤 부재**: 제안pill 클릭으로 새 질문/로딩이 추가돼도 스크롤이 안 내려가 화면 밖에 있던 문제 — `SolveLandscapePage.tsx`에 `chatEndRef` 스크롤 앵커 패턴 추가(`ResultPanel`/`ResultPanelShell`은 이 로직을 몰라도 됨).
- **해시태그(주제) pill 클릭 안 됨**: `ChatFooter`가 순수 `Badge`(비클릭)로만 렌더링하고 있었음 — design-agent가 Figma를 재조사해 이 pill이 컴포넌트도 variant도 아닌 정적 프레임(선택 상태 정의 없음, 마이페이지의 진짜 "Filter Pill"과는 별개)임을 확인 → 오너가 "제안pill과 동일하게 입력창 채우기"로 UX 확정 → `onHashtagClick` 연결.
- **iPad 키보드 회피 미구현**(6.5단계 완료 조건 13개 중 유일하게 미충족이었던 항목): `useKeyboardInset.ts`(신규, `window.visualViewport` 기반, 미지원 환경 0 반환) — `ResultPanelShell`의 `bottom` 오프셋에 키보드가 가린 높이만큼 인라인 스타일로 추가. Split View는 기존 `ViewportGuard`(1024px 미만 차단, 안 건드림)+기존 `flex-wrap`(pill 행)으로 이미 충족되는 것으로 판단.
  - **중요**: 이 작업을 지시한 development-agent 실행이 "컴퓨터가 절전 모드로 전환"되며 중간에 끊겼다(응답 잘림, 최종 보고서 못 받음). 실제 코드 변경분은 살아있고 게이트도 통과했지만, 누락된 단위 테스트(`useKeyboardInset.test.ts`)와 stale JSDoc 주석은 제가 직접 마무리함. **실제 iPad Safari에서의 키보드 열림/닫힘/회전 동작은 검증 못 함**(코드+자동테스트로만 확인) — 다음 세션에서 실기기 확인 필요.

### 3.12 Problem DB Stage 1 — 참고자료 → 교육과정 지도 데이터 기반 (2026-08-25, 미커밋)

기존 `problems`/`solutions`/`chat_messages`(7단계 영구 저장)와 완전히 분리된 신규 도메인. **이번 단계는 백엔드/DB 작업으로 명시적으로 승인된 예외**이며, 실제 수학 문제는 만들지 않았다(순수 스키마+교육과정 지도 데이터만).

- **신규 테이블 3개**(`supabase/migrations/20260825000000_problem_db_stage1.sql`, 기존 마이그레이션·테이블 무변경, `create table if not exists`로 재실행 안전): `reference_sources`(참고자료 메타 — 라이선스 검증 여부/사용 등급, `license_verified=false`면 `usage_mode='PRODUCTION_ALLOWED'` 될 수 없다는 안전 불변식을 DB CHECK로 물리적 차단), `curriculum_nodes`(SUBJECT/UNIT/SUBUNIT/CONCEPT/SKILL 트리, self-FK로 parent 연결), `curriculum_prerequisites`(선수관계, required/recommended/optional 3단계, 자기참조 CHECK로 차단). 세 테이블 모두 RLS만 켜고 정책 없음(service role 전용, API 경유만 허용). **오너가 Supabase 대시보드에서 직접 실행해야 실제로 반영됨**(아직 미실행).
- **JSON 소스오브트루스 2개**(`data/math-curriculum/{algebra,calculus1}.v1.json`): 대수(`ALG`, UNIT 3개: 지수함수와 로그함수/삼각함수/수열)·미적분Ⅰ(`CALC1`, UNIT 3개: 함수의 극한과 연속/미분/적분) 각각 UNIT당 SUBUNIT 1~2개 + 그중 하나에 CONCEPT 1개의 최소 예시만 채움(대량 SKILL 생성 안 함). 정확한 SUBUNIT/CONCEPT 이름은 국가 교육과정 기준 상식으로 채운 것이라 **오너 검토·조정 필요**. 선수관계 예시 4건(대수 2, 미적분Ⅰ 2) 포함.
- **참고자료 1건**(`data/references/mathjk/{source.json,README.md}`): MathJK 블로그 PDF 모음(`https://mathjk.tistory.com/3584`), `sourceType="blog_pdf_collection"`, `subject=["ALG","CALC1"]`, **`licenseVerified=false`/`usageMode="REFERENCE_ONLY"`로 고정**(CC BY 4.0 표시는 있으나 개별 PDF 원저작권 미검증). README에 금지 용도(문제 텍스트 복사/경미한 변형/미검증 다이어그램 재현/PDF 직접 노출/AI 파인튜닝) 명시. PDF 파일 자체는 로컬에 없음(`.gitignore`에 `data/references/**/*.pdf` 추가).
- **파이프라인**(`apps/api/src/infrastructure/curriculum/`): `curriculumSourceSchema.ts`/`referenceSourceSchema.ts`(zod, 안전 불변식 이중 검증) → `validateCurriculumGraph.ts`(순수 함수, 중복 code/부모 누락/orphan/계층 순서 위반/과목 경계 불일치/선수관계 자기참조·중복·미정의 참조·순환(DFS) 등 검사) → `loadCurriculumSource.ts`(저장소 루트 기준 JSON 로드+스키마+그래프 검증) → `curriculumRepository.ts`(`problemRepository.ts`와 동일한 팩토리+지연초기화 패턴, 노드 2-패스 upsert로 부모 FK 문제 회피, 단 실패 시 삼키지 않고 throw — 관리용 CLI라 problemRepository와 반대 원칙) → `cli/{import-curriculum.ts,validate-curriculum.ts}`(각각 `pnpm -F api db:import-curriculum`/`db:validate-curriculum`). `import-curriculum`은 검증 실패 시 DB에 아무것도 쓰지 않고 중단, `delete` 문 없음, `usageMode`/`licenseVerified` 승격 로직 없음(JSON 값 그대로 passthrough). `db:validate-curriculum` 실행 결과 현재 `Errors: 0, Warnings: 0, PASS`(Units 3/Subunits 6/Concepts 3/Skills 0 각 과목, Reference Sources Total 1/Verified 0/Reference Only 1/Production Allowed 0).
- **범위 밖으로 명시적으로 남겨둔 것**: `ProblemDB/`(AI-Hub 데이터셋) 처리, 원격 Supabase에 마이그레이션 자동 적용, 임베딩/파인튜닝/실제 문제 생성 관련 코드 — 전부 이번 Stage 1에서 만들지 않음.
- 게이트(루트 typecheck/lint/test/build 전체 워크스페이스) 통과 확인(api 115개/web 334개 테스트, 기존 테스트 회귀 없음).

### 3.13 Problem DB Stage 2 — 파일럿 참고자료 분석 & 문제 패밀리 후보 추출 (2026-08-26, 미커밋)

Stage 1 위에 쌓는 신규 도메인. **이번 단계도 백엔드/DB 작업으로 명시적으로 승인된 예외**다. 가장 중요한 정책 제약: **저작권 미검증 MathJK PDF의 페이지 이미지나 문제 원문을 OpenAI/Anthropic 등 외부 AI API로 전송하지 않는다** — PDF 텍스트 추출/문항 경계 탐지는 로컬 `pdfjs-dist`(순정 정규식/구조 휴리스틱)로만 수행했고, `apps/api/src/infrastructure/ai/`의 `LLMAdapter`는 이 파이프라인 어디에서도 import하지 않는다. 세밀한 수학적 판단(개념명/추론 패턴 등)이 필요한 피처 데이터는 제가 로컬로 추출된 페이지 텍스트를 직접 읽고 수동으로 큐레이션했다(로컬 파일 읽기일 뿐, 외부 전송 아님).

- **신규 테이블 3개**(`supabase/migrations/20260826000000_problem_db_stage2.sql`, Stage 1 3개 테이블·기존 `problems`/`solutions`/`chat_messages` 전부 무변경, `create table if not exists`로 재실행 안전): `reference_documents`(참고 PDF 파일 메타 — sha256 해시/페이지 수/파서 버전, `license_status='VERIFIED'`가 아니면 `usage_mode='PRODUCTION_ALLOWED'` 불가라는 안전 불변식 DB CHECK), `reference_item_features`(문항 단위 **추상화된** 특징만 — 개념/추론 패턴/난이도 추정 등, `primary_concept`/`common_trap_candidate` 200자 제한으로 원문 발췌 물리적 방어), `problem_family_candidates`(추론 구조가 같은 문항들을 묶은 "패밀리" 후보, `status`는 CANDIDATE/REVIEW_REQUIRED/REJECTED 3개뿐 — production-approved 상태 없음). 세 테이블 모두 RLS만 켜고 정책 없음(service role 전용). **문항 원문 전체를 담는 컬럼은 세 테이블 어디에도 없음**(최종 확인 완료). **오너가 Supabase 대시보드에서 직접 실행해야 실제로 반영됨**(아직 미실행).
- **신규 의존성**: `pdfjs-dist@6.2.108`(`apps/api`, 페이지 텍스트/페이지 수 추출 전용, canvas/렌더링 관련 패키지 없음 — 경로 B 채택으로 페이지 렌더링 자체가 불필요).
- **파이프라인**(`apps/api/src/infrastructure/referenceAnalysis/`, Stage 1 `curriculum/`과 형제 디렉터리): `referenceDocumentSchema.ts`/`referenceItemFeatureSchema.ts`/`problemFamilyCandidateSchema.ts`(zod, 안전 불변식 이중 검증) → `pdf/extractPdfMetadata.ts`(sha256+페이지 수, `pdfjs-dist/legacy/build/pdf.mjs`, Node엔 Worker가 없어 자동 fake-worker로 동작) → `pdf/extractPageText.ts`(페이지별 텍스트, DB 저장 안 함·로컬 캐시 전용) → `itemSegmentation.ts`(순수 함수, 숫자+마침표 패턴/숫자+별점마커 패턴 2종 정규식 휴리스텍으로 문항 경계 탐지, confidence<0.7이면 `NEEDS_REVIEW`, 원문자①②③은 문항 경계에서 항상 제외) → `curriculumMapping.ts`(순수 함수, Stage 1 `loadCurriculumSource` 재사용, EXACT/MULTI_NODE/UNCERTAIN/OUT_OF_SCOPE 4분류, 매핑 안 되면 새 노드를 만들지 않고 갭 후보로만 보고) → `familyGrouping.ts`(순수 함수, `family_signature`=개념+추론패턴+표현형태+정렬된 필요스킬+조건개수 구간의 정규화 문자열 — 추론 구조 기반, 표면 유사성 기반 아님) → `deduplication.ts`(순수 함수, EXACT_DUP/APPROX_DUP/SAME_REASONING_DIFFERENT_SURFACE/SIMILAR_SURFACE_DIFFERENT_REASONING 4분류+근거 문자열, 자동 병합/삭제 없음) → `difficultyEstimate.ts`(순수 함수, concept_load/reasoning_step_count/condition_count/calculation_load/케이스분류여부/비자명한 변환여부 가중합 → D1~D5 매핑, 초안 컷오프이며 항상 "REFERENCE_ESTIMATE"일 뿐 교정된 CSAT 난이도 아님을 코드 주석에 명시) → `referenceAnalysisRepository.ts`(Stage 1과 동일 팩토리+지연초기화 패턴, `reference_documents`는 onConflict `document_key`, `reference_item_features`는 onConflict `reference_document_id,local_item_key`, `problem_family_candidates`는 onConflict `candidate_code`, delete 문 없음, Stage 1 `reference_sources`를 source_url로 조회하는 읽기 전용 헬퍼 `resolveReferenceSourceIdByUrl` 포함) → `cli/{extract-reference-pilot.ts,validate-reference-features.ts}`(각각 `pnpm -F api reference:extract-pilot` — 기본 dry-run, `--apply` 플래그로만 실제 DB 반영/`reference:validate-features` — DB 연결 없이 큐레이션 JSON만 검증).
- **파일럿 입력**: `data/references/mathjk/algebra/수악중독 유형 - 대수 - 1. 지수함수와 로그함수.pdf` 1개만 하드코딩된 allowlist(`PILOT_PDF_ALLOWLIST`)로 고정 — 재귀 디렉터리 스캔/`ProblemDB/`(AI-Hub 데이터셋) 접근/다른 PDF 자동 탐색 코드 없음. 큐레이션된 피처 데이터셋은 `data/references/mathjk/algebra/pilot-item-features.json`(18개 문항, 2~30페이지 표본, primary_concept/reasoning_pattern 등 추상화된 서술만 — 문항 원문 없음).
- **실제 파일럿 실행 리포트**(`pnpm -F api reference:extract-pilot`, dry-run, 표본 범위 p1-p30):
  ```
  Pilot Document: 수악중독 유형 - 대수 - 1. 지수함수와 로그함수.pdf / sha256=241b52436993bba544d73a61f54910ab7dd0fd1d0929af9c577fd8e8e253af57 / pages=131 / extraction=성공
  Sample Range: p1-p30 (전수 분석 아님, 파일럿 표본)
  Reference Items: detected=80 / analyzed=18 / uncertain=18 / out-of-scope=0 / failed=0
  Curriculum Mapping: exact=0 / multi-node=0 / uncertain=18 / out-of-scope=0
  Family Candidates: count=12 / review-required=9 / rejected=0 / duplicate-merged-groups=3
  Difficulty Reference Estimate: D1=0 D2=2 D3=6 D4=5 D5=5 unclassified=0
  Copyright Safety: raw text in production tables = NO, source usage_mode = REFERENCE_ONLY, license verification status = UNVERIFIED
  ```
  `pnpm -F api reference:validate-features`도 `Errors: 0, Warnings: 0, PASS`.
- **커리큘럼 갭 발견(오너 검토 필요)**: 큐레이션한 18개 문항이 전부 `curriculumMapping`에서 UNCERTAIN으로 분류됨 — "거듭제곱근의 정의/성질", "지수법칙", "로그의 정의 및 성질", "로그의 밑변환"이라는 MathJK 소단원들이 Stage 1 `algebra.v1.json`에는 SUBUNIT 레벨(`ALG_EXP_LOG_EXP`/`ALG_EXP_LOG_LOG`)까지만 매핑되고, 이에 대응하는 세밀한 CONCEPT/SKILL 노드가 아직 없기 때문(Stage 1이 "SUBUNIT당 CONCEPT 1개"만 최소 예시로 채웠던 것과 일치하는 결과). **새 커리큘럼 노드는 이번 Stage 2에서 만들지 않았음** — 다음 세션에서 이 4개 소단원에 대응하는 CONCEPT/SKILL 노드를 `algebra.v1.json`에 추가할지 오너가 검토 필요.
- **테스트**: 합성(자체 제작) fixture만 사용 — `pdf/__fixtures__/synthetic-two-page.pdf`(생성 스크립트 `generate-synthetic-pdf.mjs` 동봉, 저작권 없는 더미 영문 텍스트 2페이지)로 `extractPdfMetadata`/`extractPageText`를 검증하고, 나머지 순수 함수(`itemSegmentation`/`curriculumMapping`/`familyGrouping`/`deduplication`/`difficultyEstimate`/`referenceAnalysisRepository`)는 MathJK 원문을 전혀 쓰지 않는 자체 제작 문자열/객체 fixture로 검증 — CI에 실제 PDF가 없어도(gitignore 대상) 전체 스위트가 통과함(확인 완료).
- Stage 1 LOW 이슈(B0)도 이번에 정리: `apps/api/src/infrastructure/curriculum/cli/validate-curriculum.ts`가 `isKnownReferenceSourceType()`을 실제로 호출하도록 수정 — 알 수 없는 `sourceType`이면 "## Reference Sources" 섹션에 경고 라인을 추가하고 warnings 합계에 반영(현재 데이터는 전부 알려진 타입이라 실제 경고는 0건).
- `.gitignore`에 `data/references/**/.extraction-cache/` 추가(페이지 텍스트 로컬 캐시, DB 저장 대상 아님).
- **범위 밖으로 명시적으로 남겨둔 것**: 원격 Supabase 자동 적용, `delete` 문, 문제 생성/추천엔진/임베딩/파인튜닝, UI 작업, 실제 CONCEPT/SKILL 커리큘럼 노드 추가(위 갭 발견 항목) — 전부 이번 Stage 2에서 만들지 않음.
- 게이트(루트 typecheck/lint/test/build 전체 워크스페이스) 통과 확인(api 163개/web 334개 테스트, 기존 테스트 회귀 없음).
- **Stage QA 1차 CONDITIONAL PASS → 수정 → 2차 PASS**: 1차 QA에서 MEDIUM 결함 발견 — `curriculumMapping`이 계산한 OUT_OF_SCOPE 분류가 리포트 집계에는 반영되지만 실제 family candidate 생성/저장 전에는 필터링되지 않는 문제(이번 파일럿엔 out-of-scope=0이라 실제 나쁜 데이터는 생성되지 않았으나 코드 자체가 잘못됨). `extract-reference-pilot.ts`에 `selectInScopeItems()`를 추가해 `groupItemsIntoFamilies`/`buildFamilyCandidate`에는 필터링된 아이템만 전달하고, 리포트 집계는 필터링 전 전체 기준을 그대로 유지하도록 수정 + 회귀 테스트 추가(api 테스트 159→163개). 재검증 후 `STAGE PASS — READY FOR NEXT STAGE`로 확정.

### 3.14 Problem DB Stage 3 — CSAT Gold-Set Calibration & Problem Family Approval (2026-08-27, 미커밋)

Stage 1/2 위에 쌓는 신규 도메인. **이번 단계도 백엔드/DB 작업으로 명시적으로 승인된 예외**다. 가장 중요한 정책 제약은 Stage 2와 동일: **공식 2028학년도 수능 예시문항 PDF 원문/페이지 이미지를 OpenAI/Anthropic 등 외부 AI API로 전송하지 않는다** — PDF 메타데이터/텍스트 추출은 Stage 2 코드(`extractPdfMetadata.ts`/`extractPageText.ts`)를 경로만 바꿔 그대로 재사용했고, `apps/api/src/infrastructure/ai/`의 `LLMAdapter`는 이 파이프라인 어디에서도 import하지 않는다. 문항 특징(30개 전수)은 PDF를 직접 열람해 수동으로 큐레이션했다. 어떤 신규 테이블에도 문항 원문 전체를 저장하지 않는다. **가장 중요한 불변식**: `problem_family_candidates.status`(Stage 2, CANDIDATE/REVIEW_REQUIRED/REJECTED 3값 고정)에는 절대 `APPROVED`를 쓰지 않으며, 최종 승인 상태(`APPROVED`)는 이번에 새로 만든 `problem_family_calibration.status`에만 존재한다(코드 전체에서 이 불변식이 유지됨을 확인).

- **신규 테이블 4개**(`supabase/migrations/20260827000000_problem_db_stage3.sql`, Stage 1/2 6개 테이블·기존 `problems`/`solutions`/`chat_messages` 전부 무변경, `create table if not exists`로 재실행 안전): `exam_reference_sets`(시험지 메타 — 연도/유형/증거등급 GOLD_2028_SAMPLE·SILVER_KICE·REFERENCE_OTHER, 라이선스 미검증 시 PRODUCTION_ALLOWED 불가 CHECK), `exam_item_features`(문항 단위 **추상화된** 구조적 특징만 — 개념/추론서명/난이도 신호/정답표 배점(`official_point_value`)/현재 교육과정 호환성, `primary_concept` 200자 제한), `problem_family_evidence`(family↔exam item 증거 매칭, `match_type='NONE'`은 저장하지 않음), `problem_family_calibration`(family_id PK, `status` CANDIDATE/**APPROVED**/REVIEW_REQUIRED/REJECTED 4값 — APPROVED가 존재하는 유일한 테이블). 네 테이블 모두 RLS만 켜고 정책 없음. `reference_sources`에 KICE Gold Set 1건 추가 등록용(`data/references/kice/source.json`, `licenseVerified=false`/`usageMode=REFERENCE_ONLY`), `referenceSourceSchema.ts`의 `KNOWN_REFERENCE_SOURCE_TYPES`에 `"official_sample_exam"` 1개 값 추가. **오너가 Supabase 대시보드에서 직접 실행해야 실제로 반영됨**(아직 미실행).
- **Stage 2 최소 가시성 변경**(로직 무변경, export 이유는 Stage 3가 Stage 2 함수를 인메모리로 재사용하기 위함): `extract-reference-pilot.ts`의 `enrichItem`/`buildFamilyCandidate`/`toDedupInput`에 `export` 추가. `declaration:true` 빌드가 "exported 함수가 non-exported 타입을 참조" 오류를 내는 것을 막기 위해 `EnrichedItem` 인터페이스와 `PilotItemDraft` 타입에도 `export`를 추가(둘 다 가시성 변경일 뿐 값/로직 변경 없음). `referenceAnalysisRepository.ts`에 읽기 전용 메서드 `listProblemFamilyCandidates()` 신규 추가(기존 메서드 무변경). **변경 후 Stage 2 전체 테스트(163개)가 정확히 그대로 통과함을 확인**(신규 메서드용 테스트 3개만 추가되어 166개 — 기존 163개는 1건도 변경/실패 없음, `--exclude examCalibration`으로 별도 확인 완료).
- **파이프라인**(`apps/api/src/infrastructure/examCalibration/`, Stage 1/2와 형제 디렉터리): `examReferenceSetSchema.ts`/`examItemFeatureSchema.ts`/`problemFamilyEvidenceSchema.ts`/`problemFamilyCalibrationSchema.ts`(zod, 안전 불변식 이중 검증) → `historicalCompatibilityGuard.ts`(순수 함수, `curriculum_compatibility='INCOMPATIBLE'` 항목을 스코어링 경로에서 하드 필터링하는 단일 지점, Stage 2 `selectInScopeItems()`와 동일 패턴) → `curriculumCentrality.ts`(순수 함수, family의 커리큘럼 노드 중심성을 `csatImportance`(1순위) → `curriculum_prerequisites` 그래프 degree 정규화(2순위) → 근거 없으면 중립값 0.5(3순위) 우선순위로 계산 — 초기 구현이 "유효하면 무조건 1.0"이던 것을 실제 신호 기반으로 교체) → `examEvidenceMatching.ts`(순수 함수, 커리큘럼 노드 겹침 0이면 무조건 `NONE` 하드 게이트 → 통과 시 skill Jaccard/reasoning containment/표현형태 일치 콤보 스코어로 DIRECT/PARTIAL/COMPOSITE/WEAK/NONE 분류, **스킬·추론 겹침이 둘 다 0이면(커리큘럼 노드만 우연히 겹친 경우) comboScore와 무관하게 무조건 NONE으로 강제하는 하드 규칙 추가**(초기 구현이 구조적 유사성만으로 WEAK를 남발하던 결함을 자체 재검토로 발견·수정), `evidenceWeight`는 (matchType, evidenceTier) 고정 함수로 GOLD가 SILVER보다 항상 가중치 상한이 높음, 텍스트 유사도 단독 판정 없음) → `csatRelevanceScoring.ts`(순수 함수, Gold Evidence/Curriculum Centrality/Historical KICE Evidence/Reasoning Reusability/Reference Coverage 5차원 가중합 40/25/20/10/5%, `redistributeWeights({hasAnySilverEvidenceInCorpus, hasReliableReasoningReusabilitySignal})`가 SILVER 0건이면 Historical 20%를, cross-node combinability 등 신뢰할 신호가 아직 없는 Reasoning 10%도 함께 나머지 차원에 비례 재분배 — Stage 2 confidence는 "CSAT 재사용 가능성"의 근거가 아니라는 자체 재검토로 추가 보수화, LLM 호출 없음) → `examDifficultyEstimate.ts`(Stage 2 `difficultyEstimate.ts` 확장, "계산 부하만으로는 D4/D5를 만들지 않는다" clamp 규칙 명시적 구현+전용 회귀 테스트) → `familyApprovalWorkflow.ts`(순수 함수 `evaluateFamilyApproval()`, 7개 게이트 PASS/UNCERTAIN/FAIL 3단 판정 → 하나라도 FAIL이면 REJECTED, 전부 PASS면 APPROVED, 그 외 REVIEW_REQUIRED, "의미있는 증거" 게이트는 WEAK 매치만 있는 GOLD 증거를 단독 통과 사유로 인정하지 않도록 강화(`goldMeaningfulEvidenceCount`=DIRECT/PARTIAL/COMPOSITE만 집계), SILVER 0건에서도 Gold "의미있는" 증거 단독으로 APPROVED 도달 가능함을 테스트로 확인) → `familyTaxonomyReview.ts`(순수 함수, 같은 Gold 항목에 DIRECT 매치된 두 family의 스킬 겹침이 크면 MergeProposal, family 내부 evidence가 커리큘럼 노드/케이스분류로 뚜렷이 갈리면 SplitProposal — 리포트 전용, 어떤 DB 행도 자동 병합/분할하지 않음) → `examCalibrationRepository.ts`(Stage 1/2와 동일 팩토리+지연초기화 패턴, 자연키 upsert, delete 문 없음, `--apply` 모드용 읽기 전용 조회 3종 추가) → `cli/{ingest-gold-set.ts, validate-exam-features.ts, calibrate-problem-families.ts}`(각각 `pnpm -F api exam:ingest-gold-set`/`exam:validate-features`/`exam:calibrate-families`, 기본 dry-run·`--apply` 플래그로만 실제 DB 반영, `ingest-gold-set.ts`는 Stage 1 `curriculumRepository.saveReferenceSource()`를 그대로 재사용해 KICE reference_sources를 자체 등록함 — Stage 1 CLI 파일 자체는 건드리지 않음) + `cli/calibrateProblemFamilies.core.ts`(오케스트레이션의 순수 계산 핵심만 분리 — 난이도 밴드 병합/family calibration/coverage 지표, 합성 fixture만으로 테스트 가능).
- **자체 QA 재검토로 발견·수정한 결함(1차 dry-run 결과가 부자연스럽게 균일했던 것을 계기로 재검토)**: 1차 구현에서는 12개 family 전부가 `gold_evidence=3`(1개만 5)으로 똑같이 나오고 전부 `HIGH`/`APPROVED`가 되는 부자연스러운 결과가 나왔다. 원인은 (a) `curriculumCentrality`가 "노드가 유효하면 무조건 1.0"인 이진 플래그였고, (b) `examEvidenceMatching`의 구조 유사도 계산에 이미 하드 게이트로 쓴 커리큘럼 노드 겹침을 다시 반영해 스킬/추론이 전혀 안 겹쳐도 WEAK로 잡히는 결함이 있었으며, (c) `familyApprovalWorkflow`가 WEAK 매치만 있어도 "의미있는 증거"로 인정했기 때문이었다. 세 곳 모두 위 파이프라인 설명대로 수정하고 회귀 테스트를 추가했다(examCalibration 테스트 82→91개, 전부 PASS).
- **입력 데이터**: `data/references/kice/{source.json,README.md}`(Stage 1 `mathjk` 패턴 재사용, `sourceUrl`은 실제 다운로드 출처인 경인일보 도메인으로 기록했으나 이번 세션엔 인터넷 접속이 불가해 정확한 기사 permalink를 재검증하지 못함 — **결정 필요**: 오너가 정확한 기사 URL로 갱신 권장, 원저작권자는 교육부·한국교육과정평가원임을 notes에 명시), `data/references/kice/2028-sample/gold-item-features.json`(30개 문항 **전수** 큐레이션 — 대수 11개/미적분Ⅰ 11개/확률과통계 OUT_OF_CURRENT_SCOPE 8개 최소 스텁), `data/references/kice/historical/README.md`(SILVER A 현재 0건 및 확장 슬롯 안내).
- **실제 실행 리포트**(위 결함 수정 반영 최종본, `pnpm -F api exam:ingest-gold-set` dry-run + `pnpm -F api exam:calibrate-families` dry-run, 둘 다 실제로 실행해 실측 — 목표치를 미리 정해 끼워맞추지 않은 그대로의 결과):
  ```
  Gold Set: relevant=22(대수 11/미적분Ⅰ 11) / out-of-current-scope=8 / uncertain=0
  Historical Evidence: total=0 / direct=0 / partial=0 / incompatible=0 / uncertain=0
  Family Calibration: reviewed=12 / approved=0 / review-required=2 / rejected=10 / merge-proposed=0 / split-proposed=0
  CSAT Relevance: CORE=0 / HIGH=0 / MEDIUM=0 / LOW=2 / REJECT=10
  Difficulty: D1-valid=0 / D2-valid=2 / D3-valid=4 / D4-valid=4 / D5-valid=4 (한 family가 여러 레벨 걸칠 수 있음)
  Coverage: Gold Family Coverage=13.64% / Gold Skill Coverage=45% / Family Gap Count=19 / Unsupported Family Rate=58.33%
  Rights Safety: raw text in production tables=NO, MathJK usage_mode=REFERENCE_ONLY, official source metadata recorded=YES, license unresolved items=2
  ```
  `pnpm -F api exam:validate-features`도 `Errors: 0, Warnings: 0, PASS`. `pnpm -F api reference:validate-features`/`db:validate-curriculum`(Stage 1/2 회귀)도 재확인해 모두 PASS.
- **결함 수정 후 결과가 보수적으로 바뀐 이유(오너 검토 필요, 숨기지 않고 명시)**: APPROVED가 0건까지 떨어진 것은 파이프라인이 잘못됐기 때문이 아니라, 스코어링을 엄격하게 고친 결과 Stage 1/2의 실제 데이터 부족이 그대로 드러난 것이다. ① **커리큘럼 중심성이 전부 0**(`PREREQUISITE_DEGREE` 소스) — Stage 1 `curriculum_prerequisites`가 UNIT 레벨(`ALG_EXP_LOG` 등) 관계 4건만 있고 family가 실제로 쓰는 SUBUNIT 노드(`ALG_EXP_LOG_EXP`/`ALG_EXP_LOG_LOG`)는 이 그래프에 전혀 등장하지 않아 degree=0이 됨(직접 확인함, `csatImportance`도 전 노드 null). ② 위 Gold Gap(Stage 2 파일럿이 한 소단원에만 국한)과 결합해 GOLD "의미있는" 증거(WEAK 제외)가 있는 family가 12개 중 1개뿐. 다음 세션 우선순위: (1) `algebra.v1.json`/`calculus1.v1.json`에 SUBUNIT/CONCEPT 레벨 선수관계·`csatImportance`를 보강, (2) MathJK 나머지 단원(삼각함수/수열) 및 미적분Ⅰ 참고자료로 Stage 2 파일럿 코퍼스 확장 — 이 둘을 해결하지 않으면 Stage 3 승인 파이프라인은 구조적으로 REJECT/REVIEW_REQUIRED에 머무른다.
- **테스트**: 신규 `examCalibration/**` 전부 합성 fixture만 사용(실제 PDF/실제 DB 없이 통과) — 91개 신규 테스트(순수 함수 8개 모듈 + repository + CLI 핵심 오케스트레이션 `calibrateProblemFamilies.core.ts`). "계산 부하만으로 D4/D5를 만들지 않는다" clamp, "SILVER 0건에서도 Gold 의미있는 증거 단독으로 APPROVED 가능", "커리큘럼 노드 미겹침 시 무조건 NONE 하드 게이트", "스킬/추론 겹침이 둘 다 0이면 무조건 NONE" 등 핵심 불변식마다 전용 회귀 테스트 존재.
- **범위 밖으로 명시적으로 남겨둔 것**: 원격 Supabase 자동 적용, `delete` 문, 문제 생성/추천엔진/임베딩/파인튜닝, UI 작업, SILVER A(역대 기출) 실제 데이터 확보(현재 0건 유지), 커리큘럼 선수관계/`csatImportance` 데이터 보강(위 결과 저조 원인 ①) — 전부 이번 Stage 3에서 만들지 않음.
- 게이트(루트 typecheck/lint/test/build 전체 워크스페이스) 통과 확인(api 257개/web 334개 테스트, 기존 테스트 회귀 없음 — Stage 1/2 163개 전부 그대로 PASS, `--exclude examCalibration` 기준 166개).

### 3.15 Problem DB Stage 3.5 — Calibration Recovery & Evidence Reinforcement (2026-08-27, 미커밋)

Stage 3에서 발견된 저조한 승인률(§3.14 "결함 수정 후 결과가 보수적으로 바뀐 이유")의 근본 원인을 plan-agent가 진단(원인 A/B/F 확인, C/D/E는 원인 아님으로 배제)한 뒤, 승인된 범위(대수 > 지수함수와 로그함수)로 한정해 정확히 그 원인만 수정했다. **임계값 변경, family 강제 승인, 데이터 조작은 하지 않았다** — 재계산 결과는 파이프라인이 실제로 산출한 그대로다.

- **원인 A 수정(csatImportance 보강)**: `apps/api/src/infrastructure/curriculum/curriculumSourceSchema.ts`에 옵셔널 `csatImportanceRationale: string`(1~300자) 필드를 노드 스키마에 추가(하위 호환 — 값을 채우지 않은 기존 노드는 필드 자체가 없어도 통과, `calculus1.v1.json` 등 다른 파일 전부 무변경). `data/math-curriculum/algebra.v1.json`의 4개 노드에 `csatImportance` + rationale을 채움:
  - `ALG_EXP_LOG`(UNIT) = **4**: 2022 개정 '대수' 3대 핵심 단원 중 하나이고, 2028 KICE Gold Set의 대수+미적분Ⅰ 관련 22문항 중 5문항(1·10·22·27·30번, 약 23%)이 이 단원과 관련되어 대수 하위단원 중 가장 높은 출현 비율(표본이 30문항으로 작아 5점은 아님).
  - `ALG_EXP_LOG_EXP`(SUBUNIT) = **3**: 지수함수 단독 관련 문항 1·10·30번 3개(약 14%).
  - `ALG_EXP_LOG_LOG`(SUBUNIT) = **3**: 로그함수 단독 관련 문항 22·27·30번 3개(약 14%).
  - `ALG_EXP_LOG_EXP_DEF`(CONCEPT) = **3**: Gold 10번 문항이 이 개념을 `secondaryConcepts`로 직접 명시.
  - 5/22=22.7%(≈23%) 비율은 `data/references/kice/2028-sample/gold-item-features.json`을 다시 열어 실측 재검증함(plan-agent 수치와 일치).
- **원인 B 수정(선수관계 보강)**: `algebra.v1.json`의 `prerequisites`에 `ALG_EXP_LOG_LOG → ALG_EXP_LOG_EXP`(strength=`required`) 1건 추가 — "로그함수는 지수함수의 역함수로 정의되므로 지수함수의 정의/그래프를 먼저 이해해야 한다"는 교육과정상 명백한 근거만 채택(plan-agent 예시와 동일 판단). 가짜 관계는 추가하지 않음. `pnpm -F api db:validate-curriculum` 재실행 결과 `Errors: 0, Warnings: 0, PASS`.
- **부수 결함 수정(MATHEMATICAL_CONSISTENCY 게이트)**: `apps/api/src/infrastructure/examCalibration/cli/calibrateProblemFamilies.core.ts`에 순수 함수 `detectConflictingRepresentationTypes()`를 신규 추가하고, `computeFamilyCalibration()` 내부에서 family에 실제로 매칭된(NONE 아닌) evidence들의 `representationType`을 모아 이 함수로 판정하도록 변경(이전엔 `calibrate-problem-families.ts`가 `hasConflictingRepresentationTypes: false`를 하드코딩해 이 게이트가 절대 FAIL할 수 없었음). "모순" 정의(주석에 근거 명시): SYMBOLIC(`expression`/`equation`/`inequality`) vs VISUAL(`graph`) vs CONTEXTUAL(`word_situation`) 3개 그룹 중 2개 이상에 매칭된 evidence가 걸쳐 있으면 모순으로 판정하고, `function_relation`/`mixed`는 중립으로 제외(그래프·기호식 어느 쪽으로도 나타날 수 있거나 이미 복합 표현임을 자체 명시하기 때문). `ComputeFamilyCalibrationOptions`에서 `hasConflictingRepresentationTypes` 옵션을 제거(더 이상 호출부가 값을 넘기지 않고 내부에서 계산), `FamilyCalibrationComputation`에 계산된 값을 노출 필드로 추가. 신규 단위 테스트 6개로 "graph vs equation이 섞이면 FAIL·REJECTED", "같은 그룹이면 계속 PASS" 등 게이트가 실제로 FAIL을 낼 수 있음을 확인(현재 실제 12개 family 재계산에서는 어느 family도 이 조건에 해당하지 않아 실제로는 0건 FAIL — 파이프라인이 이제 "계산 가능"해졌다는 뜻이지 현재 데이터가 이를 유발한다는 뜻은 아님, 정직하게 보고).
- **재계산 결과(Before/After, 둘 다 `pnpm -F api exam:calibrate-families` dry-run 실행 실측)**:
  ```
  Before(§3.14 기록): reviewed=12 / approved=0 / review-required=2 / rejected=10
                       CSAT Relevance: CORE=0 / HIGH=0 / MEDIUM=0 / LOW=2 / REJECT=10
  After :             reviewed=12 / approved=2 / review-required=10 / rejected=0
                       CSAT Relevance: CORE=0 / HIGH=0 / MEDIUM=3 / LOW=9 / REJECT=0
  ```
  `FAM-ALG-EXPLOG-009`(가장 강한 family): Before는 `curriculum_centrality=0`(source=`PREREQUISITE_DEGREE` — 이 family의 커리큘럼 노드가 옛 선수관계 그래프에서 degree=0이었음, 최선의 경우에도 CSAT 점수 0.30으로 승인 기준 0.35 미달) → After는 `curriculum_centrality=0.6`(source=`CSAT_IMPORTANCE`, `csatImportance=3`→`3/5=0.6`), `csat=MEDIUM(0.4325)`, `status=APPROVED`(gold_evidence=2, gold_meaningful_evidence=1). `FAM-ALG-EXPLOG-010`도 동일한 메커니즘으로 `csat=MEDIUM(0.365)`, `status=APPROVED`. 12개 family 전부 동일한 `csatImportance` 소스 노드를 참조해 centrality가 0.6으로 동일하게 올라갔지만(모두 지수·로그 단원 문항이므로), 최종 승인 여부를 가른 건 gold evidence 유무 — 나머지 10개는 REVIEW_REQUIRED(대부분 `MEANINGFUL_EVIDENCE`/`CSAT_USEFULNESS` UNCERTAIN)로 남았고 REJECTED는 0건이 됨. **여전히 APPROVED가 2건뿐인 것은 억지로 끌어올리지 않은 정직한 결과다** — 나머지가 REVIEW_REQUIRED에 머무는 주된 이유는 Gold 의미있는 증거 부족이며, 이는 Stage 2 파일럿 코퍼스가 아직 한 단원(지수함수와 로그함수)에만 국한된 구조적 한계(§3.14에서 이미 알려진 별도 이슈)이지 이번 수정의 범위가 아니다.
- **회귀 확인**: `pnpm -F api db:validate-curriculum`(Stage 1) PASS 유지. `pnpm -F api reference:extract-pilot`(Stage 2) `analyzed=18 / families=12` 불변 확인. `problem_family_candidates.status`/`problem_family_calibration.status`는 CLI dry-run 산출물일 뿐 수동으로 건드리지 않음(DB `--apply`도 실행하지 않음, 오너 검토 후 별도 실행 필요).
- **테스트**: `calibrateProblemFamilies.core.test.ts`에 `detectConflictingRepresentationTypes` 전용 5개 + `computeFamilyCalibration`의 모순 판정 통합 2개, 총 7개 신규 테스트 추가(기존 테스트는 `hasConflictingRepresentationTypes: false`를 옵션에서 제거하도록만 수정, 값 자체 변경 없음). 게이트 전체(루트 typecheck/lint/test/build) 통과 확인 — api 264개(Stage 3의 257개 + 신규 7개)/web 334개, 회귀 없음.
- **범위 밖으로 명시적으로 남겨둔 것**: 임계값(cutoff 상수) 조정, family 상태 수동 승인/강제, 삼각함수/수열/미적분Ⅰ 단원의 `csatImportance` 보강, SILVER A(역대 기출) 확보, Stage 2 파일럿 코퍼스 확장(다른 단원 추가) — 전부 이번 Stage 3.5에서 만들지 않음.

### 3.16 Solve v2.0 재구현 계획 (2026-09-04, plan-agent)

`docs/PRD_WHYMATH.md` v2.0(문제 생성 DB → 학생 풀이 진단형 1:1 튜터링 피벗, `cc3b930`) 확정 이후, 변경된 Solve 화면 Figma 3개 프레임(`3-0 Solve/Default` node `260:423`, `3-1 Solve/Pencilcanvas` node `127:445`, `3-2 Solve/Landscape` node `38:21`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`)을 design-agent가 분석하고, plan-agent가 구조·문서 갱신 계획을 수립했다(둘 다 미커밋 — 계획 문서 갱신 및 코드 구현은 이번 절 이후 단계).

- **핵심 결론 1 — 노드↔라우트 관계**: 3개 프레임이 3개의 새 라우트를 의미하지 않는다. `3-0`(INPUT, `problemId===null`)과 `3-1`(WORK, `problemId!==null`)은 기존 `/solve/pencilcanvas` 라우트 내부의 상태 분기이고, `3-2`는 기존 `/solve/landscape` 라우트를 유지한 채 콘텐츠만 DiagnosisCard/ResumeModeBar/ResumeResultCard로 전면 교체된다. PRD §3 "단계 전환에는 신규 라우트를 추가하지 않는다" 원칙과 일치.
- **핵심 결론 2 — ActionBar 상태 머신**: 기존 2-체크박스(`~~SOLVE-1~~`, 폐기)를 "문제 인식하기/아직 못 풀겠어요/봐 주세요" 3분할로 대체. 단계별(INPUT/WORK/DIAG·RESUME) × (recognizeEnabled/giveUpEnabled/diagnoseEnabled) 상태표를 순수 함수 `getActionBarState()`(신규, `shared/lib/solve/actionBarState.ts`)로 계산.
- **핵심 결론 3 — Provider 확장 판단**: 신규 Provider를 만들지 않고 기존 `ProblemInputProvider`(`features/problem-input/`)를 확장해 WORK/DIAG/RESUME/METHOD 상태를 추가(`useRecognizeWork`/`useDiagnose`/`useResume`/`useListMethods` 훅 추가). WORK 단계 캔버스는 INPUT 단계와 별개의 두 번째 `useDrawingStrokes()` 인스턴스 사용. `HandwritingCanvas.tsx` 내부는 수정하지 않고 `HandwritingHighlightOverlay`를 별도 sibling 레이어로 신설.
- **핵심 결론 4 — 6개 결정 필요 항목 분류**(전체 목록은 `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §7): (1) **WORK-2/3 중간 상태 Figma 조회 완료(2026-09-04) — 결론: 해당 프레임 없음.** `MathService` 파일 전체를 조사했으나 줄 단위 인식/수정/저신뢰도 경고를 모두 갖춘 WORK-진행-중 프레임이 존재하지 않음(3-0/3-1/3-2 행에 물리적 빈 공간 없음, 인접 node-id 전수 확인). 참고 단서는 `Solve/Work Line` 심볼(`248:53`, `3-2` 진단 화면 전용, 정답 판정 배지만 있고 신뢰도 배지 없음)과 "인식된 문제" 행의 "수정" 텍스트 링크(`254:64`, 문제 텍스트 대상, 학생 풀이 줄 아님) 뿐(`docs/COMPONENT_MAP.md` §1/§3 참고). `WorkLineEditor`(work-order 3단계) 착수 전 오너가 (a) Figma 신규 프레임 제작 요청 또는 (b) 기존 배지 톤 팔레트 재사용 임시값(추후 교체 전제) 중 방향을 결정해야 함 — 여전히 착수 차단 상태. (2) 막힌 지점 데이터 모델(스트로크 구간/y좌표 매핑) 미정 — `HandwritingHighlightOverlay`(6단계) 착수 전 필요, (3) CAS 검증 서비스 연동 시점 — 미준비 시 결정론적 스텁으로 대체, (4) METHOD(§4.8) 화면 Figma 미확인 — 8단계 착수 전 별도 확인 필요, (5) `curriculum_nodes` 확장 컬럼 UI 노출 범위 미정, (6) "학생 풀이 골드셋" 공공데이터 연계 "추후 검토"(프론트 구현 범위 밖).
- **작업 순서**: `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §1.3.1에 8단계 work order로 확정(ActionBar 재작성 → 목업 UI → WorkLineEditor[차단] → WORK/DIAG 백엔드 연동 → RESUME 백엔드 연동 → 하이라이트 오버레이[결정 필요] → CHAT 컨텍스트 확장 → METHOD 화면[Figma 미확인]).
- **오너 승인 범위(2026-09-04)**: "(1) docs 5개 갱신 → (2) development-agent 1~2단계(ActionBar + 목업 UI) 착수 → (3) 병행하여 design-agent에 WORK-2/3 Figma 추가 조회 요청"까지만 진행. 기존 구현이 깨지지 않도록, 그리고 공통 컴포넌트(`shared/ui`)를 재사용하도록 development-agent에 명시적으로 지시. 3단계 이후는 별도 승인 필요.

### 3.17 Solve v2.0 1~2단계 사후검수 결함 발견 및 수정 (2026-09-05, 미커밋)

1~2단계 구현 완료 후 오너가 3단계(`WorkLineEditor`)를 "임시값으로 우선 구현" 방향으로 승인해 development-agent가 3단계까지 진행했다(각 단계 게이트를 내가 직접 재검증 — typecheck/lint/test/build 전부 통과, 최종 361개 테스트). 이어서 CLAUDE.md 표준 절차대로 1~2단계에 대한 design-agent 사후검수를 진행한 결과 **P0(즉시 수정) FAIL 2건**이 나왔다.

- **결함 원인**: development-agent가 (앞선 세션에서 이미 존재하던, 이번 세션이 만든 것이 아닌) 코드 주석의 Figma node-id(`38:48`/`127:452`)를 근거로 ActionBar 구조를 재해석했는데, 이 두 node-id는 Figma MCP로 조회하면 **파일에 존재하지 않는 노드**였다. `WorkLineList`도 코드 작성 시점(design-agent의 WORK-2/3 조회와 병행 진행)에는 `Solve/Work Line`(`248:53`) 실측값이 아직 `docs/COMPONENT_MAP.md`에 반영되기 전이라, 다른 근거(신뢰도 표시 개념)로 임의 설계됐다.
- **ActionBar 결함**: "독립 버튼 3개 + gap"이 아니라 실제로는 "세그먼트 컨트롤 1개"(컨테이너 `gap-[2px] p-[6px]` + divider 2개, 코드는 `gap-[10px] p-[10px]`로 임의 재해석)였다. 색상도 "고정 3색"이 아니라 "그 단계의 주 행동 1개만 `bg-brand-deep` 강조, 나머지는 배경 없는 텍스트"인데, 코드는 3개 버튼에 `pill-dark`/`pill-glass`/`pill-primary`를 단계 무관하게 고정 배정했고 강조색도 틀렸다(`--color-brand` vs 실제 `--color-brand-deep`). 그림자도 `Elevation/Tab Pill`(2겹, `NavTabBar`가 이미 쓰는 값)을 잘못 갖다 썼고 실제는 `Elevation/Floating Bar`(3겹+inset 2겹, `docs/DESIGN_SYSTEM.md` §4)였다.
- **WorkLineList 결함**: 줄번호를 배지로 잘못 표현(실제는 순수 텍스트), 판정 배지 라벨이 "확인됨"(실제는 "확인")·크기가 안 맞음(`chip` 11px Regular vs 실제 999px pill `px-[8px] py-[2px]` 11px Semibold), 무엇보다 **Figma에 없는 "신뢰도 낮음"(`isLowConfidence`) 개념을 임의로 추가**했었다 — 이 심볼이 실제 표현하는 것은 "인식 신뢰도"가 아니라 "정답 판정(확인/막힌 지점)"이다.
- **수정**: design-agent가 Figma MCP로 재조회한 정확한 실측값(node `256:405`/`249:69`/`260:92`/`260:101`, `248:53`)을 그대로 development-agent에게 프롬프트로 전달해(development-agent는 Figma MCP 접근 권한이 없음) `ActionBar.tsx`/`WorkLineList.tsx`(+테스트)를 전면 재작성, `ResumeModeBar.tsx`의 컨테이너 톤도 연쇄 반영, 페이지 2곳의 잘못된 node-id 주석도 정정. **신규 디자인 토큰 2개**(`--color-accent-red #c97b6e`/`--color-fill-tint-red rgba(201,123,110,0.2)`, 둘 다 Figma 실측값 근거, `docs/DESIGN_TOKEN_MAP.md` 갱신)와 **`Badge` 신규 variant/size**(`tint-red`/`judgment`)를 추가했다 — 임의 색상이 아니라 Figma 실측값이므로 `.claude/rules/frontend.md` §3.3 규칙 위반 아님.
- **재검증**: 내가 직접 typecheck/lint/test(361개)/build를 재실행해 전부 통과 확인, 변경 파일(`ActionBar.tsx`/`WorkLineList.tsx`/`Badge.tsx`/`theme.css`/`tokens.css`)을 직접 읽어 프롬프트로 전달한 실측값과 일치하는지 대조 확인했다.
- **교훈**: 코드 주석에 있는 Figma node-id를 그대로 신뢰하지 말고, 화면 구현 작업마다 design-agent가 실제로 조회한 실측값을 development-agent 프롬프트에 직접 명시해서 전달해야 한다(development-agent는 Figma MCP 접근 권한이 없어 스스로 검증 불가) — 이번 work-order 4단계 이후 착수 시에도 동일 원칙 적용 필요.
- **재검수 결과(같은 날, 2회차 design-agent)**: 위 P0 수정 2건은 Figma MCP 재조회로 실제 일치를 확인(PASS). 다만 (a) `ActionBar.tsx` 세그먼트 텍스트가 `15px/20px`(근사 토큰)인데 실제 Figma 실측은 `14px/leading-normal`(P2), (b) 3단계 `WorkLineEditor.tsx`가 줄번호를 다시 `Badge`로 렌더링해 방금 고친 원칙을 재도입한 회귀(P1), (c) 편집 `<input>`이 `outline-none`만 있고 대체 포커스 스타일이 없는 접근성 결함(P1), (d) `WorkLineEditor.tsx`가 인용한 `RecognizedProblemBar`(Figma `39:39`)도 존재하지 않는 노드(P2, 인용만 정정 필요, 동작 변경 없음)를 추가로 발견 — development-agent에 즉시 수정 지시함.
- **P1/P2 수정 완료 및 재검증(2026-09-05)**: `WorkLineEditor.tsx` 줄번호를 `WorkLineList.tsx`와 동일한 순수 텍스트 패턴(`<span className="text-label-tertiary w-[16px] shrink-0 text-[11px] font-bold">`)으로 교체(편집/비편집 두 상태 모두), 편집 `<input>`에 `focus-visible:ring-brand ring-2 ring-offset-2` 추가, 잘못된 `39:39` 노드 인용 문구 정정(동작 변경 없음). `ActionBar.tsx` 세그먼트 텍스트를 `text-[14px] leading-[normal]`로 정정. 내가 직접 diff를 읽고 typecheck/lint/test(361개)/build를 재검증해 전부 통과 확인 — 지시한 4개 항목 외 다른 파일은 손대지 않았음도 함께 확인. `RecognizedProblemBar` 라벨 불일치·`Badge` `chip` size 불일치·`elevatedCardStyle.ts` 중복 3건은 의도대로 이번 범위에서 제외되고 `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §7에 백로그로 기록됨.
- **신규 발견 백로그(이번 범위 밖, 별도 처리 필요)**: `RecognizedProblemBar.tsx`의 배지 라벨이 "인식됨"인데 Figma 실측은 "인식된 문제"(기존 컴포넌트의 기존 결함, 이번 세션이 만든 것 아님); `shared/ui/badge/Badge.tsx`의 `chip` size가 `rounded-[6px]`/`font-normal`인데 실제 사용처(`254:61`) 실측은 `rounded-[8px]`/`font-[590]`(기존 부채); `elevatedCardStyle.ts`가 `features/ai-solution`과 `features/work-input`에 중복 존재(feature 간 직접 참조 금지 규칙 때문에 불가피했으나 `.claude/rules/frontend.md` §2 "3회 이상 반복 시 공통 컴포넌트로 분리" 기준 충족 — `shared/ui` 승격 검토 필요).

### 3.18 Solve v2.0 4단계(WORK/DIAG 백엔드 연동) — 4a-1 완료 (2026-09-05, 미커밋)

오너가 두 가지를 결정: (1) `recognizeWork`/`diagnose`는 스텁이 아니라 **실제 OpenAI 구현**(옵션 B)으로 진행, CAS만 스텁 유지, (2) 화면 흐름 전환(4b, "문제 인식하기"가 즉시 풀이로 넘어가던 기존 동작을 WORK 화면에 머무르는 것으로 바꾸는 것 — `problemInputFlow.test.tsx` 대부분 재작성 필요)은 **이번엔 보류**, 4a(백엔드+훅)까지만 우선 진행. plan-agent가 4단계를 4a-1(인터페이스+FakeAdapter+라우트+훅, 무회귀)/4a-2(실제 OpenAI 구현+라이브 스모크)/4b(페이지 배치, 별도 승인 필요)로 분리한 계획을 그대로 따름.

- **4a-1 산출물**: `shared-types`에 `WorkLine`/`CasStepVerification`/`Diagnosis` 타입, `validation`에 대응 zod 스키마, `apps/api/src/infrastructure/cas/stubCasVerification.ts`(모든 줄 `isValid:true`, CAS 서비스 준비 전까지 임시), `work.router.ts`(`POST /api/problems/:problemId/work-lines`)/`diagnosis.router.ts`(`POST /api/problems/:problemId/diagnose`, 기존 `solutions`/`chat` 라우터와 동일한 인증→rate-limit→검증→소유권 404 패턴), `LLMAdapter`에 `recognizeWork`/`diagnose` 메서드 추가(`FakeLLMAdapter`는 결정적 구현, `OpenAIAdapter`는 4a-2 전까지 에러 throw 스텁), `inMemoryProblemStore`에 `workLines?`/`diagnosis?` 옵셔널 필드+setter, 프론트 `useRecognizeWork`/`useDiagnose` 훅을 `ProblemInputProvider`가 소유(단, **어느 화면에도 아직 연결하지 않음** — 4b 범위).
- **회귀 방지**: development-agent 프롬프트에 "절대 건드리지 말 것" 목록(페이지 전체, ActionBar, WorkLineList 등 4+1개 목업 컴포넌트, 3개 e2e 테스트 파일, 기존 5개 api 모듈)을 명시. 완료 후 내가 직접 `git diff --stat`으로 이 목록 전부 diff 0임을 확인, 기존 어댑터 4개 메서드/`inMemoryProblemStore` 4개 메서드/`ProblemInputContext` 기존 필드가 문자 그대로 보존됐는지 diff를 라인 단위로 대조. **development-agent가 지시받지 않은 `docs/PROJECT_STATUS.md` 편집(임의 요약 섹션 추가, 보고서에 언급도 없었음)을 발견해 즉시 되돌림** — 이번 세션에서 처음 발견된 패턴이라 향후 development-agent 지시 시 "docs/ 디렉터리는 절대 건드리지 말 것"을 명시적으로 추가할 필요가 있다.
- **stage-qa-agent 검증**: **STAGE PASS**. 위 회귀 방지 목록 재확인(전부 diff 0), 신규 라우터 패턴 일치, `stubCasVerification` 정직성(주석에 명시), `shared-types.WorkLine`(WORK 단계 인식 결과)과 `WorkLineList.tsx` 로컬 `WorkLine`(DIAG 판정 결과, 다른 개념)이 혼용되지 않았음을 grep으로 확인. LOW 이슈 1건: `DiagnosisCard.tsx`의 로컬 `Diagnosis` 인터페이스가 신규 `shared-types.Diagnosis`와 완전히 동일한 구조 중복 — 이번 단계(화면 미연결)에서는 그대로 두는 게 맞고, **4b(화면 실연결) 착수 시 로컬 타입을 지우고 `shared-types.Diagnosis`를 import하도록 정리 필요**(백로그).
- **게이트**: typecheck/lint 전체 통과, api 264→282개(+18, 신규 라우터/스텁/어댑터 테스트), web 361→371개(+10, 신규 API 클라이언트/훅 테스트) — 오케스트레이터가 직접 재실행해 동일 수치 확인. build 성공.
- **다음**: 4a-2(OpenAIAdapter 실제 구현 — `recognizeWork` Vision 프롬프트, `diagnose` 진단 프롬프트, 둘 다 라이브 스모크 필요) 진행 예정. 이후 4b(화면 배치, UX 흐름 전환)는 별도 오너 승인 필요.

### 3.19 Solve v2.0 4a-2 — OpenAIAdapter 실제 구현 + 라이브 스모크 완료 (2026-09-05, 미커밋)

`openai-adapter.ts`의 `recognizeWork`/`diagnose` 에러 throw 스텁을 실제 OpenAI Responses API 구현으로 교체. 기존 `recognizeProblem`(Vision+Structured Outputs)/`solve`(Structured Outputs)와 동일한 패턴(JSON 파싱 실패·스키마 불일치 시 `AppError("provider_error", ..., 502)`)을 그대로 따름. `prompts/system.ts`에 `buildRecognizeWorkPrompt`/`buildDiagnosePrompt` 추가(기존 4개 프롬프트 함수 무변경). `diagnose`는 PRD의 역할 분리 원칙대로 CAS `casVerification` 결과를 "이미 계산 완료된 사실"로 프롬프트에 제시해 LLM이 재판정하지 않고 설명/해석만 하도록 설계됨.

- **라이브 스모크(1회성 수동, §3.3~3.4/§3.9 6.5B 선례와 동일 절차)**: `recognizeWork`는 실제 학생 풀이 이미지(`ProblemDB/.../S3_고등_1_007092.png`)로 호출해 3줄 정상 분리 확인. `diagnose`는 오류형/중단형/DIAG-5(저신뢰도)/DIAG-6(정답+표기비약) 4개 시나리오로 실제 호출 — DIAG-6 시나리오에서 초기 프롬프트가 `reachedAnswerWithNotes`를 안정적으로 트리거하지 못해 프롬프트 문구를 강화(핵심 풀이 단계를 생략한 것도 논리 비약으로 명시)하고 재검증, 다른 3개 시나리오 회귀 없음 확인.
- **stage-qa-agent 검증**: **STAGE PASS**. 기존 4개 어댑터 메서드/4개 프롬프트 함수가 `git show HEAD:<file>` 대조로 완전 무변경임을 확인(작업 트리 diff가 아니라 커밋 시점 기준으로 재확인해 4a-1 미커밋 변경과 섞이지 않게 함). DIAG-6 프롬프트 수정의 회귀 영향(다른 3개 시나리오)을 stage-qa-agent가 **직접 재현**해서(개발자 보고를 그대로 신뢰하지 않고) 문제없음을 독립 확인 — 4개 시나리오 전부 스키마 유효 + 의미상 정확. PRD §8.3 SDK 격리 원칙(`openai` 패키지는 `openai-adapter.ts`에서만 import)도 grep으로 재확인.
- **미검증으로 남긴 것(블로커 아님)**: DIAG-5(저신뢰도) 완화 표현은 텍스트만으로 재현한 스모크에서는 트리거되지 않음 — `diagnose()`가 이미지가 아니라 인식된 텍스트만 받으므로 진짜 저신뢰도 필기 이미지로는 4b(WORK→DIAG 실제 연결) 시점에 재검증 필요.
- **게이트**: typecheck/lint 전체 통과, api 282→288개(+6, 신규 어댑터 단위 테스트), web 371개 무변경. build 성공. 오케스트레이터가 직접 재검증.
- **다음**: 4a(백엔드+훅) 전체 완료. 4b(목업 컴포넌트 화면 배치, "문제 인식하기" 흐름 전환)는 오너 승인 대기 중.

### 3.20 Solve v2.0 4b — 화면 배치 + "문제 인식하기" 흐름 전환 완료 (2026-09-05, 미커밋)

오너가 표준 절차를 명시적으로 확정: **plan-agent(계획/통제) → development-agent(구현) → design-agent(사후검수, 화면/컴포넌트 규칙 위반 방지) → stage-qa-agent(회귀 테스트, PASS 시에만 완료)**, 이후 모든 화면/기능 작업에 이 루프를 항상 적용하기로 함(`[[feedback_agent_loop_standard]]` 메모리 기록).

- **plan-agent 계획**: `SolvePencilcanvasPage.tsx`(INPUT/WORK 두 단계를 `problemId` 분기로 한 라우트에 조립, 두 번째 `useDrawingStrokes()` 인스턴스, `recognizeOnly`/`giveUp`/`diagnose` 신규 함수)/`SolveLandscapePage.tsx`(기존 solve-result 분기 무변경, DIAG 결과 분기 신규 추가) 상세 설계 + 회귀 위험 체크리스트(`problemInputFlow.test.tsx` 11개 중 8개 재작성 판정표 등) 수립. 오너 확정 2건: (1) WORK-4는 전용 힌트 API 대신 기존 `solve()` 재사용, (2) "봐 주세요"는 2단계 동작(1회=인식, 2회=진단, 검토 기회 제공).
- **development-agent 구현**: 위 설계 그대로 구현. `ProblemInputProvider.tsx`에 `recognizeOnly`/`giveUp`/`diagnose`(감싸기) 추가, `submitProblem`/`resumeFromHistory`는 무변경(byte 단위 확인). `actionBarState.ts`에 `isBusy` 상호배제 로직 추가. `problemInputFlow.test.tsx` 8개/`cameraFlow.test.tsx` 1개를 `recognizeThenGiveUp()` 헬퍼로 재작성(기존 assertion 전부 보존, 최소 diff).
- **오케스트레이터 직접 발견·수정**: `shared/lib/solve/deriveWorkLineJudgments.ts`(신규)가 `.claude/rules/frontend.md` §1("shared→features 역참조 금지")을 위반(`features/ai-solution/WorkLineList`에서 타입 import) — development-agent가 스스로 지적하며 넘겼으나, TypeScript 구조적 타이핑으로 로컬 타입 정의만으로 완전히 대체 가능해 즉시 직접 수정(기능 변경 없음).
- **design-agent 사후검수 3라운드**(전부 Figma MCP 직접 재조회 기반):
  - 1차: **FAIL** — P0(DIAG 결과 화면에 "풀이 결과" 헤더/"새 문제" 배지 전체 누락) + P1 3건(WORK 단계 `RecognizedProblemBar` 누락, "내 풀이"→"내가 쓴 풀이" 오타, 좌측 컬럼 무제한 높이로 ActionBar와 겹칠 위험) → 수정.
  - 2차: 위 4건 PASS 확인, 그러나 새 P0 발견 — DIAG 결과 화면에 후속 질문(ChatFooter/제안 질문)이 전혀 없었음(`diagnose()`가 `fetchSuggestedQuestions` 미호출 + 페이지에 `ChatFooter` 자체가 없었음) → 수정.
  - 3차: ChatFooter mount는 PASS, 그러나 `hashtags={diagnosis.relatedConcepts}`가 Figma 실제 문구(고정 질문 카테고리 프리셋으로 추정)와 다르고 `DiagnosisCard`와 콘텐츠 중복 → `hashtags={[]}`로 교체, 코드에 "결정 필요" 주석 명시(정확한 프리셋 확정 전까지).
- **stage-qa-agent 최종 검증**: **STAGE PASS**. 회귀 파일 전수(`WorkLineEditor`/`ResumeModeBar`/`ResumeResultCard`/`HandwritingCanvas`/`PenRail`/`ResultPanel`/`ResultPanelShell`/`useDrawingStrokes`/`stubCasVerification`/`ChatFooter`/api 라우터 전체/`docs/**`) diff 0 확인, `submitProblem`/`resumeFromHistory` byte 단위 무변경 확인, `problemInputFlow.test.tsx`(8재작성/3무변경)·`cameraFlow.test.tsx`(1재작성/3무변경) 정확히 일치 확인, WORK 캔버스 필기 유실 회귀 없음(재현 테스트로 직접 확인), `isBusy` 상호배제·"봐 주세요" 2단계 동작 정확성 확인. 게이트: typecheck/lint 전체, api 288개(무변경)/web 379개(371+8), build 성공.
- **남은 "결정 필요" 항목(4건, 블로킹 아님, 전부 코드에 주석 명시)**: (1) DIAG Header 토픽 배지(`Diagnosis`에 대응 필드 없음), (2) ChatFooter 해시태그 pill 정확한 문구/데이터 모델, (3) WORK 캔버스 빈 상태 힌트(Figma `242:528`, 이번 범위 제외), (4) `ResumeModeBar`/`ResumeResultCard` 미마운트(RESUME 백엔드 없음, 의도적). 추가로 iPad 실기기(1194×834 가로/Split View) 렌더 미검증(코드/Figma 실측 대조만 수행) — 다음 실기기 테스트 시 확인 필요.
- **다음**: work-order 5단계(RESUME 백엔드 연동) 이후 착수 여부 오너 확인 필요. 4b까지 전부 미커밋 상태.

### 3.21 Solve v2.0 4b 정정 — ActionBar 4-way 상태표 + 개념설명/관련개념 카드 + ResultPanel V2 (2026-09-06, 계획 승인, 미착수)

오너가 iPad 실기기 테스트 중 Figma 4개 노드(로딩 아이콘 `190:866`, INPUT 빈 상태 `260:423`, WORK 캔버스 `127:445`/`267:607`, 문제 인식 스토리보드 `267:778`)를 직접 지정하며 4b 구현의 부정확한 부분을 지적했다. design-agent가 이 4개 노드를 정밀 실측한 결과, 그리고 이어서 오너가 추가 요청한 "개념설명" 해시태그+관련개념 카드(node `253:53`)와 ResultPanel V1.0 old→V2_Default/V2_Extend(node `174:639`)를 재조사한 결과, 4b 구현이 실측과 다른 부분(P0급)과 완전 미구현 부분을 다수 발견했다.

**핵심 발견 — ActionBar가 실제로는 4단계 상태표를 가짐(3단계 아님)**:
| 단계 | [1]문제인식하기/새문제풀기 | [2]아직못풀겠어요 | [3]봐주세요 |
|---|---|---|---|
| INPUT | 강조 | 비활성 | 비활성 |
| WORK-풀이전(`hasWorkInput=false`) | 비활성 | **강조** | 비활성 |
| WORK-풀이후(`hasWorkInput=true`) | 비활성 | 활성(비강조) | **강조** |
| RESULT | 라벨="새 문제 풀기", **강조/활성** | 비활성 | 비활성 |

기존 4b 구현은 WORK를 하나로 뭉쳐 "봐 주세요"를 항상 활성 처리했고(풀이를 쓰기 전에도 진단 요청 가능했음 — Figma와 반대), RESULT 단계의 "새 문제 풀기"는 완전히 미구현이었다(코드 자체가 "실질적으로 클릭 가능한 구간이 없다"고 스스로 인지하고 있던 죽은 코드).

**추가 발견 — 캔버스 상단 "인식됨" 칩이 잘못된 컴포넌트를 재사용 중**: `SolvePencilcanvasPage.tsx`가 `/solve/landscape` 결과 패널 전용 컴포넌트(`RecognizedProblemBar`, 불투명 카드+"수정" 버튼)를 캔버스 상단(글래스 pill, 수정 버튼 없음, Figma `Solve/Recognized Chip` `250:56`)에 잘못 재사용하고 있었다.

**추가 발견 — INPUT/WORK 캔버스 빈 상태 힌트, 로딩 마크 배치 모두 실측과 다르거나 미구현**: 로딩 마크는 카드로 감싸져 있는데 Figma는 배경 없는 순수 마크(투명, 화면 정중앙)이고, 두 캔버스의 빈 상태 안내 문구(Figma `260:454`/`242:528`)는 전혀 구현되지 않았다.

**추가 발견(2차 조사) — "개념설명" 해시태그 + "관련개념" 카드**: 후속 질문 입력창 위 해시태그 pill은 `["#개념설명"(고정), 관련개념 태그(가변), "#비슷한 문제"(고정)]` 4-패턴인데(V1.0 old/V2 공통, 신규 스펙 아님), 지금까지 이 패턴이 정확히 구현된 적이 없었다. "개념설명" 선택 시 나타나는 "관련개념" 카드는 새 컴포넌트가 아니라 기존 `ResultCard`(`kind="concept"`) 재사용이면 되지만, **`Diagnosis` 타입에 개념 설명 본문 텍스트가 없어 백엔드 확장이 필요**하다는 것도 확인됐다(`relatedConcepts`는 이름만 있음).

**추가 발견 — ResultPanel `V1.0 old`→`V2_Default`/`V2_Extend`**: 패널 폭 수치(420/748/6px)는 이미 정확해 변경 불필요, 바뀐 것은 Default 폭일 때의 Body 콘텐츠 템플릿뿐. `174:638`(V1.0 old, 기존 concept+steps 레이아웃)과 `253:53`(V2_Default, 진단 플로우)이 Figma에 별개 variant로 공존 — `isResultReady`(V1.0 old)는 그대로 두고 `isDiagnosisReady`에만 V2 콘텐츠를 적용하기로 결정.

**실행 분리 — plan-agent 권장, 오너 승인**:
- **1차 실행**(지금 착수, 회귀 위험 낮음): ActionBar 4-way 상태표(`actionBarState.ts`/`ActionBar.tsx`), `ProblemInputProvider`에 신규 `startNewProblem()`, 신규 컴포넌트 `features/solve-session/{RecognizedChip,EmptyStateHint}`, 로딩 마크 카드 제거, `ProblemCard` 폭 448→543px. 회귀 분석 결과 `problemInputFlow.test.tsx`/`cameraFlow.test.tsx`는 수정 불필요(`recognizeThenGiveUp()` 헬퍼가 "봐주세요"를 건드리지 않음), `ActionBar.test.tsx`(9개)만 재작성.
- **2차 실행**(1차 이후 착수): `Diagnosis` 백엔드 확장(`curriculum_nodes.definition_md` 조인, 진단 프롬프트 동기화), `ResultCard.tsx`에 `title?: string` 추가, `ChatFooter` 해시태그 배열 조립 로직, DIAG 분기에 관련개념 카드 토글.

**결정 필요 7건, 전부 오너 승인 완료(2026-09-06)** — 상세는 `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §7 참고: (1) 로딩마크 48px, (2) "새 문제 풀기"는 신규 `startNewProblem()`, (3) "사진 찍음, 인식 전" ProblemCard는 그대로 유지, (4) 신규 컴포넌트는 `features/solve-session/`, (5) "개념설명" 클릭은 토글(패널 폭과 독립), (6) 적용 범위는 DIAG만, (7) 개념 태그는 가변 개수.

**1차 실행 완료(2026-09-06)**: development-agent 구현 → design-agent 사후검수(High 1건 발견: `RecognizedChip` 치수/그림자가 Figma 실측과 어긋남, `gap-3 p-4`→`gap-[8px] px-[14px] py-[7px]`+inset 하이라이트로 수정; Low 2건: `font-semibold`→`font-[590]`, 컨테이너 간격 11px 정정) → stage-qa-agent 1차 검증(MEDIUM 1건 발견: `/solve/pencilcanvas`의 ActionBar에 "새 문제 풀기" 핸들러 미연결로 브라우저 뒤로가기 시 죽은 버튼 발생 — 수정) → stage-qa-agent 최종 재검증 **STAGE PASS**. 오너 결정: "사진 없이 필기만 입력 시 문제 요약 카드 자리가 비는" 것은 의도된 단순화로 확정(`ProblemCardData` 확장 안 함). 게이트: typecheck/lint 전체, api 288개(무변경)/web 380개, build 성공.

**2차 실행 완료(2026-09-06)**: `Diagnosis`에 `conceptExplanations: ConceptExplanation[]` 신규 필드 추가(기존 `relatedConcepts: string[]`는 무변경, `DiagnosisCard` 회귀 없음). **아키텍처 판단**: PRD가 언급한 `curriculum_nodes.definition_md` DB 조인 대신, 현재 `diagnose` 파이프라인이 Supabase를 전혀 조회하지 않는 순수 LLM 생성 구조라는 점을 반영해 개념 제목/설명도 `relatedConcepts`와 동일하게 LLM이 직접 생성하도록 구현(오케스트레이터 결정, `docs/COMPONENT_MAP.md` §1 "Result Card" 행에 정정 반영 완료). `ResultCard.tsx`에 `title?: string` 옵셔널 추가(기존 2개 호출부 하위 호환). `SolveLandscapePage.tsx` DIAG 분기에 해시태그 4-패턴(`#개념설명`(고정)+관련개념 태그(가변)+`#비슷한 문제`(고정)) 조립, "#개념설명" 클릭 시 로컬 state 토글로 관련개념 카드 표시.
- design-agent 사후검수: Medium 4건 발견 — (a) 카드 렌더 순서가 Figma와 반대(DiagnosisCard 직후가 아니라 Body 최하단이어야 함) → 수정, (b) `isConceptCardVisible`이 새 진단 세션 시작 시 리셋 안 됨 → `panelWidth` 리셋과 같은 블록에 추가해 수정, (c) 카드 여러 개일 때 스택 방식이 Figma(카드 1개) 의도와 맞는지 → 오너가 "스택 유지"로 확정(변경 없음), (d) `docs/COMPONENT_MAP.md`가 실제 구현과 다른 소스(curriculum_nodes 조인)를 기록 → 정정.
- **stage-qa-agent 회귀 테스트 중 HIGH 결함 발견**: RESULT 단계 "새 문제 풀기" 클릭 시 `/solve/pencilcanvas`가 아니라 `/camera`로 잘못 이동. 원인은 1차 산출물(`startNewProblem()`)에 있었으나, `ActionBar.test.tsx`는 콜백만 mock으로 검증하고 실제 라우터+`RequireProblemInputGuard`를 통과하는 E2E 테스트가 그동안 없어서 1차/2차 어느 QA에서도 발견되지 않았던 것. `startNewProblem()`이 `problemId`/`hasProblemInput`/`recognizeStatus`를 전부 초기화하는 순간, 아직 `/solve/landscape`에 머무른 채로 `RequireProblemInputGuard`가 `isAllowed=false`를 보고 `/camera`로 먼저 튕겨버리는 가드 경쟁 상태였다.
- **수정**: `beginReinput()`("수정" 재입력 흐름)이 이미 쓰고 있던 동일한 가드 우회 메커니즘(`isRequestingReinput` 플래그)을 재사용 — `startNewProblem()` 최상단에 `setIsRequestingReinput(true)` 한 줄 추가. `recognizeOnly()`가 다음 실제 제출 시점에 이 플래그를 자동으로 꺼주므로 부작용 없음. development-agent가 실제 `RouterProvider`+가드를 통과하는 재현 테스트로 수정 전(`/camera`로 실패 재현)/후(`/solve/pencilcanvas` 도달) 직접 확인, stage-qa-agent가 독립적으로 동일한 fail→fix→pass 재현을 재수행해 최종 확인(WORK-4/SOLVE-2 두 경로 모두).
- **최종 게이트**: typecheck/lint 전체, api 288개/web 383개(무변경, 순수 버그 수정), build 성공. **stage-qa-agent 최종 판정: STAGE PASS.**
- **교훈**: `ActionBar.test.tsx` 같은 컴포넌트 단위 테스트가 prop/콜백을 mock으로 검증하는 것만으로는 실제 라우터·가드까지 이어지는 통합 결함을 못 잡는다 — 화면 전환을 동반하는 액션(특히 상태 초기화+navigate가 함께 일어나는 경우)은 최소 1개의 실제 라우터 기반 E2E 재현 테스트로 별도 검증해야 한다.

**다음**: work-order 5단계(RESUME 백엔드 연동) 이후 착수 여부 오너 확인 필요. iPad 실기기 렌더 검증은 여전히 미완료(코드/Figma 대조만 수행). 전부 미커밋 상태.

### 3.22 Solve v2.0 WORK 흐름 단순화 + 결과 화면 "수정" 링크 + 사진 유지 (2026-09-06, 미커밋)

> **2026-09-08 번복(§3.29 참고)**: 아래 "사진 유지" 결정(결과 화면에서도 사진 입력 시 `ProblemCard` 노출)은 오너가 iPad 실기기 확인 후 명시적으로 번복했다 — 결과 화면에서는 이제 입력 방식과 무관하게 사진을 완전히 숨긴다. 이 섹션의 "사진 유지" 관련 서술은 히스토리로만 남기고, 현재 동작은 §3.29를 따른다.

오너가 iPad 실기기 테스트 후 3건을 요청: (1) WORK 단계 "봐 주세요" 클릭 후 캔버스 재확인 단계(`WorkLineEditor`) 없이 바로 진단 결과 화면으로 이동, 대신 결과 화면에서 "수정" 클릭 시 WORK 캔버스로 돌아가 재인식, (2) 사진으로 입력하지 않은 경우(필기만) 결과 화면에 "사진 인식 박스"(`ProblemCard`)가 보이지 않게, (3) 진단 결과 하단 RESUME 버튼("내 방법으로 계속"/"다른 방법으로") 부재 확인 요청 — design-agent 조사로 work-order 5단계(RESUME 백엔드 연동) 범위이며 아직 미착수임을 확인, 이번 단계에서는 구현하지 않음(코드 변경 없음).

plan-agent가 (1)(2) 구현 계획을 수립하며 신규로 발견한 점: `submitProblem()`(재입력 후 재제출 경로)도 사진 입력 시 `clearCapturedImage()`를 무조건 호출해 (2)와 같은 문제가 있어 원래 요청 범위(`diagnose`/`giveUp`)에 포함시켜야 일관성이 맞는다고 판단, 오너 승인 후 포함해 진행.

**구현 완료**:
- `SolvePencilcanvasPage.tsx`의 `handleDiagnose`를 `recognizeWork→diagnose` 단일 async 체인으로 재작성, 성공 시 `/solve/landscape`로 즉시 이동.
- `features/work-input/`(`WorkLineEditor.tsx`/`.test.tsx`, `elevatedCardStyle.ts`) 디렉터리 전체 삭제 — 참조 0건 확인, 애초에 두 실제 화면 어디에도 마운트된 적 없는 목업 전용 컴포넌트였음(dead code 정리).
- `WorkLineList.tsx`에 헤더 레벨 "수정" 링크(`onEdit?`) 추가, 공용 `TEXT_LINK_STYLE` 재사용(줄마다 반복 아님).
- `SolveLandscapePage.tsx`에 `handleEditWork`(`resetRecognizeWork()`+`resetDiagnose()`+`navigate("/solve/pencilcanvas")`) 추가 — WORK 캔버스 필기(`workStrokes`)는 의도적으로 보존(지우개로 부분 수정 가능하게). `ProblemCard`를 `problemCardData !== null` 조건부 렌더링으로 변경.
- `ProblemInputProvider.tsx`의 `submitProblem`/`giveUp`/`diagnose` 세 콜백 모두 `lastInputType === "photo"`일 때 `clearCapturedImage()` 스킵.
- design-agent 사후검수에서 발견된 Medium 1건(공용 `TEXT_LINK_STYLE`에 `focus-visible:ring` 접근성 스타일 없음, 새 "수정" 링크에도 전파됨)을 오케스트레이터가 직접 수정. High 2건(`gap-[11px]`, `ProblemCard` 폭 `543px`)은 근거 없는 임의값이라는 지적이었으나 실제로는 이전에 이미 STAGE PASS 받은 §3.21 1차 라운드에서 들어간 값이라 이번 단계 범위 밖으로 판단, 별도 후속 확인 필요(아래 미해결 항목 참고). Medium 1건(전체화면 로딩 마크에 딤 배경 없음)은 오너가 이번 세션 초반 명시적으로 요청한 "카드 없이 투명하게" 결정과 일치하는 의도된 디자인이라 수정하지 않음.
- stage-qa-agent 회귀 테스트: 실제 라우터+`RequireProblemInputGuard` 통과 E2E로 "수정" 링크 클릭 후 `/solve/pencilcanvas` 도달(가드 경쟁 없음, §3.21에서 얻은 교훈 적용) 확인, 사진 유지(`giveUp`/`diagnose` 두 경로 모두)·필기만 입력 시 `ProblemCard` 미노출·"수정" 후 재진단 성공 전부 실제 통합 테스트로 확인. **최종 판정: STAGE PASS.**
- **게이트**: typecheck/lint 전체, api 288개(무변경)/web 377개, build 성공(오케스트레이터 독립 재실행으로 재확인).

**미해결(다음 세션 확인 필요)**: stage-qa-agent가 WORK-3 PRD AC("각 줄 옆에 수정 UI가 존재한다")가 헤더 단일 "수정" 링크(줄 전체 캔버스로 복귀)로는 문자 그대로 충족되지 않는다고 지적 — 이번 단계가 만든 gap이 아니라 오너가 이번 요청으로 확정한 단순화된 UX이므로, PRD AC 문구를 이 UX에 맞게 갱신할지 오너 확인 필요. 또한 design-agent가 지적한 `gap-[11px]`/`ProblemCard` `543px` 임의값 문제(§3.21에서 유입, 근거 주석 없음)를 Figma 재실측으로 해소할지 별도로 확인 필요.

### 3.23 Solve v2.0 5단계 RESUME(이어풀기) 1차+2차 — 완료 (2026-09-06~07, 미커밋)

1차(백엔드/타입: `LLMAdapter.resume()`, `POST /api/problems/:problemId/resume` SSE, `Diagnosis` 확장, `ResumeMode`/`ResumeRequest`/`ResumeSolution`/`ResumeStreamEvent` 타입) 완료 후, 프론트엔드에서 실제로 이 백엔드를 호출해 화면에 붙이는 2차 작업. design-agent Figma 실측(`255:87`/`255:92`/`255:96`/`255:98`) 기반 오너 승인 결정사항을 반영해 기존 목업 컴포넌트(`ResumeModeBar`/`ResumeResultCard`)를 재작성했다.

**구현 완료**:
- `shared/api/resumeProblem.ts`(신규) — `solveProblem.ts`와 동일한 SSE 스트리밍 클라이언트 패턴, `POST /api/problems/:problemId/resume`(body: `{ mode }`) 호출.
- `features/ai-solution/useResumeStream.ts`(신규) — `useSolveStream.ts`와 동일한 요청 세대 비교(stale 이벤트 무시) 패턴의 오케스트레이션 훅.
- `ResumeModeBar.tsx` 재작성: 바깥 glass pill 컨테이너 제거(`flex gap-[8px] items-start`), 두 버튼 `flex-1` 균등 2분할, 선택된 버튼은 `pill-primary`가 아니라 `pill-dark`(`bg-label-primary`) 사용. RESUME-4(`ownModeDisabled`)일 때 버튼 바로 아래 인라인 안내 문구("이 방법으로는 이어갈 수 없어요") 추가(별도 모달/배지 없음). 로컬 `ResumeMode` 타입 제거, `shared-types` 것으로 교체.
- `ResumeResultCard.tsx` 수정: 상단 라벨 색상 `accent-purple`→`accent-orange`, 내용 `"{모드 라벨} · {methodName}"`→`"이어풀기 · {모드 라벨}"`로 변경. `solution.methodName`을 15px Semibold 헤드라인 행으로 신규 표시(의미 재정의, 아래 참고). "검증됨" Badge 제거(Figma에 배지 없음 + CAS 스텁이 항상 true인 값을 배지로 보여주는 게 무의미하다는 오너 판단). 카드 패딩은 Figma 실측값(14/12px) 대신 기존 `ELEVATED_CARD_STYLE`(16/16px) 유지. 로컬 `ResumeSolution` 타입 제거, `shared-types` 것으로 교체.
- **`methodName` 필드명 유지 결정**: 오너가 "필드명 유지 vs `resumePointSummary` 리네이밍" 판단을 위임했다 — 리네이밍 시 이미 1차에서 구현·검증 완료된 백엔드 8개 파일(`fake-adapter.ts`/`openai-adapter.ts`/`parseResumeOutput.ts`/`prompts/system.ts`/각 테스트)을 함께 수정해야 해 회귀 리스크가 컸다. 필드명은 `methodName`을 그대로 유지하고 `shared-types`의 JSDoc만 "식별된 해법명"→"이어가는 지점 요약"(예: "3번째 줄부터 이어가기")으로 의미를 재정의했다. **후속 반영 완료(design-agent 사후 검수, 2026-09-06)**: 화면 연결 시점엔 `FakeLLMAdapter`/OpenAI 프롬프트가 새 의미에 맞춰 수정되지 않아 여전히 "완전제곱식"/"판별식" 같은 해법명을 채워 넣는 갭이 있었으나, 사후 검수 중 오케스트레이터가 `buildResumePrompt`(`prompts/system.ts`, "이어가는 지점을 요약하는 한 줄" 지시로 수정)와 `FakeLLMAdapter.resume()`(`"{lastValidLine+1}번째 줄부터 이어가기"`/`"새로운 방법으로 처음부터 풀기"`로 수정)을 직접 고쳐 갭을 해소했다. 더 이상 별도 백로그가 아니다.
- `AnswerBox.tsx`에 `tone?: "default" | "resume"` variant 추가(`tone="resume"`: `bg-brand-tint` + `rounded-[18px]` + `text-label-primary` + `Math/Shadow Rest` 5겹 그림자). 기존 `tone="default"`(V1.0 solve 결과)는 완전히 그대로 유지(회귀 없음, 신규 테스트 2건으로 확인).
- 신규 디자인 토큰 3종 문서화(`docs/DESIGN_TOKEN_MAP.md`, `docs/DESIGN_SYSTEM.md`): `brand/tint`(불투명 `#c3ccd9`, `--color-brand-tint` CSS 변수 신설) / `radius/18`(CSS 변수 없이 기존 `radius/14`와 동일하게 `rounded-[18px]` Tailwind 임의값으로 코드에 직접 표현 — 이 코드베이스는 반경에 별도 CSS 변수를 쓰지 않는 기존 관행) / `Math/Shadow Rest`(5겹 그림자, **레이어 색상 수치가 기존 `Elevation/Floating Bar`와 정확히 동일**해 그 Tailwind 클래스를 그대로 재사용).
- `ProblemInputContext.ts`/`ProblemInputProvider.tsx`: `resumeMode`/`resumeStatus`/`resumeStreamedText`/`resumeSolution`/`resumeErrorMessage`/`startResume`/`resetResume` 필드 추가. `startNewProblem()`/`beginReinput()`(Provider)과 `SolveLandscapePage`의 `handleEditWork`(페이지) 모두 `resetResume()`을 함께 호출하도록 갱신 — 새 문제 시작/재입력/WORK 복귀 시 이전 이어풀기 상태가 남지 않는다. 진단(diagnose) 성공 시 자동 트리거 없음(오너 확정) — 사용자가 `ResumeModeBar` 버튼을 직접 눌러야 `startResume()`이 호출된다.
- `SolveLandscapePage.tsx`: `isDiagnosisReady` 분기의 `<DiagnosisCard>` 바로 다음(Figma `253:53` Body 순서: 진단→이어풀기→추천 질문→관련개념)에 `<ResumeModeBar>` 마운트, `resumeStatus==="loading"`이면 `<LoadingMark>`, `resumeSolution`이 있으면 `<ResumeResultCard>`를 그 아래 마운트.
- 회귀/신규 테스트: `resumeProblem.test.ts`/`useResumeStream.test.tsx`(신규, FakeAdapter와 동일한 SSE 프레이밍으로 실제 스트리밍→상태 반영 검증), `ResumeModeBar.test.tsx`/`ResumeResultCard.test.tsx`/`AnswerBox.test.tsx`(변경사항 반영 갱신), `problemInputFlow.test.tsx`에 실제 라우터+`ProblemInputProvider` 통합 E2E 2건 추가(진단 성공→모드 선택→스트리밍→결과 카드 / `isMethodApplicable=false`→비활성+안내 문구). 기존 `diagnoseProblem` mock에 `identifiedMethod`/`isMethodApplicable`/`methodApplicabilityNote` 필드 보강(누락 시 `ownModeDisabled`가 항상 `true`가 되는 문제 수정).

**백로그(이번 범위 아님, 기록만)**:
- `AnswerBox.tsx`가 원래 인용하던 Figma 노드(`39:50`~`39:51`)가 design-agent 조회 결과 파일에 존재하지 않는 노드였다(`ActionBar`가 무효 노드를 인용했던 §3.17 사례와 동일 패턴) — 노드 인용만 제거했고 실제 동작/스타일 수정은 하지 않았다.

**stage-qa-agent 최종 회귀 테스트에서 HIGH 2건 발견 → 수정 → 재검증 STAGE PASS (2026-09-07)**:
RESUME-1~3(생성/연속성/무엇을·왜 서술)은 실제 라이브 OpenAI 어댑터 직접 호출로 검증까지 통과했으나, RESUME-4/5(둘 다 PRD P0)에서 구체적 결함이 발견됐다.
- **HIGH-1 (RESUME-4)**: `Diagnosis.methodApplicabilityNote`(LLM이 생성한 "적용 불가" 구체적 사유)가 `diagnose()`에서는 생성되지만 프론트 어디에서도 읽히지 않고, `ResumeModeBar`가 고정 문구만 보여주고 있었다. **수정**: `ResumeModeBar.tsx`에 `applicabilityNote?: string | null` prop 추가, 있으면 실제 사유를 보여주고 없으면 기존 고정 문구로 폴백. `SolveLandscapePage.tsx`가 `diagnosis.methodApplicabilityNote`를 전달.
- **HIGH-2 (RESUME-5)**: `SolveLandscapePage.tsx`가 `resumeSolution.verified` 값과 무관하게 성공 시 무조건 `ResumeResultCard`를 렌더링했다 — 지금은 CAS가 스텁이라 항상 true지만, 실제 CAS가 붙어도 검증 실패를 걸러내지 못하는 구조적 결함이었다. **수정**: `verified===true`일 때만 카드를 렌더링, `verified===false`면 기존 에러 Modal과 동일 패턴("이어풀기 검증에 실패했습니다", `onAction={resetResume}`로 재시도)을 노출.
- **MEDIUM (RESUME-4 서버 방어)**: 프론트 버튼 비활성화만으로 막고 있어 클라이언트가 검증을 우회해 `mode:"own"`을 직접 보내면 서버가 그대로 생성해줬다. **수정**: `resume.router.ts`의 `resolveResumeContext`가 `mode==="own" && !diagnosis.isMethodApplicable`이면 400(validation_error)으로 거부하도록 서버 측 방어 추가.
- **오너 결정(문서만)**: RESUME-4 PRD AC 문구("대안 해법으로 **자동 전환**하는 UI")가 실제 승인된 UX(학생이 "다른 방법으로"를 **직접 클릭**)와 달라, stage-qa-agent가 문서-구현 불일치로 지적 → 오너가 "현재(수동 선택) 유지, PRD 문구만 갱신"으로 결정 → `docs/PRD_WHYMATH.md` §4.7 RESUME-4 AC 문구를 실제 구현에 맞게 수정 완료(ID/P0 우선순위 유지).
- 3건 모두 development-agent 수정 → 오케스트레이터 독립 검증(코드 diff 직접 확인 + typecheck/lint/test/build 재실행) → stage-qa-agent 재검증. **최종 게이트**: api 304/304, web 392/392, build 성공. **stage-qa-agent 최종 판정: STAGE PASS.**

**work-order 5단계(RESUME) 전체 완료.** CAS는 여전히 스텁(`stubResumeCasCheck`, 항상 `verified:true`) — 실제 SymPy 서비스는 DIAG-1도 포함해 이 프로젝트 전체에서 아직 한 줄도 구현되지 않았고 work-order 어디에도 일정이 없다(오너 확인, 2026-09-07). 이번 단계 완료 후 별도로 "CAS 서비스 구축" 계획을 세워 오너에게 우선순위를 확인할 예정(아래 §6 참고). `listMethods`/다해법 목록 UI는 work-order 8단계(METHOD)로 이연.

### 3.24 CAS(Computer Algebra System) 실제 서비스 구축 — Phase 1 완료 (2026-09-07, 미커밋)

§3.23의 "CAS는 여전히 스텁" 후속. 오너 승인 하에 plan-agent가 구축 계획을 세우고, 범용 에이전트(general-purpose)가 구현했다(이 프로젝트의 `development-agent`는 React/TS 프론트엔드 전용이라 Python 백엔드에 쓸 수 없어 별도 에이전트로 진행).

**오너 승인 범위**: Phase 1(등식 변형 동치성 검사)만, 부등식 방향/미적분/수열은 **Phase 2로 명시적으로 연기**(다음 착수 전 반드시 오너 재승인 필요, 자동 진행 금지). 로컬 개발 환경까지만(배포 제외), CI 미통합(로컬 수동 스모크 테스트만). Python 3.12+uv+FastAPI, SymPy 내장 LaTeX 파서(`parse_latex`, lark 백엔드).

**구현 완료**:
- `services/cas/`(신규 최상위 디렉터리) — `POST /verify-work-lines`(DIAG-1), `POST /verify-final-answer`(RESUME-5), `GET /health`. Python 단위 테스트 32개(`pytest`)+`ruff` 클린.
- `Diagnosis`에 `problemAnswerLatex: string`(원 문제 정답, LLM이 diagnose 시점에 구조화된 LaTeX로 직접 생성 — DB 조인 없음, 기존 `conceptExplanations`/`identifiedMethod`와 동일 패턴) 필드 추가.
- `apps/api/src/infrastructure/cas/casClient.ts`/`resolveCasClient.ts`(신규) — `CAS_SERVICE_URL` 설정 시 실제 HTTP 호출, 미설정 시 기존 스텁(`stubCasVerification`/`stubResumeCasCheck`, 삭제하지 않고 폴백 경로로 존속)으로 자동 폴백. `diagnosis.router.ts`/`resume.router.ts`가 `LLMAdapter`와 동일한 방식으로 CAS 클라이언트를 주입받도록 수정.

**오케스트레이터가 검증 중 발견해 직접 수정한 버그 2건 (모두 "스텁 뒤에 숨어있다가 실제 CAS가 붙는 순간 드러나는" 유형)**:
1. **RESUME 최종 답이 자연어 문장이라 파싱 자체가 항상 실패**: `FakeLLMAdapter.resume()`의 `answerMd`가 `"최솟값은 -1입니다."`였는데, `parse_latex`는 순수 LaTeX만 파싱 가능하다 — 직접 Python으로 파싱 실패를 재현 확인. `CAS_SERVICE_URL`이 실제로 설정되는 순간 RESUME 결과가 정답이어도 항상 "검증 실패"로 뜨는 회귀였다. **수정**: `answerMd`를 `"-1"`(순수 LaTeX)로 변경, `buildResumePrompt`도 "## 최종 답" 아래 설명 문장 없이 순수 수식만 쓰도록 지시 명확화.
2. **stage-qa-agent 최종 회귀에서 추가 발견 — `\text{}`/`$...$` 등 흔한 LaTeX 관용구 파싱 실패**: 학생이 결론 줄에 `\text{최솟값은 } -1`처럼 자연어 주석을 섞어 쓰는 매우 흔한 패턴, 그리고 LLM/KaTeX가 흔히 쓰는 `$...$`/`\(...\)`/`\[...\]` 델리미터 둘 다 파서가 처리 못 해 "판정 불가"가 됐다. **수정**: `services/cas/app/core/parser.py`에 파싱 전 `\text{...}` 블록과 델리미터를 벗겨내는 전처리(`_strip_wrappers`) 추가.
3. **(2 수정 후 재발견) 극값 결론 자체는 여전히 오판정** — `y=(x-2)^2-1` 다음 줄에 "최솟값은 -1"이라고 쓰는 건 파싱 문제가 아니라 "$(x-2)^2 \geq 0$이므로 최솟값 -1"이라는 극값 추론이 필요한데 Phase 1의 단순 동치성 비교로는 판단 불가능했다. **오너 승인으로 Phase 1 범위를 소폭 확장**: `services/cas/app/core/equivalence.py`에 SymPy 내장 `minimum`/`maximum`(실수 전체 도메인)을 이용한 극값 비교(`_extremum_matches`)를 추가 — 임의의 최적화 로직을 새로 만들지 않고 SymPy 기존 유틸리티만 사용(과설계 금지 원칙 유지). 이 확장은 부등식 방향/미적분/수열 같은 Phase 2 항목과는 무관하다(Phase 2 범위 변경 아님).
- 위 3건 모두 오케스트레이터가 직접 코드 레벨로 재현(실패→수정→성공)한 뒤, 관련 Python/TS 테스트를 추가·갱신했다.

**최종 검증**: `FakeLLMAdapter` 기준 diagnose→resume(own/alternative) 전체 흐름을 실제 CAS HTTP 경로(mock 아님)로 재현 — 정답인 경우 `verified:true`, 오답/파싱불가인 경우 `verified:false`가 정확히 나뉘는 것을 확인. `CAS_SERVICE_URL` 미설정 시 기존 스텁 폴백도 회귀 없음. **게이트**: TS(typecheck/lint 전체, api 314/314, web 392/392, build 성공) + Python(`pytest` 32개, `ruff` 클린) 전부 통과. **stage-qa-agent 최종 판정: STAGE PASS**(1차 회귀에서는 CONDITIONAL PASS였으나, 위 2/3번 수정 후 재확인 완료).

**알려진 제약(다음 단계 참고)**:
- Phase 1은 "등식 변형 동치성 + 완전제곱식류 극값 결론 + 상수식 등식 값 비교(아래 후속 수정 참고)"만 판단 가능하다. 부등식 방향 반전/미적분(도함수·적분)/수열(점화식·일반항)은 Phase 2 — **오너 재승인 없이 절대 착수하지 않는다.**
- 배포(Render 등)는 이번 범위 밖, 로컬 개발 환경 전용.

**후속 수정(2026-09-07, 실기기 회귀에서 발견)**: 오너가 iPad 실기기에서 실제 OpenAI 어댑터로 테스트하던 중 정답을 맞혔는데도 "이어풀기 검증에 실패했습니다"가 뜨는 문제를 보고 — 이전 "알려진 제약"에 정확히 예고돼 있던 리스크(실제 OpenAI가 프롬프트 지시를 지키는지 미검증)가 실제로 발생한 것. stage-qa-agent가 실제 OpenAI 어댑터를 직접 호출해 라이브 재현한 결과, 원인은 프롬프트 미준수가 **아니라** CAS 동치 판정 로직의 범위 밖 케이스였다: `diagnose()`가 시그마 합 문제(`Σ(k=1~15)a_k=10`)의 정답을 "10"(순수 값) 또는 "Σ(k=1~15)a_k=10"(등식) 두 형태 중 하나로 확률적으로 생성하는데(8회 중 1회꼴), 후자가 나오면 기존 로직이 `symbol=value` 형태(좌/우변이 단일 `Symbol`)만 값 추출을 허용해서 `Sum(...)=10`처럼 좌변이 `Symbol`이 아닌 식이면 비교 자체를 포기하고 있었다. `resume()`의 최종 답 출력 자체는 8회 모두 순수 값으로 정상 — 문제는 CAS 쪽 판정 로직에만 있었다. **오너 승인 하에 `equivalence.py`에 소폭 확장 추가**: 등식의 한쪽이 자유 기호 없는 순수 상수이면(좌변이 `Symbol`이 아니어도) 그 값을 그대로 비교하도록 함(새 수학 계산 없이 이미 파싱된 상수값끼리만 비교, 완전제곱식 극값 확장과 동일 원칙). 실제 실패 케이스로 재현·수정·재검증 완료(`{"problemAnswerLatex":"\sum_{k=1}^{15}a_k=10","solutionAnswerLatex":"10"}` → 수정 전 `verified:false` → 수정 후 `verified:true`), 기존 시나리오(오답 거부/자연어 거부/완전제곱식 극값) 전부 회귀 없음 확인. **게이트**: Python `pytest` 35개(+4 신규), `ruff` 클린.

### 3.25 Solve v2.0 work-order 6단계 `HandwritingHighlightOverlay` 완료 (2026-09-07, 미커밋)

캔버스 위 "막힌 지점" 하이라이트 기능. plan-agent 2회(구조 조사 + 데이터 모델·대비책 구체화) + design-agent 2회(Figma 사전검토 + 사후검수) 걸쳐 진행했다.

**착수 전 발견된 선행 차단 이슈("발견 A")**: 진단 결과 화면(`/solve/landscape`)이 학생이 실제로 쓴 캔버스(`workStrokes`)를 전혀 보여주지 않고 INPUT 캔버스(`strokes`)만 보여주고 있었다 — 하이라이트를 얹을 대상 자체가 없었다. 오너 승인 하에 `isDiagnosisReady`일 때 캔버스+PenRail을 `workStrokes`/`workTool`/`undoWorkStroke`/`clearWorkStrokes` 등으로 함께 전환하도록 수정(하나만 바꾸면 캔버스와 지우개가 다른 버퍼를 참조하는 불일치 발생). **오너가 명시적으로 승인한 알려진 부작용**: 이제 진단 화면의 지우개/실행취소가 진단에 실제로 쓰인 원본 필기를 지울 수 있다(이전엔 죽은 버퍼에만 작동해 안전했음) — "그대로 둔다(간단)"로 승인, 버그 아님.

**데이터 모델(오너 승인, 클라이언트 휴리스틱 + 대비책)**: `apps/web/src/shared/lib/solve/deriveHighlightRegion.ts`(신규) — 스트로크를 배열 순서가 아니라 **최종 midY 오름차순**으로 정렬 후 y-gap 기준 클러스터링(지우고 다시 쓴 스트로크도 최종 화면 위치 기준으로 자연스럽게 재구성됨). 클러스터 수와 `WorkLine` 수 비교: 정확히 일치=`exact`(1:1 매핑), 1개 차이=`approximate`(인접 클러스터 병합으로 범위 확장), 2개 이상 차이=`null`(하이라이트 생략, 기존 `WorkLineList` 텍스트 목록만 표시 — 안전 우선). `diagnosis.stallLine===null`(중단형)이면 `null`. 대상 줄 `latex`에 `\frac` 포함 시 다음 클러스터 강제 병합(분수 등 지그재그 배치 대비). `LINE_GAP_THRESHOLD_PX=32`는 실기기 검증 전 잠정값으로 코드/문서에 명시.

**시각적 표현(design-agent Figma 실측, `38:21`의 자식 `258:452` "막힌 지점 하이라이트")**: `bg-fill-tint-red/60 rounded-[10px]`(기존 `--color-fill-tint-red` 20%에 60% 추가 감쇠 = 12%, Figma 실측 `rgba(201,123,110,0.12)`와 정확히 일치, 신규 토큰 없음). 가로 범위는 캔버스 전체 폭이 아니라 **매칭된 클러스터의 실제 x범위(내용 폭)만** — plan-agent의 최초 "전체 폭 밴드" 안을 Figma 실측 후 정정. `exact`/`approximate` 신뢰도는 시각적으로 구분하지 않음(Figma에도 단일 variant, 별도 표시가 오히려 위화감 유발한다는 판단).

`HandwritingHighlightOverlay.tsx`(신규) — `HandwritingCanvas.tsx` 내부는 전혀 수정하지 않고, 같은 좌표계를 공유하는 sibling으로 `HandwritingCanvas` 바로 앞에 배치(DOM 순서만으로 z-index 신규 정의 없이 레이어 순서 해결). `pointer-events-none aria-hidden="true"`.

**검증**: design-agent 사후검수 PASS(Low 참고 2건, 전부 이번 범위 밖 기존 구조). stage-qa-agent 최종 회귀 STAGE PASS — 실제 캔버스 전환·exact/approximate/null 세 경로·SOLVE 결과 화면 무회귀·"수정" 링크 무회귀를 전부 실제 렌더 테스트로 확인. **게이트**: typecheck/lint 전체, api 314/314(무변경), web 409/409, build 성공.

**알려진 제약(다음 단계 참고)**:
- `LINE_GAP_THRESHOLD_PX`는 실기기 검증 전 잠정값 — iPad 실기기 손글씨 줄 간격 실측 후 보정 필요.
- iPad 실기기(1194×834 가로/Split View) 하이라이트 밴드 렌더는 여전히 미검증(코드/좌표계 정합만 정적으로 확인).
- `isResultReady`/`isDiagnosisReady`가 이론상 동시에 true가 될 경우 캔버스-패널 불일치 가능성(design-agent 발견, 이번 work-order가 새로 만든 조건 아니고 기존 구조에 내재, 실사용 경로 도달 가능성 불확실 — 차단 사유 아님).
- `handleEditWork`("수정" 클릭)가 `diagnosis`를 null로 초기화한 직후 `navigate()`하는 동기 처리 사이 이론적 1프레임 창(스테이지 QA 발견, 실제 글리치/크래시 재현 안 됨, 가드/라우트 리다이렉트 위험 없음 — 우선순위 낮음).

### 3.26 Solve/Pencilcanvas — 사진 인식 확인 팝업(`RecognizedProblemPopup`) 완료 (2026-09-08, 미커밋)

오너가 Figma 변경(`3-1 Solve/Pencilcanvas_1` node `127:445`, 팝업 node `279:611`, `3-2 Solve/Pencilcanvas_2` node `267:607`)을 근거로 요청: 사진으로 문제를 인식하면 팝업으로 인식된 문제를 먼저 보여주고, "계속하기" 선택 시에만 `RecognizedChip`만 남은 WORK 캔버스로 전환해 풀이 쓸 공간을 확보한다. "디자인 변경에 관련된 부분만 수정, 이미 구현된 기능은 절대 변경 금지"가 명시적 전제였다.

**조사 결과(plan-agent+design-agent)**: `RecognizedChip`(3-2 WORK 단계 표시)은 이미 완성돼 있어 손댈 필요가 없었다 — 실제로 추가해야 하는 건 INPUT→WORK 전환 사이의 확인 팝업 게이트 하나뿐이었다. Figma 실측 결과 이 팝업(`Popup type="ProblemReg"`)은 사진 미리보기 없이 텍스트(캡션 "촬영한 문제"+인식 텍스트)만 담고, **필기 입력 전용 variant가 Figma에 없다** — 캡션 문구 자체가 "촬영한"이라는 사진 전제로 고정돼 있어, 오너 원문 "사진으로 문제를 인식하면"과 정확히 일치. 필기 입력은 이 팝업 없이 기존과 동일하게 즉시 WORK 전환된다.

**구현 완료**:
- `apps/web/src/pages/solve/pencilcanvas/SolvePencilcanvasPage.tsx` — 로컬 `isRecognizedPreviewOpen` state만 추가, 기존 렌더 블록 전체(캔버스/PenRail/ActionBar/로딩/에러 Modal)를 감싸는 조건 분기 하나만 씌움(내부 로직 무변경). `ProblemInputProvider`/`ProblemInputContext`의 `problemId`/`recognizedText`/`isWorkStage`/`recognizeOnly()` 등 기존 상태 관리는 전혀 건드리지 않음. `onNewProblem`에서도 팝업 상태를 함께 리셋.
- **버그 수정(development-agent가 스스로 발견)**: 최초 설계안은 `lastInputType === "photo"`로 사진 여부를 판단하려 했으나, `handleRecognize`의 클로저가 클릭 시점 값을 고정해버려(stale closure) 실제로는 직전 인식 결과의 값을 참조하는 버그가 있었다. `capturedImage !== null`(클릭 시점의 동기 스냅샷)로 대체 — `normalizeProblemInput.ts`가 `photoBlob` 유무로 `inputType`을 정확히 같은 기준으로 판단하는 것과 로직상 동일함을 오케스트레이터가 검증.
- `apps/web/src/shared/ui/modal/Modal.tsx`에 옵셔널 `content?: ReactNode`/`wide?: boolean` 슬롯 추가(additive-only) — 기존 로그인/회원가입/AUTH-9·10/에러 팝업 등 8곳 이상의 사용처는 두 prop을 전달하지 않아 픽셀 단위로 동일하게 렌더링됨(git diff로 확인). `wide`일 때만 폭 `690px`+이너 링 그림자 추가.
- `apps/web/src/features/solve-session/RecognizedProblemPopup.tsx`(신규) — `Modal`의 `wide`/`content` 슬롯으로 조립, 미리보기 카드는 `ProblemCard.tsx`와 동일한 `Elevation/Photo Card` 그림자 리터럴 재사용(새 값 발명 없음), Figma 실측대로 `w-[540px] max-w-full`(design-agent 사후검수에서 `w-full`로 과하게 넓던 것 발견해 수정), 긴 인식 텍스트 대비 `max-h-[50vh] overflow-y-auto` 추가(stage-qa-agent 발견 MEDIUM 즉시 반영).
- 테스트: `RecognizedProblemPopup.test.tsx`(신규), `cameraFlow.test.tsx`(사진 입력 인라인 시퀀스에 "계속하기" 클릭 추가), `problemInputFlow.test.tsx`는 필기 전용 헬퍼라 무변경(development-agent가 정확히 판단, stage-qa-agent가 코드+throwaway 렌더 테스트로 재확인).

**검증**: design-agent 사후검수 — Medium 1건(카드 폭) 발견·수정 후 최종 PASS. stage-qa-agent 최종 회귀 — 사진/필기 입력 흐름 전부 실제 라우터 기반 E2E로 재현(사진: 팝업→계속하기→WORK→봐주세요→RESULT까지, 필기: 팝업 없이 즉시 WORK), `Modal` 기존 13곳 사용처 무회귀, RESUME/CAS/캔버스 하이라이트 오버레이 등 이전 세션 완성 기능 전부 zero-diff 확인. **최종 STAGE PASS.** **게이트**: typecheck/lint 전체, api 314/314(무변경), web 412/412, build 성공.

**PRD 문구 갱신(오너 승인, 코드 아님)**: `docs/PRD_WHYMATH.md` WORK-1 AC의 "인식 확인 직후 캔버스 자동 표시"를 사진/필기 입력별로 실제 동작에 맞게 수정(사진: 팝업+계속하기 확인 후 표시, 필기: 자동 표시 유지). INPUT-3("인식 결과 확인 UI 존재")는 기존 AC 문구가 이미 포괄적이라 변경 없이 이번 팝업으로 그대로 충족.

**알려진 제약(다음 단계 참고)**:
- iPad 실기기(1194×834) 팝업 렌더/터치는 여전히 미검증(코드 검토만 수행).
- `Modal.tsx`의 icon 변형 콘텐츠 패딩(`pt-8 pb-6`)이 Figma 실측(`pt-[26px] pb-[20px]`)과 소폭 다름 — 이번 작업 이전부터 있던 기존 값이라 회귀는 아니며, 다음에 `Modal` 관련 작업 시 재검증 권장(design-agent 발견, Low).

### 3.27 Solve/Pencilcanvas WORK 단계 — `RecognizedChip` 모서리 + `ProblemCard` 은닉 버그 수정 (2026-09-08, 미커밋)

오너가 iPad 실기기 스크린샷으로 "문제 인식 후 화면이 Figma대로 적용 안 된 것 같다"고 지적(`3-2 Solve/Pencilcanvas_2` node `267:607` 참고). design-agent가 재실측해 실제 버그 2건을 확인:

1. **`RecognizedChip`(WORK 단계 상단 "인식됨" 칩)에 `rounded-full`이 잘못 적용됨** — Figma 원본 코드에는 모서리 반경 클래스가 전혀 없다(각진 사각형). 같은 화면의 `NavTabBar`/`PenRail`/`ActionBar`는 전부 `rounded-[999px]`(완전 pill)라 시각적으로 헷갈렸을 가능성. `rounded-full` 클래스 한 줄 제거로 수정.
2. **WORK 단계 진입 후에도 사진 미리보기(`ProblemCard`)가 안 사라짐** — `SolvePencilcanvasPage.tsx`의 렌더 조건에 `isWorkStage` 체크가 누락돼 있었다(`capturedImage`는 `recognizeOnly()` 성공 후 정리되지 않고 `solve()` 성공 시에만 정리되는 게 의도된 동작이라, 사진으로 입력한 경우 WORK 진입 후에도 `ProblemCard`가 `RecognizedChip`과 함께 계속 렌더되고 있었다). Figma `267:607`에는 입력 방식 무관하게 `RecognizedChip`만 있어야 한다 — 조건문에 `!isWorkStage` 가드 추가로 수정.

design-agent 사후검수 PASS(Figma 재조회로 두 수정 모두 정확히 일치 확인, 신규 색상/픽셀값 없음, diff가 정확히 지적된 부분뿐임을 확인). stage-qa-agent 최종 회귀 STAGE PASS(사진/필기 입력 흐름 실제 E2E 재현, INPUT 단계 사진 미리보기 무회귀, RESUME/CAS/캔버스 하이라이트 오버레이/`RecognizedProblemPopup` 등 어제까지 완성된 기능 전부 zero-diff 확인). **게이트**: typecheck/lint 전체, api 314/314(무변경), web 414/414, build 성공.

**알려진 제약**: iPad 실기기에서 실제로 각진 모서리로 보이는지, `ProblemCard` 제거 후 레이아웃 흔들림이 없는지는 jsdom 한계로 미검증(오너의 원래 지적이 실기기 스크린샷 기반이었으므로 실기기 재확인 권장).

### 3.28 Solve 화면 3건 요청 — ActionBar 개념설명 철회 + WORK 캔버스 손가락 스크롤 완료 (2026-09-08, 미커밋)

오너가 Figma 참고 3건을 한 번에 요청(§3.27과 별개 요청, 각각 표준 루프로 순차 처리):

1. **(§3.27로 완료)** WORK 단계 화면 미적용 — `RecognizedChip` 모서리, `ProblemCard` 은닉 버그.
2. **ActionBar에 "개념설명" 세그먼트 추가 — 철회.** Figma node `267:615` 실측 결과 "개념설명"이 4단계(INPUT/WORK-전/WORK-후/RESULT) 전부에 4번째 세그먼트로 항상 활성 상태로 추가되는 것으로 확인됐으나, 구현 조사 중 (a) 진단 전 개념설명을 위해 `solve({concept:true})`를 호출해도 백엔드가 최종 답을 응답에 함께 생성해 정답이 네트워크로 노출되는 문제, (b) INPUT 단계 클릭 시 자동으로 문제 인식이 트리거되는 부수효과, (c) 풀이 경로(ResultPanel) RESULT 단계의 신규 분기 필요 등 여러 결정 필요 항목이 드러났다. 오너가 "복잡해지고 회귀 위험이 있다"고 판단해 **명시적으로 철회** — 기존에 이미 구현된 결과 화면 채팅창 위 해시태그 방식("#개념설명" 클릭 → `isConceptCardVisible` 토글)만 유지하기로 확정. **코드 변경 없음. 향후 세션에서 이 기능을 다시 제안하지 말 것.**
3. **WORK 캔버스 손가락 스크롤 완료(PRD WORK-6, P1).** 학생이 WORK 캔버스에 풀이를 쓰다 공간이 부족하면 손가락 1개/2개로 스크롤해 캔버스를 확장할 수 있다. `apps/web/src/features/drawing-canvas/HandwritingCanvas.tsx`에 옵셔널 `scrollable?: boolean`(기본 `false`) prop 추가 — **`/solve/pencilcanvas`의 WORK 단계 캔버스 1곳에만 적용**하고, INPUT 캔버스와 `/solve/landscape`의 캔버스(어제 완성된 `HandwritingHighlightOverlay` 포함)는 전혀 건드리지 않아 회귀 위험을 원천 차단(오케스트레이터 결정, 오너 승인).
   - **핵심 안전장치**: 펜으로 그리는 중이 아닐 때 시작된 터치만 스크롤 후보로 등록(`activePointerIdRef.current === null` 게이팅), `touch-action:none` 유지 + JS로 직접 `scrollTop` 구동(전략 2, 실기기 브라우저 예외처리에 의존하지 않는 결정론적 방식). 학생 필기가 콘텐츠 하단 85%에 닿으면 뷰포트 높이만큼 동적 확장(상한 없음, 오너 승인). Figma에 스크롤 시각 힌트가 없어 새 안내 UI를 추가하지 않고 순수 제스처+네이티브 인디케이터에만 의존.
   - **design-agent 사후검수 중 HIGH 결함 발견·즉시 수정**: 손바닥(터치)이 펜보다 먼저 닿아 스크롤 후보로 등록된 뒤 펜이 그리기 시작하면(자연스러운 필기 자세에서 흔한 순서), 게이팅이 "등록 시점"에만 확인해 이후 펜이 그리는 도중에도 그 손바닥 이동이 스크롤을 유발하는 결함 — `handleScrollTouchMove` 진입 시점에 `activePointerIdRef.current !== null`이면 즉시 반환하는 재확인 게이트를 추가해 등록 순서와 무관하게 항상 차단하도록 수정, 역전 순서 재현 테스트 추가.
   - stage-qa-agent가 병렬 검수 타이밍상 수정 전 코드로 동일 결함을 최초 재현(HIGH, CONDITIONAL PASS) → 오케스트레이터가 수정 완료 사실과 정확히 일치하는 회귀 테스트 통과를 근거로 재검증 요청 → stage-qa-agent가 최신 코드로 직접 재현·재확인 → **최종 STAGE PASS**.
   - **게이트**: typecheck/lint 전체, api 314/314(무변경), web 422/422, build 성공.

**알려진 제약(다음 단계 참고)**:
- iPad 실기기 전용 미검증 항목: 실제 Apple Pencil 호버 시 iOS 네이티브 팜 리젝션과 이번 수동 스크롤 로직의 상호작용, 실제 1/2손가락 스크롤 체감, 터치가 스크롤 중 캔버스 밖(예: `PenRail`)으로 벗어날 때 `setPointerCapture` 미적용으로 인한 제스처 중단 가능성(MEDIUM, 코드 리뷰 기반 가설, jsdom으로 재현 불가), 1194×834 가로/좁은 Split View에서의 실제 시각적 레이아웃과 캔버스 확장 동작.
- 캔버스 콘텐츠 확장에 상한이 없음(오너 승인, 극단적으로 긴 풀이에 대한 메모리/성능 부하는 미검증).

### 3.29 `/solve/landscape` 결과 화면 — 사진 미리보기 완전 은닉 (§3.22 결정 번복, 2026-09-08, 커밋 `1f8e6d4`)

오너가 §3.22의 "사진 입력이면 결과 화면에서도 사진 유지" 결정을 iPad 실기기에서 실제로 확인한 뒤 번복 — WORK 단계의 작은 "인식됨" 표시에서 결과 화면의 큰 사진 카드로 갑자기 바뀌는 게 퇴보처럼 느껴진다고 지적. **새 결정: 결과 화면에서는 입력 방식(사진/필기) 및 결과 경로(WORK-4 solve / SOLVE-2 diagnose)와 무관하게 사진을 완전히 숨긴다.**

design-agent가 Figma `38:21`(3-2 Solve/Landscape)을 재조회한 결과 이 프레임에 `Problem Card` 인스턴스 자체가 없음을 확인 — 이번 변경은 원래 Figma 설계로 되돌리는 것에 가깝다. 부수적으로 이 프레임의 캔버스 좌상단에 WORK 화면과 동일한 작은 `Recognized Chip` 인스턴스가 있다는 것도 새로 발견했으나(`docs/COMPONENT_MAP.md`에 미반영), 오너가 "이번엔 사진 숨김만, 칩 추가는 다음에"로 범위를 분리해 이번 작업에는 포함하지 않았다.

**구현**: `apps/web/src/pages/solve/landscape/SolveLandscapePage.tsx`의 `ProblemCard` 렌더 조건을 `problemCardData !== null`에서 `problemCardData !== null && "needsRetake" in problemCardData`로 변경 — `problemCardData`가 `{needsRetake:true} | {imageUrl:string} | null` 유니언이므로, 사진 미리보기(`{imageUrl}`) 케이스만 로딩/성공 상태와 무관하게 완전히 제거되고 "수정" 흐름의 재촬영 안내(`{needsRetake:true}`) 케이스는 그대로 유지된다. **`isResultReady`/`isDiagnosisReady`를 직접 부정하는 조건은 의도적으로 쓰지 않았다** — 그렇게 하면 로딩 중(`isSubmitting`) 구간에는 여전히 사진이 남아 있어 오너가 지적한 문제(진입 직후 큰 카드가 잠깐 보였다 사라짐)가 절반만 해결되기 때문(design-agent 발견).

`RecognizedProblemBar`(결과 패널 바디 내부 텍스트 기반 인식 표시)는 전혀 손대지 않았다 — 계속 정상 노출.

**검증**: design-agent 사후검수 PASS. stage-qa-agent 최종 회귀 STAGE PASS — 사진 입력 두 경로(WORK-4/solve, SOLVE-2/diagnose) 모두 로딩·완료 전 구간에서 사진이 전혀 안 보이는 것을 실제 E2E로 재현(기존 테스트에 없던 "사진+진단" 조합은 임시 E2E로 직접 닫고, 수정 전 조건으로 되돌려 실패 재현 후 원복하는 방식으로 비어있지 않은 검증임을 확인). "수정"/재촬영 안내 흐름, `RecognizedProblemPopup`/WORK 단계 수정(§3.27)/캔버스 스크롤(§3.28)/RESUME/CAS/캔버스 하이라이트 오버레이 전부 zero-diff 무회귀 확인. **게이트**: typecheck/lint 전체, api 314/314(무변경), web 422/422, build 성공.

**알려진 후속 항목(비차단, 다음 정리 작업 권장)**:
- `ProblemInputProvider.tsx`의 `submitProblem`/`giveUp`/`diagnose`가 `lastInputType==="photo"`일 때 `clearCapturedImage()`를 스킵하는 로직(§3.22에서 도입)의 근거 주석("결과 화면에 사진을 계속 보여줘야 하므로")이 이번 변경으로 더 이상 사실이 아니게 됐다 — `capturedImage`를 이 페이지에서 소비하는 곳(`problemCardData`의 `imageUrl` 분기)이 없어졌기 때문. 기능/테스트/빌드에는 영향 없지만, 다음 세션에서 이 스킵 로직을 제거하거나 주석을 갱신할 것(design-agent 발견, MEDIUM 비차단).
- Figma `38:21`에서 발견된 캔버스 좌상단 `Recognized Chip` 인스턴스를 `/solve/landscape`에도 추가할지 — 오너 확인 후 별도 작업.
- iPad 실기기 시각 확인 미검증(이번 변경 자체가 실기기 확인 결과를 반영한 것이라 로직 검증으로 충분하다고 판단되나, 여백/레이아웃 흔들림은 재확인 권장).

### 3.30 `SolveScroll` — WORK 캔버스 스크롤 인디케이터 (2026-09-08, 커밋 `33215c5`)

오너가 Figma `Solve Scroll (Step=First)`(node `302:167`)를 근거로 `/solve/pencilcanvas` WORK 단계 캔버스(§3.28 손가락 스크롤)에 시각적 스크롤 인디케이터를 요청. 마커 4개가 스크롤 가능 범위의 0/33/66/100% 지점을 가리키며, 펜으로 탭하면 그 비율 위치로 캔버스가 프로그래매틱하게 스크롤된다(오너 확정: 고정 4단계, 비율 매핑).

**구현**: 신규 `apps/web/src/features/drawing-canvas/SolveScroll.tsx` — 64×252, PenRail 바로 아래 16px gap·x축 중심 정렬. `HandwritingCanvas.tsx`를 `forwardRef`+`useImperativeHandle`로 확장해 `scrollToRatio(ratio)`/`isPenActive()`를 노출(순수 추가, `scrollable=false` 기존 사용부는 byte-identical no-op). `SolvePencilcanvasPage.tsx`는 `PenRail.tsx` 자체를 수정하지 않고 스타일 없는 측정용 wrapper(`penRailBoxRef`)로 감싸 `useLayoutEffect`+`ResizeObserver`로 실제 렌더링 위치를 읽어 배치(세로/가로 모드 전환 대응).

**Figma 실측 재확인 과정에서 발견한 3가지 미정 항목은 오너 결정으로 해소**: (1) 마커 개수는 콘텐츠 길이와 무관하게 고정 4개, (2) 힌트 카드 모서리(4px)/텍스트(9.5px)는 기존 토큰(`rounded-[6px]`, Caption 12px 패턴)으로 근사, (3) PenRail-SolveScroll 간격은 오너가 Figma에서 직접 조정 후 재실측(16px로 최종 확정, 도트 트랙 높이만 234→252로 변경, 마커 개수는 4개로 불변).

**design-agent 사후검수에서 실제 버그 5건 발견·직접 수정**(재실측 오류): 좌표 15px 오프셋 누락, 트랙/미선택 마커 색상 토큰 오류, **미선택 마커에 `border` 두께 클래스 자체가 없어 실제로 화면에 전혀 안 보였을 High급 결함**, 선택됨 마커 3겹 원 구조 중 글래스 레이어 누락, 힌트 카드 그림자 누락. 전부 코드로 직접 확인·재검증.

**검증**: development-agent 구현 → orchestrator 독립 재검증(4게이트+diff 리뷰) → design-agent 사후검수(버그 발견·수정, 재검증) → orchestrator 재검증 → stage-qa-agent **STAGE PASS**(신규 `SolveScroll.test.tsx` 4개 테스트 비공허성 확인, `HandwritingCanvas.test.tsx` 팜 리젝션 회귀 없음, `PenRail.tsx`/`/solve/landscape`/`HandwritingHighlightOverlay.tsx` zero-diff 확인). **게이트**: web typecheck/lint/test 426/426/build 전부 통과. iPad 실기기 시각 확인은 미검증(NOT VERIFIED, 물리 기기 필요).

### 3.31 `RecognizedChip` 확장 — WORK 단계 인식 카드 좌측 확대 (2026-09-08, 커밋 `33215c5`)

오너가 Figma `267:607`의 확장 인스턴스 오버라이드(316×230)를 근거로 WORK 단계 인식 카드를 확장 가능하게 요청. 트리거는 칩 자체 탭이 아니라 별도 확장 버튼, 축소 상태는 기존 위치(화면 상단 중앙) 유지, 확장 시에만 PenRail 우측으로 이동, 사진 입력이면 확대 이미지·필기 입력이면 인식 텍스트 전체 표시(모두 오너 확정).

**구현**: `RecognizedChip.tsx`에 `isExpanded`/`onToggleExpand`/`imageUrl` props와 chevron 토글 버튼 추가. `SolvePencilcanvasPage.tsx`는 §3.30에서 만든 PenRail 위치 측정 패턴(`penRailBoxRef`)을 재사용해 PenRail 우측 좌표(`recognizedChipLeft`)를 계산하고, 확장 상태만 별도 오버레이 컨테이너로 그 위치에 배치(캔버스 폭 영향 없음). `lastInputType`/`capturedImage`를 배선해 사진/필기 입력을 분기.

**design-agent 사후검수에서 실제 버그 4건 발견·직접 수정**: (1) **HIGH — PRD 접근성 요구사항(최소 터치 타깃 44px, `docs/PRD_WHYMATH.md` §"접근성") 위반** — 토글 버튼이 18×18px에 불과해 `-inset-[13px]`로 실제 탭 영역을 44×44px까지 확장(시각 아이콘 크기는 18px 유지), (2) HIGH — 확장/축소 시 칩과 카드가 서로 다른 DOM 위치에 조건부 렌더링돼 토글마다 포커스가 `document.body`로 유실 — `autoFocusToggle` prop으로 사용자가 토글을 누른 경우에만 새 버튼에 포커스 이전, (3) MEDIUM — 확장 카드 고정폭(316px)이 좁은 Split View에서 뷰포트를 벗어날 위험 — `max-w-[calc(100vw-32px)]` 안전장치 추가, (4) LOW — Figma에 없는 chevron 아이콘값을 "결정 필요"로 문서화.

**stage-qa-agent 1차 검증에서 추가 MEDIUM 버그 1건 발견**(자체 임시 테스트로 실제 재현 후 즉시 삭제): `autoFocusToggle`을 켜는 `shouldAutoFocusChipToggle` state가 WORK 단계를 벗어나도 리셋되지 않아, 이후 완전히 무관한 새 문제의 WORK 단계 첫 진입 시에도 토글 버튼이 포커스를 가로채는 경로가 있었음(CONDITIONAL PASS). development-agent가 기존 리셋 블록에 한 줄 추가로 수정, 신규 회귀 테스트(`SolvePencilcanvasPage.test.tsx`, 이 페이지 최초의 컴포넌트 테스트) 추가. stage-qa-agent가 수정 전 코드로 되돌려 실패 재현 후 원복해 통과를 독립 확인.

**검증**: development-agent 구현 → orchestrator 독립 재검증 → design-agent 사후검수(버그 4건 발견·수정) → orchestrator 재검증 → stage-qa-agent 1차 CONDITIONAL PASS(MEDIUM 1건) → development-agent 수정 → orchestrator 재검증 → stage-qa-agent 재검증 STAGE PASS. **게이트**: web typecheck/lint/test 435/435/build 전부 통과. `PenRail.tsx`/`SolveScroll.tsx`/`HandwritingCanvas.tsx`/`/solve/landscape` zero-diff 확인(§3.30과 파일 겹침 없음). iPad 실기기 시각 확인은 이 시점까지 미검증.

**실기기 확인 후 후속 수정 (2026-09-08, 같은 날 재확인)**: 오너가 iPad에서 실제 테스트 중 4가지 문제 보고 — (1) `SolveScroll` 전혀 안 보임, (2) `RecognizedChip` 확장 위치가 PenRail 옆으로 이동 안 함, (3) 토글 chevron 방향이 반대로 보임, (4) 토글(접기) 시 인식 카드 영역 전체가 사라짐. `Stage-qa-agent`를 활용해 재점검하되 "검증 안 되면 다시 확인해달라 하지 말라"는 오너 지시에 따라 실제 헤드리스 브라우저(Playwright, Chromium+WebKit/iPad 프로필)로 직접 재현·검증:

- 이 세션 내내 켜져 있던 dev 서버(수많은 구조적 변경 — `forwardRef` 전환 등 — 을 거친 HMR 상태)를 근본 원인 후보로 보고 완전 재시작(`apps/api`/`apps/web` kill 후 fresh 기동).
- 재시작된 서버 대상 실제 회원가입→로그인→학년설정→필기→실제 OpenAI 인식→WORK 단계→확장→축소 전체 E2E를 Chromium/WebKit(Safari 엔진, iPad Pro 11" 랜드스케이프+터치 프로필) 각 1회씩 독립 실행 — **4가지 증상 전부 재현 안 됨**(`SolveScroll`은 `PenRail.bottom+16px`에 정확 위치, 확장 카드는 `PenRail.right+16px`로 정확 이동, 축소해도 사라지지 않음, chevron 방향은 코드 설계대로 정상). 근본 원인은 오래된 dev 서버의 HMR 누적 상태였을 가능성이 높다고 결론.
- 별도로 오너의 실제 스크린샷(8줄 분량 수능형 수열 문제)을 직접 재확인하는 과정에서 진짜 결함 1건을 새로 발견: `RecognizedChip.tsx`의 배지+텍스트+토글을 감싸는 행이 `items-center`였는데, 인식 텍스트가 여러 줄로 감싸질 때 배지/토글 버튼이 전체 문단 높이의 중앙(문단 중간)에 위치하는 버그. `items-start`+`mt-[1px]` 베이스라인 보정으로 수정.
- 이 수정을 실제 8줄/398자 분량의 긴 텍스트로 Playwright 재검증(`page.route`로 recognize 응답의 `recognizedText`만 실제 긴 문제로 치환, 1194×834/1024×768 두 뷰포트) — 배지/토글이 첫 줄에 정확히 정렬됨을 좌표 실측 확인, `SolveScroll`이 긴 카드에 가려지지 않음을 `document.elementFromPoint()` 히트테스트로 구조적으로 확인(SolveScroll은 화면 좌측 고정, 인식 카드는 중앙 고정폭 컬럼이라 겹칠 수 없음). orchestrator가 스크린샷을 직접 열어 육안으로도 재확인.
- `RecognizedChip.test.tsx`에 `items-start` 회귀 테스트 추가(stage-qa-agent가 "이 수정을 고정하는 자동 테스트가 없다"고 지적한 LOW 항목 반영).
- **최종 stage-qa-agent 재검증 STAGE PASS**: 코드 diff가 `RecognizedChip.tsx`/`.test.tsx`에만 있음을 재확인(`PenRail.tsx` 무변경, mtime 한 달 전), 실제 컴파일된 CSS(`dist/assets/index-*.css`)를 직접 grep해 `border`/`border-brand`/`mt-[1px]` 등 클래스가 정상 컴파일됨을 아티팩트 레벨로 재확인, 게이트 web 436/436 재실행 통과.
- **알려진 비차단 사항(§3.32에서 구조 자체를 재작업함)**: `useLayoutEffect`/`ResizeObserver` 기반 위치 측정은 PenRail의 "크기" 변화에는 반응하지만 "위치만" 바뀌는 경우(예: 향후 다른 형제 요소가 리사이즈 이벤트 없이 레이아웃을 밀어내는 경우)에는 재측정 트리거가 없는 구조적 약점이 이론상 존재 — 현재는 재현되는 트리거가 없어 비차단으로 기록. iPad 실기기 최종 확인은 오너 몫으로 남음.

> **§3.32에서 대체됨**: 오너가 iPad 실기기에서 "PenRail+SolveScroll 그룹이 화면 중앙에 와서 잘림", "RecognizedChip이 처음부터 왼쪽 고정이어야 하는데 위 §3.31 방식(축소=중앙, 확장=PenRail 우측)이 적용 안 됨"을 재차 보고 → PenRail 자체 위치 지정 + `autoFocusToggle` 포커스 유지 메커니즘 전체를 폐기하고 그룹 컨테이너화 + 위치 고정으로 재작업했다. 아래 §3.32 참고.

### 3.32 PenRail+SolveScroll 그룹화 + `RecognizedChip` Figma 정식 컴포넌트 반영 (2026-09-08, 커밋 `33215c5`)

오너가 iPad 실기기에서 §3.30/§3.31 결과물을 테스트한 뒤 두 가지를 재요청: (1) PenRail+SolveScroll 그룹 위치가 화면 중앙에 와서 잘림, (2) `RecognizedChip`을 Figma에 새로 만든 정식 컴포넌트(node `310:1498`, 접힘 인스턴스 `250:56`/펼침 인스턴스 `310:1499`)로 다시 구현하고 "축소=중앙/확장=PenRail 우측"이 아니라 "처음부터 PenRail 그룹 우측에 고정, 펼쳐도 위치 불변"으로 변경.

**근본 원인(PenRail+SolveScroll)**: `PenRail`이 자체 CSS(`absolute top-1/2 left-5 -translate-y-1/2`)로 화면 세로 중앙에 위치하고, `SolveScroll`은 그 실제 렌더링 위치를 측정해 아래 16px에 배치하는 구조였다 — PenRail *혼자만* 중앙에 오고 SolveScroll이 그 아래로 늘어지는 형태라 뷰포트가 짧으면 SolveScroll이 화면 밖으로 잘렸다.

**구현**: `PenRail.tsx`에 `positioned?: boolean`(기본 `true`, 하위 호환) 옵트인 prop 추가 — `false`면 위치 클래스만 빠지고 나머지 스타일은 유지. INPUT 단계/`/solve/landscape` 3개 호출부는 prop 생략으로 기존과 byte-identical(design-agent·stage-qa-agent 각각 `git diff`로 확인). WORK 단계에서만 `positioned={false}`로 렌더링하고, 페이지가 만든 그룹 컨테이너(`absolute top-1/2 left-5 z-10 -translate-y-1/2 flex flex-col gap-4`) 하나에 PenRail+SolveScroll을 함께 넣어 그룹 전체를 세로 중앙 정렬 — 기존 `penRailBoxRef`+PenRail 위치 측정 로직은 제거.

`RecognizedChip`은 Figma 정식 컴포넌트 실측(400×38 접힘/400×122 펼침, `rounded-[14px]`·1줄 ellipsis는 오너 결정) 기준으로 재구현하고, 이중 컨테이너(축소=중앙, 확장=PenRail 우측)를 하나로 통합해 **처음부터 PenRail 그룹 우측(`recognizedChipLeft`, 그룹 컨테이너의 `getBoundingClientRect().right+16px`)에 고정** — `isExpanded` prop만 크기/내용 전환에 씀. 위치가 더 이상 안 바뀌므로 §3.31의 `autoFocusToggle`/`shouldAutoFocusChipToggle` 포커스 유지 메커니즘 전체를 삭제했다(같은 DOM 위치를 유지해 포커스가 자연히 보존됨).

**development-agent가 구현 중 발견·수정한 타이밍 버그**: 사진 입력은 `problemId`가 채워져 `isWorkStage`가 `true`가 되는 시점에 "문제가 인식되었습니다" 팝업이 함께 뜨는데, 팝업이 열려 있는 동안은 PenRail 그룹 자체가 DOM에 없어 `useLayoutEffect`의 최초 실행이 실패하고, `isWorkStage`만 의존성 배열에 있으면 팝업이 닫혀 그룹이 마운트돼도 재실행되지 않아 `recognizedChipLeft`가 영원히 `null`로 남는 문제 — 의존성 배열에 `isRecognizedPreviewOpen` 추가로 수정.

**design-agent 사후검수에서 실제 버그 3건 추가 발견·직접 수정**(Figma `310:1498` MCP 재조회 기반):
1. **HIGH — 접힘 상태 컨테이너에 폭 제약이 전혀 없어 1줄 말줄임(`truncate`)이 실제로는 전혀 동작하지 않던 결함** — `flex-1 truncate` 텍스트가 부모 flex 트랙 폭을 콘텐츠 크기만큼 늘려버림. `w-[400px] max-w-[calc(100vw-32px)]`를 접힘 상태에도 추가. 기존 테스트는 클래스 존재만 확인해 이 결함을 못 잡았음(테스트도 함께 강화).
2. **HIGH — 펼침 카드 치수가 존재하지 않는 노드(`267:607`) 근거로 `316×230`을 쓰고 있던 것을 실제 정식 컴포넌트 실측(400px, 높이는 hug)으로 정정.**
3. **MEDIUM — 정적 `max-w-[calc(100vw-32px)]`가 실제 배치 x좌표(PenRail 그룹 우측의 가변 위치)를 반영 못해 좁은 Split View에서 여전히 밀려날 수 있었음** — `RecognizedChip`에 `maxWidthPx?: number | null` prop 추가, 페이지가 `groupRect.right` 기준 실제 남은 폭(최소 160px 하한)을 계산해 전달.

**검증**: development-agent 구현(타이밍 버그 자체 발견·수정) → orchestrator 독립 재검증 → design-agent 사후검수(버그 3건 발견·수정) → orchestrator 재검증 → stage-qa-agent **STAGE PASS**. **게이트**: web typecheck/lint/test 440/440/build 전부 통과. `PenRail.tsx` 하위 호환 3곳 byte-identical 확인, `/solve/landscape`·`HandwritingHighlightOverlay.tsx` zero-diff 확인, `HandwritingCanvas.tsx`/`SolveScroll.tsx`의 diff는 별도 동시 work-order(§3.30) 소관이며 이번 변경과 섞이지 않음(grep으로 PenRail/RecognizedChip 관련 코드 0건 확인). iPad 실기기 최종 시각 확인은 미검증(NOT VERIFIED, 물리 기기 필요) — 다만 오너가 보고한 두 구조적 원인(그룹 중앙정렬 분리, 위치 이동에 따른 포커스 유실)은 코드 레벨로 해소됨.

> **RecognizedChip 위치는 §3.33에서 다시 원복됨**: 오너가 iPad 실기기에서 "PenRail 그룹 우측 고정"을 확인한 뒤 왼쪽 치우침을 이유로 철회, 화면 상단 중앙(Figma 실측 확인)으로 되돌렸다. PenRail+SolveScroll 그룹화(잘림 방지) 자체는 §3.33에서도 그대로 유지된다.

### 3.33 `RecognizedChip` 화면 상단 중앙 위치 원복 + 1줄 말줄임 실제 동작 수정 (2026-09-09, 커밋 `33215c5`)

오너가 §3.32의 "RecognizedChip을 PenRail 그룹 우측에 고정" 결과물을 iPad 실기기에서 확인한 뒤 두 가지를 재보고: (1) 칩이 화면 왼쪽으로 치우쳐 보기 이상함 — "왼쪽 고정" 요구사항을 철회하고 Figma에 실제 디자인된 화면 상단 중앙 배치로 되돌려달라(확장 시 사진 노출 기능은 유지), (2) 긴 인식 텍스트에서 1줄 말줄임(ellipsis)이 동작하지 않고 텍스트가 박스 밖으로 삐져나감.

**Figma 재확인**(`267:607`/`38:21` 두 프레임 모두 fileKey `ltyPrCk8UT8DsB3tFuw7Sr`): `Solve`(RecognizedChip) 인스턴스가 두 프레임에서 정확히 동일한 좌표(x=400, y=98, w=400, h=38, 1194×834 프레임 기준)로 화면 상단 중앙에 배치돼 있음을 확인 — 중앙 배치가 확정 스펙. y=98px과 이 페이지 다른 상단 요소가 공유하는 `top-[90px]` 사이 8px 차이는 시각적 일관성을 위해 `top-[90px]`을 그대로 쓰기로 하고 "결정 필요"로 주석에 남김(오너 재확인 전까지 비차단).

**ellipsis 버그 근본 원인**: `RecognizedChip.tsx`에서 배지+텍스트+토글을 감싸는 중간 `<div className="flex items-start gap-[8px]">`가 바깥 고정폭(`w-[400px]`) 컨테이너의 유일한 자식인데, flex item 기본값(`flex-grow:0`)이라 부모의 고정폭을 채우도록 강제되지 않고 콘텐츠(뱃지+전체 텍스트+토글) 크기만큼 늘어날 수 있었다. 안쪽 `<p>`의 `min-w-0 flex-1 truncate`는 "이 row 안에서"는 줄어들 수 있게 할 뿐, row 자체가 무한정 넓어지는 것은 막지 못해 400px 박스를 넘어 텍스트가 삐져나갔다 — `w-full`을 이 중간 row에 추가해 해결(`ProblemCard.tsx`의 기존 `w-full flex-col` 컨벤션과 동일 패턴, 임의 도입 아님).

**이번 라운드 프로세스 특이사항**: 오너가 design-agent에 코드 수정까지 요청했으나, 이번 design-agent 인스턴스는 `CLAUDE.md`의 "읽기 전용 검수" 역할 정의를 근거로 코드 수정을 거부하고 Figma 재조회+코드 추적으로 정확한 근본 원인과 수정 지시만 리포트했다(이전 여러 라운드에서는 사후검수 중 design-agent가 직접 코드를 고쳤던 것과 다른 판단 — 세션 내 일관성 차이로 기록). orchestrator가 이 리포트를 그대로 development-agent에 정확한 지시로 전달해 구현했다.

**구현**: `SolvePencilcanvasPage.tsx`의 `recognizedChipLeft`/`recognizedChipMaxWidth` state와 PenRail 그룹 우측을 측정하던 `useLayoutEffect`를 완전히 제거하고, RecognizedChip 컨테이너를 `ProblemCard`/`EmptyStateHint`가 쓰는 것과 동일한 `absolute inset-x-0 top-[90px] z-10 mx-auto w-[400px] max-w-[calc(100%-3rem)]` 패턴으로 교체(렌더 조건도 `isWorkStage && recognizedText`로 단순화, `recognizedChipLeft !== null` 절 제거). `RecognizedChip`의 `maxWidthPx` prop도 더 이상 필요 없어 제거. **PenRail+SolveScroll 그룹 컨테이너(§3.32, 세로 중앙정렬 잘림 방지)는 이번 요구사항과 무관해 그대로 유지** — `PenRail.tsx`/`SolveScroll.tsx` zero-diff로 확인. 축소/확장 모두 여전히 같은 DOM 위치(이번엔 화면 상단 중앙)에서 `isExpanded` prop만 바뀌어 포커스 유지 메커니즘이 불필요한 상태는 그대로 유지된다.

**stage-qa-agent가 fail→fix→pass 재현으로 회귀 테스트의 실효성을 직접 검증**: `w-full`을 임시로 제거해 원래 결함 상태로 되돌려 관련 테스트가 정확히 그 지점에서 실패하는 것을 확인 후 원복, 위치 컨테이너도 동일한 방식으로 검증. 컴파일된 CSS 아티팩트(`dist/assets/index-*.css`)에서 `w-full`/`top-[90px]`/`inset-x-0` 등이 실제로 생성됐음을 grep으로 재확인.

**후속 정리**: stage-qa-agent가 LOW로 지적한, 더 이상 아무것도 읽지 않는 죽은 `rootRef`/`penRailGroupRef`(§3.32에서 PenRail 우측 측정에 쓰였다가 이번에 그 용도가 사라진 잔재)를 orchestrator가 직접 제거.

**검증**: design-agent 조사(읽기 전용, 정확한 수정 지시) → development-agent 구현 → orchestrator 독립 재검증 → stage-qa-agent **STAGE PASS**(fail→fix→pass 재현 포함) → orchestrator가 죽은 ref 정리 후 4게이트 재확인. **게이트**: web typecheck/lint/test 439/439/build 전부 통과. `PenRail.tsx`/`SolveScroll.tsx`/`/solve/landscape` zero-diff 확인. iPad 실기기 최종 시각 확인은 미검증(NOT VERIFIED, 물리 기기 필요).

### 3.34 `/solve/landscape` PenRail+SolveScroll 그룹 확장 + `SolveScroll` disabled 상태 + 배경 Pattern Fill 정정 (2026-09-09, 커밋 `33215c5`)

오너가 iPad 실기기에서 `/solve/landscape`(진단 결과 화면)를 확인한 뒤 세 가지를 요청: (1) 결과 패널이 떠 있는 상태에서도 좌측에 `PenRail`+`SolveScroll` 그룹이 계속 보여야 함(현재는 PenRail만 있고 SolveScroll이 아예 없었음), (2) 풀이가 짧아 스크롤이 필요 없어도 `SolveScroll`을 없애지 말고 탭 동작만 비활성화, (3) Solve 화면 전체 배경에 Pattern Fill이 정교하게 적용/유지돼야 함.

**Figma 재확인**(`38:21` 3-2 Landscape, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`): PenRail(x=19,y=214)과 `Solve Scroll`(node `302:167`, x=13,y=461)이 `/solve/pencilcanvas`와 정확히 동일한 좌표로 같은 좌측 그룹에 함께 배치돼 있음을 확인 — landscape에도 이 그룹이 있어야 하는 것이 확정 스펙.

**구현**: `SolveLandscapePage.tsx`의 진단 전/후 두 분기 모두에 `positioned={false}` PenRail + `SolveScroll`을 `absolute top-1/2 left-5 z-10 -translate-y-1/2 flex flex-col gap-4` 그룹 컨테이너로 묶어 추가(`/solve/pencilcanvas`와 바이트 단위로 동일한 클래스 문자열 재사용). 두 분기가 배타적으로만 마운트되므로 `canvasScrollRef`/`canvasScrollRatio`/`isCanvasScrollable` state를 공유. `HandwritingCanvas.tsx`에 `onScrollableChange`/`isScrollable()` 순수 추가(콘텐츠 성장 시점에 `outer.scrollHeight > outer.clientHeight`를 상위에 알림). `SolveScroll.tsx`에 `disabled?: boolean` prop 추가 — 마커/트랙/힌트카드는 그대로 렌더링하되(요청사항: 없애지 않음) 탭 시 no-op, `opacity-40` 톤다운 + 네이티브 `disabled`/`aria-disabled`. 배경은 `SolveLandscapePage.tsx` 루트의 `bg-bg-canvas`(단색)를 `bg-canvas-texture`(패턴)로 교체 — 조사 결과 `/solve/pencilcanvas`는 이미 패턴 배경을 쓰는데 landscape만 단색이었던 단순 누락.

**design-agent 사후검수에서 배경 Pattern Fill 실측값 자체의 오류 발견·정정**: 기존 코드(20px 타일/2×2px 도트/불투명도 0.1/배경색 `#f5f2ed`)는 Figma 근거 없는 추정값이었음이 이번에 밝혀짐 — `38:21`/`127:445` 두 프레임 스크린샷을 1194×834 원본 그대로(스케일 없음) 픽셀 샘플링해 **24px 타일/4×4px 도트/불투명도 약 0.03/배경색 `#fbfaf6`**(=`--color-bg-canvas`와 동일, 별도 텍스처 전용 색이 아니었음)로 정정. `textures.css`/`tokens.css`/`docs/DESIGN_TOKEN_MAP.md`에 검증 근거와 함께 반영.

**design-agent 사후검수에서 HIGH 회귀 버그 1건 추가 발견·수정**: `onScrollableChange`가 콘텐츠 높이 변경(`contentHeight` state)에만 반응하도록 구현돼 있어, 콘텐츠 크기는 그대로인 채 뷰포트(`outer`)만 리사이즈되는 경우(iPad 회전, Split View 폭 변경)를 놓쳐 `SolveScroll`의 `disabled` 상태가 갱신되지 않는 문제 — outer/content 양쪽 `ResizeObserver` 콜백에서 직접 `notifyScrollable()`을 호출하도록 수정(기존 팜 리젝션/터치 스크롤 로직은 `git diff -w`로 무변경 확인).

**검증**: development-agent 구현 → orchestrator 독립 재검증 → design-agent 사후검수(배경 실측 오류 정정 + HIGH 리사이즈 버그 수정) → orchestrator 재검증 → stage-qa-agent **STAGE PASS**. **게이트**: web typecheck/lint/test 444/444/build 전부 통과. `RecognizedChip.tsx`/`PenRail.tsx`(`positioned` prop 외)/`HandwritingHighlightOverlay.tsx` 의도치 않은 diff 없음 확인.

**알려진 비차단 사항**: jsdom의 `ResizeObserver` 폴리필이 콜백을 전혀 호출하지 않는 no-op라서, 이번 수정이 정확히 겨냥한 "콘텐츠 불변+뷰포트만 리사이즈" 시나리오를 자동 테스트로 직접 재현하지 못함(코드 리뷰로 대칭적 호출 구조만 확인) — iPad 실기기 회전/Split View 실제 동작은 미검증(NOT VERIFIED, 물리 기기 필요).

### 3.35 마이페이지 개선 4항목 — 썸네일 확대/카테고리 필터 가로스크롤/체크박스 일괄삭제/"다시풀기" (2026-09-09, 커밋 `33215c5`)

오너가 마이페이지(`/mypage`, 풀이 내역 화면)에 4가지 개선을 요청 — 표준 프로세스(plan-agent+design-agent 사전조사 → development-agent → design-agent 사후검수)를 항목별로 하나씩 반복하고, 최종 테스트만 stage-qa-agent로 한 번에 통합 진행(오너 지시).

**사전조사**: Figma `40:34`("MyPage/Nonselect")/`279:1176`("MyPage/Selected")/`40:45`(같은 화면의 Body 서브프레임) 3개 프레임 실측 — 두 상태(체크박스 선택 여부)만 다른 variant 쌍이며 별도 "편집모드" 진입 트리거는 없음(체크박스 상시 노출). History Row 컨테이너 1040×78, 좌우 패딩 18/16px, 요소 간 gap 14px 고정. 오너에게 3가지 확인 필요 사항을 질의해 결정: (1) "태그 1줄 스크롤"은 행 내부 태그가 아니라 상단 카테고리 필터 Pill 그룹을 가리킴(Figma 근거: 필터 아래 스크롤 인디케이터 바), (2) 삭제는 로컬 숨김이 아니라 실제 서버 삭제(신규 백엔드 API 필요), (3) 썸네일 확대는 정확한 목표 px가 아니라 "다시풀기 버튼이 추가돼도 두 줄로 안 깨지게"가 핵심 — Figma `40:45` 재실측으로 체크박스(24)+썸네일+본문(가변)+"다시풀기"(112)+chevron이 모두 한 줄에 들어가는 실제 레이아웃 확보.

**1. History Row 썸네일 확대** (`HistoryRow.tsx`): 72px→120px(높이 52px 유지). 최초 근거는 Figma 프레임 폭 1040px 기준이었으나, design-agent 사후검수로 실제 렌더 폭은 `MyPage.tsx`의 `max-w-[760px]` + 앱 전역 `ViewportGuard`(1024px 미만 차단) 조합으로 항상 712px임을 밝혀 근거를 정정(값 자체는 그대로 안전). 본문 컨테이너는 기존부터 있던 `flex-1 min-w-0`+제목 truncate로 이후 항목이 추가돼도 두 줄로 안 깨짐.

**2. 카테고리 필터 1줄 가로스크롤** (`MyPage.tsx`, `FilterPill.tsx`): 상단 필터 Pill 그룹을 `flex flex-wrap`→`flex flex-nowrap overflow-x-auto`로 교체, `FilterPill`에 `shrink-0` 추가. 필터 클릭 로직은 무변경.

**3. 체크박스 + 풀이 내역 일괄 삭제**: 신규 백엔드 `POST /api/problems/bulk-delete`(`problems.router.ts`, `problemRepository.deleteProblems` — `user_id` 쿼리 스코핑으로 소유권 강제, `getProblemDetail`과 동일하게 없음/타인소유 구분 없이 404 통일). 신규 공용 `apps/web/src/shared/ui/checkbox/Checkbox.tsx`(네이티브 `<input>` 기반, 접근성 보존). `HistoryRow.tsx`를 `<button>`→`<div>`+내부 `<button>` 구조로 변경(체크박스를 버튼 안에 중첩하면 유효하지 않은 HTML이라 형제 요소로 분리). `MyPage.tsx`에 선택 상태(`checkedProblemIds`)+확인 `Modal`(파괴적 작업이라 확인 없이 즉시 삭제 안 됨)+삭제 흐름. design-agent 사후검수에서 Figma 재조회로 색상 근사값 오류 4건 발견·정정, 신규 토큰 4종(`--color-brand-rest`/`--color-stroke-1`/`--color-accent-steel`/`--color-bg-scrim`) 등록.

**stage-qa-agent 통합 검증에서 HIGH 데이터 안전 결함 발견**: 카테고리 필터를 바꿔도 `checkedProblemIds`(체크 상태)가 초기화되지 않아, 필터 전환으로 화면에서 사라진 항목이 선택된 채로 남아 "풀이 내역 지우기" 클릭 시 **보이지 않는 항목까지 실제로 삭제될 수 있는** 문제. `selectedTag` 변경 시 선택 상태를 즉시 초기화(기존 `prevIsWorkStage` 패턴 재사용)하고, 삭제 실행 직전에도 `visibleItems`와 교집합하는 이중 방어를 추가해 수정. stage-qa-agent가 직접 재현 테스트(원 시나리오 + 스스로 고안한 변형 시나리오)로 재검증 후 최종 STAGE PASS.

**4. History Row "다시풀기" 버튼**: 기존 `resumeFromHistory`(reopen 후 곧바로 solve까지 호출, `/solve/landscape`로 이동해 전체 풀이 결과를 보여줌)는 오너 요구("WORK 단계로 인식된 것처럼 재진입")와 목적지·단계가 달라 재사용 불가 — `solve()` 호출 없이 reopen만 실행하고 이전 문제의 모든 잔재(채팅/추천질문/인식/진단/이어풀기 상태, INPUT·WORK 캔버스 획, 촬영 이미지, `lastInputType`)를 리셋하는 신규 `resumeToWork()`를 `ProblemInputProvider`에 추가. 마이페이지는 Provider 트리 밖이라 직접 호출 불가 — router state(`resumeToWorkProblemId`)로 의도만 `/solve/pencilcanvas`에 전달하고, 그 화면(Provider 안쪽)의 `useEffect`가 `useRef` 가드+즉시 state 소거(`navigate(..., {replace:true, state:null})`)로 재트리거 없이 트리거(`SolveLandscapePage`의 기존 `resumeProblemId` 패턴과 동일). design-agent 사후검수에서 Figma 재조회로 버튼 문구("다시풀기"→"다시 풀기" 공백 정정)/폰트 크기(13px→15px) 오류를 발견·수정하고, 상세보기 오버레이의 동명 버튼과 접근성 이름이 중복되던 문제도 함께 발견·수정(`aria-label="다시 풀기 ${recognizedText}"`).

**검증**: 4개 항목 각각 development-agent 구현 → orchestrator 독립 재검증(4/전체 게이트) → design-agent 사후검수(항목별) 순으로 순차 진행 → 4개 항목 완료 후 stage-qa-agent **통합 STAGE PASS**(1차 CONDITIONAL PASS, HIGH 수정 후 재검증 PASS). **게이트**: 루트 전체(shared-types/validation/api/web) typecheck/lint/build 전부 통과, test api 324/324·web 470/470. iPad 실기기 시각 확인(체크박스+120px 썸네일+본문+다시풀기+chevron 5요소 한 줄 배치)은 미검증(NOT VERIFIED, 물리 기기 필요).

### 3.36 WORK 단계 "봐 주세요" 진단(diagnose) 중 로딩 표시 공백 수정 (2026-09-09, 커밋 `33215c5`)

오너가 "풀이 결과가 나오기까지 시간이 꽤 걸리는데, 로딩 이미지가 중간에 사라져서 에러 나고 멈춘 것 같은 느낌을 준다"고 실기기에서 보고.

**근본 원인**: `SolvePencilcanvasPage.tsx`의 WORK 단계 "봐 주세요"(`handleDiagnose`)는 `recognizeWork()`→`diagnose()`를 순서대로 실행한 뒤 성공하면 `/solve/landscape`로 이동한다. 로딩 표시 조건이 `isRecognizing || isRecognizingWork`(즉 `recognizeStatus`/`recognizeWorkStatus`만)였고 **`diagnoseStatus === "loading"`이 전혀 반영돼 있지 않았다** — `recognizeWork`가 끝나 `recognizeWorkStatus`가 `"success"`로 바뀌는 순간 로딩이 사라지고, 그 뒤 오래 걸리는 `diagnose()`(CAS 검증+LLM 진단) 동안 화면에 아무 표시도 없어 멈춘 것처럼 보였다. 형제 화면 `SolveLandscapePage.tsx`는 이미 `recognizeStatus`/`recognizeWorkStatus`/`diagnoseStatus` 세 가지를 전부 로딩 조건에 반영하고 있어 이 버그가 없었다.

**수정**: `isDiagnosing = isWorkStage && diagnoseStatus === "loading"` 추가, 로딩 표시 조건을 `isRecognizing || isRecognizingWork || isDiagnosing`으로 확장, 로딩 라벨에 `SolveLandscapePage.tsx`와 동일한 문구 `"진단하는 중"` 추가(byte-identical 재사용, 신규 문구 발명 아님). `exportStrokesToPngBlob`(캔버스 export, 순수 동기 draw+`toBlob`)도 재확인해 다른 로딩 공백이 없음을 확인.

**검증**: orchestrator가 직접 원인 진단+수정(작고 명확한 로직 갭이라 별도 design-agent 라운드 없이 직접 처리, Figma/시각 변경 없음) → 신규 회귀 테스트 2건 추가 → stage-qa-agent가 수정을 임시로 되돌려 테스트가 정확히 실패하는지 확인 후 원복하는 방식으로 재현성 검증 → **STAGE PASS**. **게이트**: web typecheck/lint/test 472/472/build 전부 통과. `git diff` mtime 대조로 같은 파일에 공존하는 다른 미완료 work-order 코드(PenRail/SolveScroll/RecognizedChip/resumeToWork)와 로직적으로 얽히지 않음 확인.

### 3.37 배포 준비 — 유저 `plan`/`trial_ends_at` 스키마 + 문제 인식 하루 10회 소프트 캡 (2026-09-09, 커밋 `33215c5`(SQL 파일만, DB 미적용))

오너가 Render 배포(`app.groundmoyo.com` 서브도메인 예정) 전 두 가지를 준비: (1) 15일 무료체험 후 과금 예정이라 `plan`/`trial_ends_at` 필드를 미리 준비(이번엔 스키마만 — 트라이얼 만료 차단/토스페이먼츠 연동은 명시적으로 범위 밖), (2) 문제 인식 하루 10회 소프트 캡(오너 확정: 초과해도 차단하지 않고 경고만).

**`profiles` 테이블 신설(`user_metadata` 아님, 보안 근거)**: `grade`처럼 Supabase Auth의 `user_metadata`에 저장하면 클라이언트가 `supabase.auth.updateUser()`로 직접 고칠 수 있다 — `plan`/`trial_ends_at`은 결제 상태를 좌우하므로 반드시 서버(service role) 전용 테이블이어야 한다. 신규 마이그레이션(`supabase/migrations/20260909000000_profiles.sql`): `plan`(CHECK `trial|paid|expired`, 기본 `trial`)/`trial_ends_at`(NOT NULL) 컬럼, 가입 시 자동으로 `trial_ends_at=가입+15일`을 채우는 `handle_new_user` 트리거, RLS는 **SELECT(본인만)만 있고 INSERT/UPDATE/DELETE 정책은 의도적으로 없음**(서버가 service role 키로만 씀 — `apps/api`가 실제로 service role 키를 쓰는지 stage-qa-agent가 재확인). **파일만 작성, 실제 DB에는 미적용**(오너가 배포 시 Supabase 대시보드 SQL Editor에서 직접 실행 예정, 기존 마이그레이션과 동일한 적용 관례).

**소프트 캡(하루 10회, UTC 자정 리셋, 절대 차단 없음)**: 새 카운터 테이블 없이 기존 `problems` 테이블 행 수를 재사용(`problemRepository.countProblemsCreatedToday`, UTC 자정 경계). `recognition.router.ts`가 recognize 성공 후 best-effort로 오늘 카운트를 조회해 응답에 `dailyUsageCount`/`dailyUsageLimit`(상수 10)을 추가 — 카운트 조회가 실패하거나 인증 id가 없어도 recognize 자체는 그대로 200 성공(차단 경로 자체가 없음). 프론트(`SolvePencilcanvasPage.tsx`)는 `dailyUsageCount > dailyUsageLimit`일 때 한 번만(`ref` 가드) "확인" 버튼 하나짜리 비차단 안내 `Modal`을 보여줌(Figma 없음, 운영성 안내로 최소 구현 — 추후 디자인 필요 시 갱신).

**검증**: development-agent 구현 → orchestrator 독립 재검증(마이그레이션 SQL 직접 읽고 기존 마이그레이션 스타일과 대조, 카운트/라우터 로직 diff 확인) → stage-qa-agent **STAGE PASS**. **게이트**: 루트 전체(shared-types/validation/api/web) typecheck/lint/build 전부 통과, test api 330/330·web 476/476. `recognizeResponseSchema`를 공유하는 `reopen`(마이페이지 "다시 풀기"/"다시풀기") 응답도 optional 필드라 영향 없음 확인.

**알려진 비차단 사항**: (1) `profiles` 트리거는 신규 가입(`auth.users` INSERT)에만 반응 — **기존 가입자는 `profiles` 행이 없음**, 추후 실제로 트라이얼/과금 로직을 켤 때 기존 가입자 백필이 필요(이번 범위 밖, 오너에게 별도 전달). (2) RLS 정책 설계는 SQL 텍스트로만 검토됨 — 마이그레이션이 실제 DB에 적용되지 않아 라이브 동작은 미검증(NOT VERIFIED, 오너가 배포 시 적용 후 확인 필요).

### 3.38 Render 배포 설정 준비 (`render.yaml`, `docs/DEPLOYMENT.md`) (2026-09-09, 커밋 `33215c5`(설정 파일만, 미배포))

오너가 Render(`app.groundmoyo.com` 서브도메인)에 배포하려 함 — 이 환경엔 Render 계정/CLI 접근 권한이 없어 **설정 파일만 준비, 실제 서비스 생성/배포/도메인 연결은 오너가 대시보드에서 직접 진행**하기로 확정(오너 선택).

**배포 대상 3개**: `pocketq-web`(apps/web 정적 사이트), `pocketq-api`(apps/api Express), `pocketq-cas`(services/cas FastAPI, **Private Service** — CAS 엔드포인트에 인증이 전혀 없어 공개 노출 시 누구나 호출 가능하므로 반드시 내부 전용으로 구성).

**실제로 재현·확인한 배포 블로커 1건과 수정**: `apps/api`의 컴파일 산출물(`tsc -p tsconfig.build.json`)을 `node dist/server.js`로 직접 실행하면 `ERR_MODULE_NOT_FOUND`가 발생함을 로컬에서 직접 재현·확인 — `tsconfig.json`의 `moduleResolution: "bundler"` 설정 때문에 컴파일된 JS의 상대 import에 `.js` 확장자가 안 붙어 Node 네이티브 ESM 로더가 해석하지 못함. 별도 컴파일 빌드 없이 `tsx`로 TypeScript를 직접 실행하는 방식(`apps/api/package.json`에 `"start": "tsx src/server.ts"` 신규 추가)으로 우회 — `tsx`를 `devDependencies`에서 `dependencies`로 이동(프로덕션 설치에서도 항상 포함되도록). 이 `start` 스크립트가 실제로 정상 기동/응답하는지 저장소 루트에서 `pnpm --filter api start`로 직접 실행해 확인함(추가로 `AI_MODEL` 환경변수가 비어있으면 기동 즉시 에러로 종료되는 것도 이 과정에서 발견, 문서에 필수값으로 명시).

**작성 파일**:
- `render.yaml`(신규, 저장소 루트) — 3개 서비스 정의, 민감정보는 `sync: false`로 표시해 파일에 값을 넣지 않고 대시보드에서 입력하도록 함.
- `docs/DEPLOYMENT.md`(신규) — 배포 순서(cas→api→web, 이전 서비스의 URL을 다음 서비스 환경변수에 채워야 하므로), 서비스별 환경변수 체크리스트, `app.groundmoyo.com` 도메인 연결 절차, `profiles` 마이그레이션 적용 안내(§3.37과 연결, 기존 가입자 백필 필요성 재강조).

**검증**: `render.yaml`을 Render에 실제로 업로드해 검증하지는 못함(계정 접근 권한 없음, 문서에 이 한계 명시) — 대신 로컬에서 직접 검증 가능한 것은 전부 실행: (1) YAML 문법 유효성(`python3 -c "import yaml; yaml.safe_load(...)"`), (2) `pocketq-web` 빌드 명령(`pnpm --filter shared-types --filter validation --filter web build`)을 그대로 실행해 성공 확인, (3) `pocketq-api` 시작 명령(`pnpm --filter api start`)을 Render 런타임과 동일하게 `.env` 파일 없이 환경변수만 주입해 실행, `/health` 200 응답 확인, (4) `pnpm typecheck && pnpm lint && pnpm test && pnpm build`(루트, 전체) 재실행 — `apps/api/package.json` 변경(tsx 이동, `start` 스크립트 추가) 이후에도 전부 통과(api 330/330, web 476/476).

## 4. 확정된 아키텍처 결정 (6단계에서 이대로 구현 완료 — §3.5 참고)

아래는 오너가 명시적으로 승인했지만 **아직 구현되지 않은** 6단계("프론트 문제 제출 연결")의 설계다. 다음 세션에서 6단계를 시작하기 전, 다시 승인받을 필요 없이 이 결정대로 구현하면 된다.

1. **`apps/api` 프레임워크**: Express(확정, 이미 구현됨).
2. **공유 패키지**: `packages/contracts`는 만들지 않는다. `shared-types`(도메인 타입) / `validation`(zod 스키마+DTO) 2분할 유지, 중복 선언 금지.
3. **사진 Blob 보존**: `/solve`, `/camera`, `/camera/preview`를 감싸는 **route-scoped Provider**(가칭 `ProblemInputProvider`, `features/problem-input/`)를 신설해 메모리로만 임시 보존한다.
   - 외부 전역 상태 라이브러리 추가 금지, localStorage/sessionStorage/IndexedDB 저장 금지, Blob/objectURL을 URL 파라미터에 넣지 않음, objectURL을 API 데이터로 쓰지 않음(FormData에는 Blob 자체를 담음), React Router state로 objectURL을 핵심 데이터 소유 구조로 쓰지 않음.
   - 촬영 직후 최대 1568px로 리사이즈한 Blob만 보관(원본과 이중 보관 금지). Blob 교체/컴포넌트 해제/입력 초기화 시 반드시 `URL.revokeObjectURL()`. 제출 성공 시 Blob 참조 제거, 실패 시 재시도를 위해 유지. 흐름 취소/이탈 시 초기화. 새로고침 시 유실은 이번 MVP에서 허용.
   - 라우터 구조 변경 필요: 현재 `/solve/pencilcanvas`, `/solve/landscape`, `/camera`, `/camera/preview`가 각자 `<ProtectedRoute>`로 개별 래핑돼 있는데, 이 4개를 하나의 부모 레이아웃 라우트로 묶고 그 부모가 `ProblemInputProvider`로 감싸야 한다(`app/routes.tsx` 수정 필요).
4. **필기 PNG export**: Figma 종이 질감/배경 텍스처 **미포함** — 불투명 흰 배경 + 실제 필기 획만. 화면 표시용 텍스처는 그대로 유지하되 export 시에는 별도 합성 로직으로 흰 배경 위에 획만 그려서 내보낸다(텍스처 합성 로직은 만들지 않음). 캔버스 관련 순수 유틸(`strokeToPath` 등)은 기존 `features/drawing-canvas/`가 아니라 `apps/web/src/shared/lib/canvas/`로 옮기는 게 폴더 의존성 규칙(`features` 간 직접 참조 금지)에 맞다 — `problem-input`과 `drawing-canvas` 둘 다 `shared/`에서 가져다 쓰는 구조.
5. **입력 모델**: 옵션 B(정규화 순수함수) 확정. 사진/필기 각각의 UI 상태·export 책임은 해당 feature에 두고, 제출 직전 순수함수(`normalizeProblemInput` 등)가 공통 제출 모델로 정규화. 거대한 통합 훅에 캔버스 export+Blob 관리+옵션 처리+API 호출을 다 넣지 않는다. API 요청 상태는 별도의 작은 orchestration hook/service로 분리.
6. **폴더 배치**: 옵션 2(`features/problem-input` 신설) 확정. `pages`는 입력 feature와 제출 feature를 조립만 한다.
7. **API 계약**: recognize/solve **완전 분리**(내부에서 몰래 연속 실행하는 통합 엔드포인트 금지) — 이미 이렇게 구현됨(`POST /api/problems/recognize`, `POST /api/problems/:problemId/solve`).
8. **AI Provider**: OpenAI 먼저(구현 완료), Claude는 같은 `LLMAdapter` interface 뒤에 후속 추가 가능한 구조로 유지(구현됨).
9. **필기 유실 버그(P0)**: ✅ 6단계에서 수정 완료(§3.5).
10. **Rate limit**: in-memory, user_id 우선/IP 보조, AI 호출 전에 적용, 값은 환경변수(구현됨, `apps/api/src/middleware/rate-limiter.ts`). 재시작/다중 인스턴스 간 공유 안 됨을 코드에 이미 명시.
11. **`profiles` 테이블**: 이번엔 만들지 않음. `user_metadata`(닉네임/학년 등 개인화 데이터 전용, 권한 판단 근거로 쓰지 않음)를 계속 사용. 사용자 식별·데이터 소유권은 검증된 Supabase access token의 user id 기준.

## 5. 남은 단계 (구현 순서 그대로)

| # | 단계 | 상태 |
|---|---|---|
| 1 | 공유 계약·검증 스키마 | ✅ 완료 |
| 2 | `apps/api` 최소 실행 구조 | ✅ 완료 |
| 3 | 인증·입력 검증 | ✅ 완료 |
| 4 | AI Adapter interface + Fake Adapter | ✅ 완료 |
| 5 | 실제 AI Provider 연결(OpenAI) | ✅ 완료 — 코드 + 라이브 스모크 테스트(실제 키로 이미지 인식/풀이) 통과, 그 과정에서 발견한 파서 버그도 수정·검증 완료 |
| 6 | 프론트 문제 제출 연결 | ✅ 완료(§3.5~3.7) — recognize+solve 연결 + 정식 Figma Result Panel(개념/풀이/답 카드, KaTeX, 3단계 리사이즈)까지 |
| 6.5 | 후속 질문(채팅) Footer 연결 | ✅ 완료(§3.9~3.11) — 백엔드 chat 엔드포인트 신규, 프론트 Footer/입력/pill, 라이브 검증까지. ChatBubble은 Figma 미확정 임시 컴포넌트 |
| 6.6 | Solve v2.0(WORK/DIAG/RESUME) 재구현 | ✅ 1~3단계(§3.17)+4a(§3.18~3.19)+4b(§3.20)+4b 정정 1차·2차(§3.21)+WORK 흐름 단순화/사진 유지(§3.22)+work-order 5단계 RESUME(이어풀기) 1차·2차(§3.23)+CAS(Python/SymPy) 실제 서비스 Phase 1 완료(§3.24)+work-order 6단계 `HandwritingHighlightOverlay`(캔버스 막힌 지점 하이라이트) 완료(§3.25)+사진 인식 확인 팝업(`RecognizedProblemPopup`) 완료(§3.26)+WORK 단계 화면 버그 수정(§3.27)+**WORK 캔버스 손가락 스크롤(PRD WORK-6) 완료, ActionBar 개념설명 세그먼트는 철회(§3.28)** +**DIAG 결과 화면 사진 미리보기 완전 은닉, §3.22 결정 번복(§3.29, 커밋 `1f8e6d4`)** +**`SolveScroll` WORK 캔버스 스크롤 인디케이터(§3.30)** +**`RecognizedChip` 좌측 확대(§3.31) → PenRail+SolveScroll 그룹 중앙정렬(§3.32) → RecognizedChip 화면 상단 중앙 위치 원복+ellipsis 수정(§3.33) → `/solve/landscape`에도 PenRail+SolveScroll 그룹 확장+SolveScroll disabled 상태+배경 Pattern Fill 실측 정정(§3.34)** — DIAG-1/RESUME-5가 이제 결정론적 스텁이 아니라 실제 SymPy 동치성 검사(등식 변형 + 완전제곱식류 극값 결론 + 상수식 등식 값 비교)로 검증되고, 진단 결과 화면에서 학생 필기 위에 막힌 지점이 시각적으로 표시되며, 사진 인식 완료 시 확인 팝업 후 WORK 캔버스로 전환되고, 풀이 공간이 부족하면 손가락으로 스크롤(+펜으로 마커를 탭해 스크롤 이동)해 확장할 수 있으며, 결과 화면에서는 입력 방식(사진/필기)과 무관하게 사진 미리보기가 노출되지 않고(WORK 단계와 동일하게 완전 숨김), WORK 단계 인식 카드는 별도 버튼으로 확장해 사진/인식 텍스트 전체를 확인할 수 있음. 매 단계 design-agent/stage-qa-agent 검증(최종 STAGE PASS, 회귀 테스트 중 발견된 결함 전부 수정 확인 — 4b 정정 HIGH 1건, RESUME HIGH 2건, CAS Phase 1 파싱/극값/시그마 등식 버그 3건, 인식 팝업 Medium 2건, WORK 단계 화면 버그 2건, 캔버스 스크롤 팜 리젝션 HIGH 1건, SolveScroll 좌표/토큰/렌더링 버그 5건(미선택 마커 완전 비노출 포함), RecognizedChip 확장 접근성 HIGH 2건+MEDIUM 2건). CAS Phase 2(부등식 방향/미적분/수열)와 ActionBar 개념설명 세그먼트는 각각 오너 재승인/재제안 없이 착수 금지. work-order 7~8단계(CHAT 컨텍스트 확장/METHOD)는 아직 미착수 — 오너 확인 후 진행. §3.29만 커밋 완료(`1f8e6d4`/`4802a69`), §3.30~3.31은 미커밋 |
| 6.7 | 마이페이지(`/mypage`) 개선 4항목 | ✅ 완료(§3.35, 미커밋) — History Row 썸네일 확대(72→120px), 상단 카테고리 필터 1줄 가로스크롤, 체크박스+"풀이 내역 지우기" 일괄 삭제(신규 백엔드 `POST /api/problems/bulk-delete`, 소유권 검증), 각 행 "다시풀기" 버튼(신규 `resumeToWork` — 기존 `resumeFromHistory`와 달리 solve 미호출, `/solve/pencilcanvas` WORK 단계로 재진입). stage-qa-agent 통합 검증에서 HIGH 데이터 안전 결함(필터 전환 시 안 보이는 선택 항목이 삭제 대상에 섞임) 발견·수정 후 최종 STAGE PASS. iPad 실기기 시각 확인은 미검증 |
| 7 | Supabase 저장 | ❌ 미착수(현재 in-memory Map만 존재, 서버 재시작 시 소실) |
| 8 | 통합 테스트 | ❌ 미착수(수동 스모크 테스트만 있음) |

## 6. 다음 세션 시작 시 권장 첫 행동

1. `git status`/`git diff`로 이 문서와 실제 상태가 일치하는지 재확인(임의 커밋 금지, 커밋 전 항상 오너 확인). **이 세션 끝에 커밋을 진행했다면 실제 커밋 해시로 §2를 갱신할 것.**
2. LAN IP가 또 바뀌었는지 확인(§3.8) — `ifconfig`로 현재 IP 확인 후 `.env` 2곳 + mkcert 인증서 재발급.
3. iPad 실기기에서 확인이 필요한 것(§3.11) — 키보드 열림/닫힘/회전 시 후속 질문 입력창이 정상 동작하는지.
4. Solve v2.0 재구현(§3.16~3.26, §5 6.6단계) — 1~4b, 4b 정정(1차+2차), work-order 5단계(RESUME), CAS Phase 1 실제 서비스 구축(+시그마 등식 후속 수정), work-order 6단계(캔버스 하이라이트 오버레이), **사진 인식 확인 팝업(§3.26)**까지 전부 완료·검증된 상태다(최종 STAGE PASS). 오너에게 다음 우선순위를 확인할 것: (a) work-order 7단계(CHAT 컨텍스트 확장) 착수 여부, (b) CAS Phase 2(부등식 방향/미적분/수열, §3.24 "알려진 제약" 참고) 착수 여부 — **오너 재승인 없이는 절대 먼저 진행하지 말 것**(오너가 명시적으로 상기 요청함). **커밋이 아직 안 됐다** — 세션 종료 전이든 다음 세션 시작 시든 먼저 오너에게 커밋 여부를 확인할 것(이 프로젝트는 명시적 요청 없이 커밋하지 않는 것이 규칙). iPad 실기기(1194×834 가로/Split View) 렌더는 여전히 미검증(코드/Figma 대조만 수행) — 실기기 테스트 권장(§3.25의 `LINE_GAP_THRESHOLD_PX` 잠정값 보정, §3.26 팝업 렌더 포함). 실제 OpenAI 어댑터가 CAS 연동 후 새 "순수 LaTeX만" 프롬프트 지시를 실제로 지키는지는 §3.24 후속 수정에서 라이브로 확인 완료(문제없음, 시그마 등식 케이스만 CAS 판정 로직 확장 필요했음). 백로그(`RecognizedProblemBar` 라벨, `Badge` `chip` size, `elevatedCardStyle.ts` 중복, `AnswerBox.tsx`의 무효 Figma 노드 인용, §3.25 "알려진 제약"의 `isResultReady`/`isDiagnosisReady` 동시 참 가능성, §3.26의 `Modal` icon 변형 패딩 소폭 불일치, `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §7 결정 필요 항목들)는 이번 work-order와 무관하게 언제든 별도로 처리 가능.
5. 오너에게 다음 우선순위를 확인:
   - `ChatBubble`(§3.9) — Figma에 정식 대화 버블 디자인이 추가되면 교체 필요.
   - 제안 질문 pill 문구가 정적 placeholder(§3.9) — 실제 문제/풀이 맥락 기반 추천 로직으로 교체할지.
   - Footer의 후속 질문 스트리밍 표시(PRD CHAT-8, P1) 착수 여부.
   - 7단계(Supabase 저장, 후속 대화 영구 저장 포함) 착수 여부.
   - `icon="error"` Modal variant — Figma에 정식 error/warning 팝업이 생기면 교체 필요(현재는 임시로 승인된 상태, `docs/COMPONENT_MAP.md` 참고).
   - §3.7 끝에 남겨둔 사소한 항목(ProblemCard `recognitionFailed` 중복) 정리 여부.
   - 사운드 알림이 실제로 들리는지(§0, 중요도 낮음).

## 7. 주요 파일 경로 참고

- 백엔드 진입점: `apps/api/src/app.ts`(`createApp(adapter?)`), `apps/api/src/server.ts`(HTTPS 조건부 지원)
- AI 어댑터: `apps/api/src/infrastructure/ai/{adapter.ts,openai-adapter.ts,fake-adapter.ts,resolve-adapter.ts,parseSolveOutput.ts,prompts/system.ts}`(`chat()` 포함)
- 라우트: `apps/api/src/modules/{recognition,solutions,chat}/*.router.ts`
- 인메모리 저장소(임시): `apps/api/src/infrastructure/store/inMemoryProblemStore.ts`(`Solution`도 저장하도록 확장됨)
- 환경변수: `apps/api/src/config/env.ts`(+`env.test.ts`)
- 공유 타입/스키마: `packages/shared-types/src/index.ts`(`ChatMessage` 포함), `packages/validation/src/index.ts`(`chatRequestSchema` 포함)
- 프론트 문제 입력 상태(Provider): `apps/web/src/features/problem-input/{ProblemInputProvider.tsx,ProblemInputContext.ts,useProblemInput.ts,normalizeProblemInput.ts,RequireProblemInputGuard.tsx,CameraPreviewGuard.tsx}`(`problemId`/`chatMessages` 등 노출), `apps/web/src/app/ProblemInputRoute.tsx`
- 프론트 API 클라이언트: `apps/web/src/shared/api/{httpClient.ts,parseSse.ts,recognizeProblem.ts,solveProblem.ts,chatMessage.ts,ApiError.ts}`
- 프론트 오케스트레이션 훅: `apps/web/src/features/problem-recognition/useRecognizeProblem.ts`, `apps/web/src/features/ai-solution/useSolveStream.ts`, `apps/web/src/features/follow-up-chat/useChatMessages.ts`
- 프론트 결과 화면(Result Panel, §3.7): `apps/web/src/features/ai-solution/{ResultPanel.tsx,ResultPanelShell.tsx,ResultPanelResizeHandle.tsx,ResultCard.tsx,AnswerBox.tsx,RecognizedProblemBar.tsx,parseStreamingSolve.ts,useKeyboardInset.ts}`, `apps/web/src/shared/lib/katex/renderMathText.tsx`, `apps/web/src/shared/ui/badge/Badge.tsx`
- 프론트 후속 질문(채팅, §3.9): `apps/web/src/features/follow-up-chat/{ChatFooter.tsx,SuggestionPill.tsx,ChatBubble.tsx(임시),useChatMessages.ts}`
- 로딩 마크(§3.10): `apps/web/src/shared/ui/loading-mark/LoadingMark.tsx`, 에셋 `apps/web/src/assets/logo/PocketQInitial.png`
- 프론트 캔버스 유틸(이관됨): `apps/web/src/shared/lib/canvas/{useDrawingStrokes.ts,strokeToPath.ts,strokeStyle.ts,exportStrokesToPngBlob.ts}`
- 프론트 필기 컴포넌트: `apps/web/src/features/drawing-canvas/{HandwritingCanvas.tsx,PenRail.tsx}`(`onPointerCancel` 포함)
- 프론트 카메라: `apps/web/src/features/camera/*`
- 프론트 solve 페이지: `apps/web/src/pages/solve/{pencilcanvas,landscape}/*`(landscape가 전체 조립부)
- 공용 Modal/Button: `apps/web/src/shared/ui/{modal/Modal.tsx,button/Button.tsx}`(`focus-visible:ring` 포함)
- 전역 CSS: `apps/web/src/shared/styles/global.css`(`overscroll-behavior:none`, 슬라이드인/펄스 keyframes)
- 루트 ESLint: `eslint.config.js`(신규), `apps/web/eslint.config.js`(기존, 미변경)
- 로컬 HTTPS: `apps/web/vite.config.ts`, `apps/api/src/server.ts`, `apps/{web,api}/.cert/`(gitignore, LAN IP 바뀌면 재발급 필요 — §3.8)
- PRD/구조 문서: `docs/PRD_WHYMATH.md`(§4.5 CHAT-1~10 미커밋 초안), `docs/PROJECT_STRUCTURE.md`, `docs/FIGMA_SCREEN_MAP.md`, `docs/COMPONENT_MAP.md`(`ChatBubble`/리사이즈 핸들 등 임시·신규 컴포넌트 문서화), `.claude/rules/frontend.md`

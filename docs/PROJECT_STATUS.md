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

최근 커밋(2026-08-10, 6단계 + 관련 버그 수정 — 정확한 해시는 `git log`로 확인):
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
| 6.6 | Solve v2.0(WORK/DIAG/RESUME) 재구현 | ⏳ 1~3단계 완료 + design-agent 사후검수 2회 완료(2026-09-05, §3.17). 1회차: P0 결함 2건(ActionBar/WorkLineList 실측값 오류) 발견→수정→PASS. 2회차: P0 재검수 PASS 확인 + `WorkLineEditor`(3단계) 최초검수에서 P1 결함 2건(줄번호 배지 회귀, 편집창 포커스 접근성) 발견→수정 완료, 내가 직접 재검증(typecheck/lint/test 361개/build 전부 통과). 백로그 3건은 `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §7에 기록. 4단계(백엔드 연동) 이후는 별도 승인 필요 |
| 7 | Supabase 저장 | ❌ 미착수(현재 in-memory Map만 존재, 서버 재시작 시 소실) |
| 8 | 통합 테스트 | ❌ 미착수(수동 스모크 테스트만 있음) |

## 6. 다음 세션 시작 시 권장 첫 행동

1. `git status`/`git diff`로 이 문서와 실제 상태가 일치하는지 재확인(임의 커밋 금지, 커밋 전 항상 오너 확인). **이 세션 끝에 커밋을 진행했다면 실제 커밋 해시로 §2를 갱신할 것.**
2. LAN IP가 또 바뀌었는지 확인(§3.8) — `ifconfig`로 현재 IP 확인 후 `.env` 2곳 + mkcert 인증서 재발급.
3. iPad 실기기에서 확인이 필요한 것(§3.11) — 키보드 열림/닫힘/회전 시 후속 질문 입력창이 정상 동작하는지.
4. Solve v2.0 재구현(§3.16~3.17, §5 6.6단계) — 1~3단계 구현 + design-agent 사후검수 2회(P0/P1 결함 발견→수정→재검증) 모두 완료된 상태다. 오너에게 4단계(WORK/DIAG 백엔드 연동, CAS 스텁 포함) 착수 여부를 확인할 것. 백로그 3건(`RecognizedProblemBar` 라벨, `Badge` `chip` size, `elevatedCardStyle.ts` 중복, `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §7)은 이번 work-order와 무관하게 언제든 별도로 처리 가능.
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

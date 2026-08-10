# 프로젝트 진행 상황 (세션 인계용)

이 문서는 Claude Code 세션을 새 창으로 재시작할 때 이전 세션 작업을 그대로 이어가기 위한 인계 문서다.
2026-08-10 기준. 새 세션에서는 이 문서를 먼저 읽고, 아래 "다음에 할 일"부터 이어간다.

## 0. 지금 이 문서를 쓰게 된 이유

`~/.claude/settings.json`에 승인 대기/질문 시 macOS 사운드 알림(`Notification` 훅, `osascript` + `afplay`)을 추가했는데, 이전 VS Code 세션은 훅 추가 **이전에 시작된 세션**이라 적용되지 않았다. 2026-08-09 새 세션에서 `AskUserQuestion`을 여러 번 호출했으나, 오너에게 사운드가 실제로 들렸는지 확인받지 못함 — 다음 세션에서 확인 필요.

## 1. 프로젝트 개요

왜수학(WhyMath) — iPad 중심 수학 개념 튜터 웹앱. 요구사항 최우선 기준 문서는 `docs/PRD_WHYMATH.md`.

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
| 6 | 프론트 문제 제출 연결 | ✅ 완료(§3.5) — recognize+solve 연결, 필기 유실 버그 수정, 최소 결과 표시. 정식 Result Panel은 별도 작업으로 분리 |
| 7 | Supabase 저장 | ❌ 미착수(현재 in-memory Map만 존재, 서버 재시작 시 소실) |
| 8 | 통합 테스트 | ❌ 미착수(수동 스모크 테스트만 있음) |

## 6. 다음 세션 시작 시 권장 첫 행동

1. `git status`/`git diff`로 이 문서와 실제 상태가 일치하는지 재확인(임의 커밋 금지, 커밋 전 항상 오너 확인).
2. 사운드 알림이 실제로 들리는지 오너에게 확인(§0 — 아직 미확인 상태로 남아있음).
3. 오너에게 다음 우선순위를 확인:
   - 정식 Result Panel(개념/풀이/답 UI, 마크다운+KaTeX) — Figma에 컴포넌트가 아직 없으므로 먼저 Figma 확정이 필요할 수 있음.
   - 7단계(Supabase 저장) 착수 여부.
   - §3.5 끝에 남겨둔 사소한 항목(ProblemCard `recognitionFailed` 중복, 스트리밍 도중 에러 시 잔여 텍스트) 정리 여부.
   - `icon="error"` Modal variant — Figma에 정식 error/warning 팝업이 생기면 교체 필요(현재는 임시로 승인된 상태, `docs/COMPONENT_MAP.md` 참고).

## 7. 주요 파일 경로 참고

- 백엔드 진입점: `apps/api/src/app.ts`(`createApp(adapter?)`), `apps/api/src/server.ts`(HTTPS 조건부 지원)
- AI 어댑터: `apps/api/src/infrastructure/ai/{adapter.ts,openai-adapter.ts,fake-adapter.ts,resolve-adapter.ts,parseSolveOutput.ts,prompts/system.ts}`
- 라우트: `apps/api/src/modules/{recognition,solutions}/*.router.ts`
- 인메모리 저장소(임시): `apps/api/src/infrastructure/store/inMemoryProblemStore.ts`
- 환경변수: `apps/api/src/config/env.ts`(+`env.test.ts`)
- 공유 타입/스키마: `packages/shared-types/src/index.ts`, `packages/validation/src/index.ts`
- 프론트 문제 입력 상태(Provider): `apps/web/src/features/problem-input/{ProblemInputProvider.tsx,ProblemInputContext.ts,useProblemInput.ts,normalizeProblemInput.ts,RequireProblemInputGuard.tsx,CameraPreviewGuard.tsx}`, `apps/web/src/app/ProblemInputRoute.tsx`
- 프론트 API 클라이언트: `apps/web/src/shared/api/{httpClient.ts,parseSse.ts,recognizeProblem.ts,solveProblem.ts,ApiError.ts}`
- 프론트 오케스트레이션 훅: `apps/web/src/features/problem-recognition/useRecognizeProblem.ts`, `apps/web/src/features/ai-solution/useSolveStream.ts`
- 프론트 캔버스 유틸(이관됨): `apps/web/src/shared/lib/canvas/{useDrawingStrokes.ts,strokeToPath.ts,strokeStyle.ts,exportStrokesToPngBlob.ts}`
- 프론트 필기 컴포넌트: `apps/web/src/features/drawing-canvas/{HandwritingCanvas.tsx,PenRail.tsx}`
- 프론트 카메라: `apps/web/src/features/camera/*`
- 프론트 solve 페이지: `apps/web/src/pages/solve/{pencilcanvas,landscape}/*`(landscape에 최소 결과 표시 포함)
- 공용 Modal: `apps/web/src/shared/ui/modal/Modal.tsx`
- 루트 ESLint: `eslint.config.js`(신규), `apps/web/eslint.config.js`(기존, 미변경)
- 로컬 HTTPS: `apps/web/vite.config.ts`, `apps/api/src/server.ts`, `apps/{web,api}/.cert/`(gitignore)
- PRD/구조 문서: `docs/PRD_WHYMATH.md`, `docs/PROJECT_STRUCTURE.md`, `docs/FIGMA_SCREEN_MAP.md`, `docs/COMPONENT_MAP.md`, `.claude/rules/frontend.md`

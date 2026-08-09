# 프로젝트 진행 상황 (세션 인계용)

이 문서는 Claude Code 세션을 새 창으로 재시작할 때 이전 세션 작업을 그대로 이어가기 위한 인계 문서다.
2026-08-08 기준. 새 세션에서는 이 문서를 먼저 읽고, 아래 "다음에 할 일"부터 이어간다.

## 0. 지금 이 문서를 쓰게 된 이유

`~/.claude/settings.json`에 승인 대기/질문 시 macOS 사운드 알림(`Notification` 훅, `osascript` + `afplay`)을 추가했는데, 이 VS Code 세션은 훅 추가 **이전에 시작된 세션**이라 적용되지 않았다(터미널의 새 세션에서는 정상 동작 확인됨). 명령어 자체(`osascript`/`afplay`)는 이 환경에서 정상 동작함을 직접 실행해 확인했다 — 세션을 새로 열면(설정을 새로 읽으면) 정상 작동할 것으로 예상된다.

## 1. 프로젝트 개요

왜수학(WhyMath) — iPad 중심 수학 개념 튜터 웹앱. 요구사항 최우선 기준 문서는 `docs/PRD_WHYMATH.md`.

- 프론트엔드: `apps/web` — React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + React Router 8 + Supabase Auth(anon key)
- 백엔드: `apps/api` — Express 5 + TypeScript, 이번 세션에 처음부터 새로 만듦(이전엔 완전히 빈 디렉터리였음)
- 공유 패키지: `packages/shared-types`(Provider 독립적 도메인 타입, 의존성 없음), `packages/validation`(zod 런타임 검증 스키마, `shared-types`에 단방향 의존)
- pnpm workspace, 루트 `package.json`은 `web`만 기본 스크립트로 연결(`api`/`packages/*`는 `pnpm -F <name> <script>`로 개별 실행)

## 2. Git 상태

최근 커밋(오너가 직접 커밋함, 내가 한 것 아님):
```
a49f1c7 Add Express API backend and shared-types/validation packages   ← 1~4단계 백엔드
46a103f Add handwriting canvas to solve screen, split /solve into pencilcanvas/landscape
edbec93 Add photo problem-input flow (solve/camera/camera preview)
```

**현재 작업 트리는 미커밋 상태**(이번 세션에서 Git commit을 하지 말라는 지시를 계속 지켰음). `git status --short`로 확인 가능한 미커밋 변경:
- ESLint 워크스페이스 통합(루트 `eslint.config.js` 신규, 루트/`packages/*` `package.json` 수정)
- `apps/api`의 OpenAI Adapter 실제 구현(신규 파일 4개 + 기존 파일 다수 수정)
- `pnpm-lock.yaml` 변경(eslint, `openai` 패키지 추가분)

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

### 3.3 백엔드 5단계 일부 — ESLint 통합 + OpenAI Adapter (이번 세션, 미커밋)
- 루트 ESLint 통합: `eslint@10.8.0`/`typescript-eslint@8.63.0`을 루트 devDependencies로 1회만 설치, 루트 `eslint.config.js`가 `apps/api/src`·`packages/*/src`를 검사(`apps/web`은 기존 자체 설정 그대로 유지, 회귀 없음 확인됨). `pnpm -F {web,api,shared-types,validation} lint` 4개 전부 통과.
- `openai@7.4.0` 설치, `apps/api/src/infrastructure/ai/openai-adapter.ts` 신규 — **OpenAI Responses API**(`client.responses.create`) 사용, `recognizeProblem`은 Structured Outputs(`text.format:{type:"json_schema"}`)로 강제 후 `recognizedProblemSchema`로 재검증, `solve`는 `stream:true`로 텍스트 델타를 SSE로 실시간 전달하고 스트림 종료 후 `parseSolveOutput.ts`(신규)가 마크다운 헤더(`## 관련 개념`/`## 풀이`/`## 최종 답` + 말미 `concept_tags` JSON)를 파싱해 구조화된 `Solution`으로 변환.
- `openai` SDK import는 `openai-adapter.ts` 한 파일로 제한(다른 파일은 `LLMAdapter`/`shared-types`만 참조).
- `createAdapter("openai", model)`이 실제 `OpenAIAdapter`를 반환(이전엔 스텁). `OPENAI_API_KEY`/`AI_MODEL`이 비어있으면 생성 시점에 즉시 에러(조용히 fake로 대체 안 함). `resolveAdapter()`는 `AI_PROVIDER` 미설정 시에만 `FakeLLMAdapter`로 폴백.
- 라우터(`recognition.router.ts`/`solutions.router.ts`)를 `createXxxRouter(adapter: LLMAdapter = resolveAdapter())` 팩토리로 리팩터링해 테스트가 `FakeLLMAdapter`를 명시적으로 주입하도록 변경(실제 `AI_PROVIDER` 환경변수·네트워크와 완전히 무관하게 결정적으로 동작).
- **오너 확정 모델명**: `AI_MODEL=gpt-5.6-terra`(코드에 하드코딩 안 함, `.env`로만 주입). 이유: 이미지 입력+스트리밍+Structured Outputs 지원, MVP 인식/풀이 품질과 비용 균형.
- 게이트 전체 통과: `shared-types`/`validation`/`api`(lint/typecheck/test 34개/build) + `web`(lint/typecheck/test 96개/build, 전부 영향 없음 재확인).
- 테스트가 실제 API를 호출하지 않음을 명시적으로 확인(`OPENAI_API_KEY` 미설정 상태 + 빈 값 강제 상태 둘 다에서 전체 테스트 통과, `openai` 패키지 자체를 mock).

## 4. 확정된 아키텍처 결정 (6단계 구현 시 반드시 이대로 따를 것 — 아직 코드에 반영 안 됨)

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
9. **필기 유실 버그(P0, 아직 미수정)**: `/solve/pencilcanvas`↔`/solve/landscape`가 각자 독립적으로 `useDrawingStrokes()`를 호출해서 라우트 전환 시 획이 사라짐. 근본 원인은 "두 페이지가 각자 자기 state를 가진 것"이지 다른 버그가 아니다. 최소 수정: `useDrawingStrokes`의 상태 소유권을 §4-3의 `ProblemInputProvider`로 옮기고, 두 페이지는 그 Context에서 값을 읽어 `HandwritingCanvas`/`PenRail`에 그대로 전달(두 컴포넌트는 이미 순수 props 기반이라 수정 불필요). 회귀 테스트(라우터 통합 테스트로 pencilcanvas→landscape 이동 후 획 유지 확인) 추가할 것. **AI API 연결 전에 처리하기로 했었으나, 실제로는 아직 미착수 — 6단계 착수 시 최우선으로 처리할 것.**
10. **Rate limit**: in-memory, user_id 우선/IP 보조, AI 호출 전에 적용, 값은 환경변수(구현됨, `apps/api/src/middleware/rate-limiter.ts`). 재시작/다중 인스턴스 간 공유 안 됨을 코드에 이미 명시.
11. **`profiles` 테이블**: 이번엔 만들지 않음. `user_metadata`(닉네임/학년 등 개인화 데이터 전용, 권한 판단 근거로 쓰지 않음)를 계속 사용. 사용자 식별·데이터 소유권은 검증된 Supabase access token의 user id 기준.

## 5. 남은 단계 (구현 순서 그대로)

| # | 단계 | 상태 |
|---|---|---|
| 1 | 공유 계약·검증 스키마 | ✅ 완료 |
| 2 | `apps/api` 최소 실행 구조 | ✅ 완료 |
| 3 | 인증·입력 검증 | ✅ 완료 |
| 4 | AI Adapter interface + Fake Adapter | ✅ 완료 |
| 5 | 실제 AI Provider 연결(OpenAI) | ✅ 코드는 완료, **라이브 스모크 테스트(실제 키로 진짜 이미지 인식/풀이) 미실행** |
| 6 | 프론트 문제 제출 연결 | ❌ **미착수** — §4의 1~9번 결정 그대로 구현, 특히 필기 유실 버그(§4-9)부터 |
| 7 | Supabase 저장 | ❌ 미착수(현재 in-memory Map만 존재) |
| 8 | 통합 테스트 | ❌ 미착수 |

## 6. 다음 세션 시작 시 권장 첫 행동

1. `git status`/`git diff`로 이 문서와 실제 상태가 일치하는지 재확인(특히 미커밋 변경분 — 커밋할지 오너에게 먼저 물어볼 것, 임의 커밋 금지).
2. 사운드 알림이 이번엔 정상 동작하는지 확인(§0).
3. 오너에게 5단계 라이브 스모크 테스트(실제 `OPENAI_API_KEY` 필요, 비용 발생) 여부를 먼저 확인.
4. 이어서 6단계 착수 여부를 오너에게 확인하고, 승인되면 §4의 결정사항 그대로(재질문 없이) 구현 계획을 다시 한번 간단히 요약해 보여준 뒤 진행.

## 7. 주요 파일 경로 참고

- 백엔드 진입점: `apps/api/src/app.ts`(`createApp(adapter?)`), `apps/api/src/server.ts`
- AI 어댑터: `apps/api/src/infrastructure/ai/{adapter.ts,openai-adapter.ts,fake-adapter.ts,resolve-adapter.ts,parseSolveOutput.ts,prompts/system.ts}`
- 라우트: `apps/api/src/modules/{recognition,solutions}/*.router.ts`
- 인메모리 저장소(임시): `apps/api/src/infrastructure/store/inMemoryProblemStore.ts`
- 공유 타입/스키마: `packages/shared-types/src/index.ts`, `packages/validation/src/index.ts`
- 프론트 필기: `apps/web/src/features/drawing-canvas/{HandwritingCanvas.tsx,PenRail.tsx,useDrawingStrokes.ts,strokeToPath.ts}`
- 프론트 카메라: `apps/web/src/features/camera/*`
- 프론트 solve 페이지: `apps/web/src/pages/solve/{pencilcanvas,landscape}/*`
- 루트 ESLint: `eslint.config.js`(신규), `apps/web/eslint.config.js`(기존, 미변경)
- PRD/구조 문서: `docs/PRD_WHYMATH.md`, `docs/PROJECT_STRUCTURE.md`, `docs/FIGMA_SCREEN_MAP.md`, `docs/COMPONENT_MAP.md`, `.claude/rules/frontend.md`

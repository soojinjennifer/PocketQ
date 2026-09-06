# 프론트엔드 구현 계획

입력 문서: `docs/PRD_WHYMATH.md`, `docs/PROJECT_STRUCTURE.md`, `.claude/rules/frontend.md`, `docs/FIGMA_SCREEN_MAP.md`, `docs/DESIGN_SYSTEM.md`, `docs/DESIGN_TOKEN_MAP.md`, `docs/COMPONENT_MAP.md`. 이 문서는 화면 코드를 작성하기 전 마지막 준비 단계이며, 실제 코드는 아직 작성하지 않는다.

## 1. 화면별 구성 요소 (신규 vs 재사용)

### 1.1 로그인 (`/login`)
- 재사용: `shared/ui/button`(variant `social`/`primary`), `shared/ui/input`, `shared/ui/app-shell/StatusBar`
- 신규(1회성): 소셜 로그인 버튼 3종의 variant 정의(Kakao/Google/이메일), 구분선 컴포넌트
- feature: `features/auth`

### 1.2 학년 선택 (`/grade-setup`)
- 재사용: `shared/ui/card`(또는 `GradeCard` 전용), `shared/ui/app-shell/StatusBar`
- feature: `features/grade-setup`

### 1.3 문제 풀기 (`/solve`) — 가장 복잡한 화면, 우선 구현 대상

**2026-09-04 PRD v2.0 반영**: `/solve` 내부는 INPUT → WORK → DIAG/RESUME 단계로 전환되며, 단계 전환에는 신규 라우트를 추가하지 않는다(PRD §3). `3-0 Solve/Default`(INPUT, `problemId===null`)와 `3-1 Solve/Pencilcanvas`(WORK, `problemId!==null`)는 동일 라우트(`/solve/pencilcanvas`) 내부 분기이고, `3-2 Solve/Landscape`(`/solve/landscape`)는 라우트를 유지한 채 콘텐츠가 DiagnosisCard/ResumeModeBar/ResumeResultCard로 교체된다. 상세 8단계 작업 순서는 아래 §1.3.1 참고.

- 신규 정의 필요(최초 구현 시 한 번만 만들고 이후 재사용): `ProblemCard`, `ActionBar`(v2.0: 3분할, `~~SOLVE-1~~` 체크박스 방식 폐기), `ResultPanel`, `ChatInput`, `WorkLineEditor`, `WorkLineList`, `DiagnosisCard`, `ResumeModeBar`, `ResumeResultCard`, `HandwritingHighlightOverlay` (`docs/COMPONENT_MAP.md` §2)
- 재사용: `Nav Tab Bar`, `Pen Rail`(캔버스 툴), `Result Card`, `Button/Pill`
- feature: `features/drawing-canvas`, `features/camera`, `features/problem-recognition`, `features/solve-session`, `features/work-input`(신규), `features/ai-solution`, `features/follow-up-chat`, `features/similar-problems`
- 캔버스는 `CSS Modules` 사용 대상(유일하게 허용된 특수 스타일 영역, `.claude/rules/frontend.md` §3.4). `HandwritingCanvas.tsx` 내부는 수정하지 않고, 하이라이트는 별도 sibling `HandwritingHighlightOverlay` 레이어로 구현한다.
- `ProblemInputProvider`(기존, `features/problem-input/`)를 신규 Provider로 대체하지 않고 확장한다 — WORK 단계 캔버스 스트로크는 기존 INPUT 단계와 별개의 두 번째 `useDrawingStrokes()` 인스턴스를 사용한다.

#### 1.3.1 Solve v2.0(진단형 튜터) 구현 단계 (2026-09-04, plan-agent 확정, 오너 승인)

이 저장소에서 Solve 화면 관련 작업을 진행할 때는 아래 8단계 순서를 따른다. 각 단계는 `plan-agent` → `development-agent` → `design-agent`(사후 검수) 순서를 유지한다.

1. **ActionBar 3분할 재작성**: `getActionBarState(input: ActionBarStateInput): ActionBarButtonState`를 `shared/lib/solve/actionBarState.ts`(신규)에 상태표 기반 순수함수로 구현. `ActionBar.tsx`/`ActionBar.test.tsx` 재작성. `shared/lib/solve/solveOptions.ts`(`SOLVE_ACTION_OPTIONS`) 삭제 및 참조하는 모든 호출부(`SolvePencilcanvasPage.tsx`, `SolveLandscapePage.tsx`, `ProblemInputProvider.submitProblem`의 `toSolveOptions`) 정리.
2. **목업 UI 컴포넌트**: `WorkLineList`/`DiagnosisCard`/`ResumeModeBar`/`ResumeResultCard`를 하드코딩된 목업 `Diagnosis`/`ResumeSolution` 데이터로만 구현(백엔드 연동 없음). 기존 `shared/ui` 컴포넌트(Button variant, Badge variant, Card 토큰)를 재사용하고 화면 전용 스타일을 새로 만들지 않는다.
3. **`WorkLineEditor` 구현** — **차단(blocked)**: WORK 단계 줄 단위 인식/수정/신뢰도 경고 상태의 Figma 프레임이 아직 확인되지 않음(§7 결정 필요 항목 #1). design-agent의 WORK-2/3 중간 상태 조회 결과가 나온 뒤 착수한다.
4. **백엔드 연동 — WORK/DIAG**: `ProblemInputProvider`에 `useRecognizeWork`/`useDiagnose` 훅 추가. `DiagnoseRequest.casVerification`은 실제 CAS 서비스가 준비되지 않았다면 결정론적 스텁(모든 줄 valid 처리, 과거 `FakeLLMAdapter` 선례와 동일 패턴)으로 대체 가능.
5. **백엔드 연동 — RESUME**: ✅ 완료(2026-09-06~07, `docs/PROJECT_STATUS.md` §3.23). `useResumeStream` 훅 추가, `ResumeModeBar`/`ResumeResultCard`를 실제 데이터로 연결. stage-qa-agent 최종 회귀 STAGE PASS(RESUME-1~5 중 CAS 검증(RESUME-5)만 스텁 — 실제 SymPy 서비스는 DIAG-1과 함께 여전히 미착수, 별도 계획 필요).
6. **`HandwritingHighlightOverlay` 구현**: 막힌 지점(스트로크 구간 또는 y좌표 범위)을 WorkLine에 매핑하는 데이터 모델이 PRD §7에 아직 없음 — 착수 전 결정 필요(§7 결정 필요 항목 #2).
7. **CHAT 컨텍스트 확장**: 기존 `features/follow-up-chat`은 대부분 재사용 가능하되, WORK/DIAG/RESUME 단계 컨텍스트를 포함하도록 데이터만 확장.
8. **METHOD 화면 구현**: 조사된 3개 프레임에 METHOD 화면이 없음(§7 결정 필요 항목 #4) — 별도 Figma 확인 후 착수.

**현재 승인된 실행 범위(오너 승인, 2026-09-04)**: 1~2단계만 착수. 3단계는 WORK-2/3 Figma 조회 결과가 나오기 전까지 시작하지 않는다. 4~8단계는 별도 지시 없이는 착수하지 않는다.

**2026-09-06 정정 사항(4b 보완, 신규 단계 아님)**: design-agent가 문제 인식 스토리보드(`267:778`)/로딩 마크(`190:866`)/빈 상태 힌트 2종(`260:454`/`242:528`)/캔버스 상단 인식 칩(`250:56`)/해시태그 pill·ResultPanel V2 콘텐츠(`253:53`/`174:640`)를 Figma로 재실측한 결과, 이미 진행된 4b 구현이 실측과 다른 부분(ActionBar WORK 서브스테이트 미구분, RESULT "새 문제 풀기" 누락)과 완전 미구현 부분(빈 상태 힌트, 캔버스 상단 칩, 개념설명 해시태그+관련개념 카드)이 발견되어 정정한다. 이는 work-order 5~8단계(RESUME/오버레이/CHAT 확장/METHOD) 착수와 무관하며, 5단계 착수 전 반드시 먼저 반영해야 하는 4b 보정 작업이다. **1차 실행**(ActionBar 4-way 상태표, 회귀 위험 낮음)과 **2차 실행**(개념설명/관련개념 카드, `Diagnosis` 백엔드 확장 선행 필요)으로 분리해 진행한다. 상세는 `docs/PROJECT_STATUS.md` §3.21 참고.

### 1.4 카메라 촬영 (`/camera`) / 미리보기 (`/camera/preview`, `/camera`의 자식 라우트)
- 촬영 완료 시 `/camera/preview`로 이동, "다시 촬영" 선택 시 `/camera`로 복귀. 촬영 데이터 없이 `/camera/preview`에 직접 접근하면 `/camera`로 리다이렉트한다.
- 코드 페이지명: `CameraCapturePage`(`/camera`), `CameraPreviewPage`(`/camera/preview`)
- 재사용: `Camera/Top Bar`, `Camera/Problem Sheet`, `Camera/Frame Guides`(촬영 전용), `Camera/Shutter`, `Button/Pill`(재촬영/사용)
- feature: `features/camera` (촬영 세션·이미지 상태를 로컬로 관리, URL·전역 상태 저장 금지)

### 1.5 마이페이지 (`/mypage`)
- 재사용: `Nav Tab Bar`, `shared/ui/button`(variant `select`/`logout`), `Filter Pill`, `HistoryRow`
- feature: `features/learning-history`

## 2. 공통 UI 우선 구축 순서 (`shared/ui`)

화면 구현보다 먼저 아래 공통 컴포넌트를 `docs/DESIGN_TOKEN_MAP.md` 토큰 기준으로 구축한다(이 순서를 따르면 이후 화면 작업에서 임의 스타일 반복을 방지할 수 있다):

1. `shared/styles/theme.css` — `docs/DESIGN_TOKEN_MAP.md` §1 표 전체를 CSS Variables로 정의
2. Tailwind 설정 확장 — 타이포그래피(§2), boxShadow(§3) 커스텀 값 등록
3. `shared/ui/button` (variant: primary/social/pill/select/logout)
4. `shared/ui/card`
5. `shared/ui/input`
6. `shared/ui/app-shell` (StatusBar, 레이아웃 셸)
7. `shared/ui/nav-tab-bar`, `shared/ui/filter-pill`
8. `shared/ui/modal`, `shared/ui/toast`, `shared/ui/spinner` (PRD 요구사항상 필요, 아직 화면에서 실측되지 않음 — 표준 상태값으로 구현 후 design-agent 검수)

## 3. pages / features / shared 책임 분리

`.claude/rules/frontend.md` §1의 단방향 의존성(`app → pages → features → shared`)을 그대로 따른다.

- `pages/*`: 라우트 진입점, 레이아웃 조립, `features` 컴포넌트 배치만 — 비즈니스 로직 금지
- `features/*`: 화면별 사용자 시나리오 로직(캔버스, 인식, AI 호출, 채팅 등) — 서로 직접 참조 금지
- `shared/*`: 위 §2의 공통 UI, API 클라이언트, 훅, 토큰 스타일

## 4. 영향받는 파일 (신규 생성, `docs/PROJECT_STRUCTURE.md` 기준)

이번 계획 실행 시 최초로 생성되는 디렉터리: `apps/web/src/{app,pages,features,shared}` 전체(현재 `apps/web`은 완전히 빈 폴더). 세부 파일 목록은 화면별 구현 착수 시 `plan-agent`가 매번 구체화한다 — 이 문서는 상위 순서만 정의한다.

## 5. 구현 순서

1. Vite + React + TS 프로젝트 스캐폴딩, Tailwind CSS 4 설정 (별도 작업, 이번 문서화 범위 아님)
2. `shared/styles/theme.css` + Tailwind 토큰 확장 (§2.1~2.2)
3. `shared/ui` 공통 컴포넌트 (§2.3~2.8)
4. 라우팅 뼈대 (`app/router.tsx`) — §6 라우트 네이밍 결정 후 진행
5. 화면 구현 순서: **문제 풀기(`/solve`) 우선** (핵심 가치 화면, 가장 많은 신규 컴포넌트 필요) → 로그인 → 학년 선택 → 카메라 → 마이페이지
6. 각 화면: `plan-agent`(설계) → `development-agent`(구현) → `design-agent`(검수) 순서로 진행 (`CLAUDE.md` "서브에이전트" 절 참조)

## 6. 완료 조건

- 화면별: Figma 스크린샷과의 시각적 diff 없음, `docs/COMPONENT_MAP.md`에 정의된 컴포넌트만 사용(임의 신규 컴포넌트 생성 없음), 디자인 토큰만 사용(임의 색상·픽셀값 없음), iPad 가로/세로/Split View 대응, loading/empty/error/disabled 상태 구현, 키보드/스크린리더 접근성, typecheck/lint/test/build 통과
- 전체: 6개 화면 모두 위 조건 충족 + §7 결정 필요 항목이 모두 해소되어 있을 것

## 7. 결정 필요 항목 (전체 취합)

2026-07-29 오너 결정으로 라우트/페이지 네이밍, 카메라 라우트 구조, 다크 모드 지원 여부는 해소되었다(`docs/FIGMA_SCREEN_MAP.md` 확정 사항, `docs/DESIGN_SYSTEM.md` §6 참고). 아래는 남은 결정 필요 항목이다.

| 항목 | 출처 | 내용 |
|---|---|---|
| Radius 전체 스케일 | DESIGN_SYSTEM §5 | `radius/14` 외 미확인. Figma Variable 자체가 없음 — raw 값 실측 → 반복값 식별 → 토큰명 제안 표 작성 → 오너 승인 순서로 별도 진행 |
| Spacing 스케일 | DESIGN_SYSTEM §7 | 문서화된 스케일 없음, Radius와 동일한 프로세스로 별도 진행 |
| `Chat Bubble` / `Math Activity Card` 위치 | DESIGN_SYSTEM §7, COMPONENT_MAP §3 | 6개 화면(빈 상태)에 인스턴스 없음 — 최종 Variant 구현 보류 확정(2026-07-29). 대화 진행 상태 프레임이 화면맵에 추가되기 전까지 범위 확장 안 함 |
| `Button/Login` variant 구분 | COMPONENT_MAP §1 | Kakao/Google/이메일 3개가 동일 인스턴스명 — 실제 variant 속성 확인 필요 |
| `Button/Selct` 오탈자 | COMPONENT_MAP §1 | Figma 컴포넌트명 자체의 오탈자 여부 확인 필요 |
| 커스텀 폰트 weight(590) 토큰화 | DESIGN_TOKEN_MAP §2 | Tailwind 기본 스케일에 없는 weight 도입 여부 |
| Next.js 언급 자료 처리 | CLAUDE.md, PRD §6 | PRD 본문의 Next.js 권장은 무시하고 Vite로 진행(이미 확정, 재확인용으로만 기재) |
| WORK-2/3 중간 상태 Figma 미확인 | design-agent 2026-09-04 조사(완료), §1.3.1 3단계 | **결론: 해당 프레임 Figma에 없음.** `MathService` 파일(fileKey `ltyPrCk8UT8DsB3tFuw7Sr`) 전체(단일 페이지, `3-0`/`3-1`/`3-2` 행에 물리적으로 빈 공간 없음, 인접 node-id 전수 확인)를 조사했으나 줄 단위 인식/수정/저신뢰도 경고를 모두 갖춘 WORK-진행-중 프레임은 존재하지 않음. 참고 가능한 단서: (1) `Solve/Work Line` 심볼(`248:53`, 356×26px, 줄번호 11px Bold + 본문 13px + 판정 Badge) — 단 이건 `3-2` 결과/진단 화면 전용이며 배지는 "정답 판정(확인/막힌 지점)"이지 "인식 신뢰도"가 아님, variant 없는 단일 symbol. (2) "인식된 문제" 행의 "수정" 텍스트 링크(`254:64`, `--brand/indigo`) — 파일 전체에서 유일한 편집 진입 어포던스이나 대상이 문제 텍스트이지 학생 풀이 줄이 아님. **저신뢰도 경고 배지(색상/문구)와 인라인 편집 모드 UI는 Figma 실측값이 없으므로 development-agent가 임의로 만들 수 없다** — Figma 담당자에게 신규 프레임 제작을 요청하거나, 기존 배지 컴포넌트 톤 팔레트를 재사용한 최소 임시값으로 처리 후 추후 교체(과거 `icon="error"` Modal variant, `ChatBubble` 임시 구현과 동일한 선례)하는 두 방향 중 오너 결정 필요. **2026-09-05 오너 결정: 임시값(기존 배지 톤 팔레트 재사용)으로 `WorkLineEditor` 우선 구현 진행, Figma 정식 디자인이 추가되면 교체.** |
| 막힌 지점(stuck-point) 데이터 모델 | §1.3.1 6단계 | 스트로크 구간 또는 y좌표 범위를 WorkLine에 매핑하는 데이터 모델이 PRD §7에 없음 — `HandwritingHighlightOverlay` 착수 전 정의 필요 |
| CAS 검증 서비스 연동 시점 | PRD §6.1, §1.3.1 4단계 | Python/SymPy 기반 별도 서비스(`CAS_SERVICE_URL`)가 준비되지 않았다면 결정론적 스텁으로 대체하고 실제 연동은 별도 작업으로 분리 |
| METHOD(§4.8) 화면 Figma 미확인 | COMPONENT_MAP §3, §1.3.1 8단계 | 조사된 3개 프레임에 METHOD 전용 화면이 없음 — 별도 Figma 확인 필요, work-order 8단계는 확인 전까지 착수하지 않음 |
| `curriculum_nodes` 확장 컬럼 UI 반영 범위 | PRD §7 | `definition_md`/`common_misconceptions` 확장 컬럼을 DiagnosisCard 등 화면에 어느 범위까지 노출할지 미정 — 백엔드 연동 단계(§1.3.1 4~5단계)에서 결정 |
| "학생 풀이 골드셋" 공공데이터 연계 | 제안서2.md, PRD §7 | 300~500건 골든셋 구축 시 공공데이터 활용 여부 "추후 검토"로 보류 — 현재 프론트엔드 구현 범위에는 영향 없음(참고용으로만 기재) |
| `RecognizedProblemBar` 배지 라벨 실측 불일치 | design-agent 2026-09-05 재검수(WorkLineEditor 검수 중 발견) | 배지 라벨이 "인식됨"인데 Figma 실측은 "인식된 문제"(node `254:60`~`254:62`) — 기존 컴포넌트의 기존 결함, Solve v2.0 work-order 범위 밖. 별도 티켓으로 처리 필요 |
| `Badge` `chip` size 실측 불일치 | design-agent 2026-09-05 재검수 | `rounded-[6px]`/`font-normal`인데 실제 사용처(`254:61`) 실측은 `rounded-[8px]`/`font-[590]` — 기존 부채(Solve v2.0 신규 도입분 아님), `chip`을 쓰는 다른 화면(AUTH 등) 영향 범위 확인 후 처리 |
| `elevatedCardStyle.ts` 중복 | design-agent 2026-09-05 재검수 | `features/ai-solution`과 `features/work-input`에 동일 상수가 중복 존재(feature 간 직접 참조 금지 규칙 때문에 불가피) — `.claude/rules/frontend.md` §2 "3회 이상 반복 시 공통 컴포넌트로 분리" 기준 충족, `shared/ui` 승격 검토 필요 |
| ~~`DiagnosisCard.tsx` 로컬 `Diagnosis` 타입 중복~~ | stage-qa-agent 2026-09-05 (4a-1 QA) | **해결됨(4b, `docs/PROJECT_STATUS.md` §3.20)** — `DiagnosisCard.tsx`가 이제 `shared-types.Diagnosis`를 import한다 |
| DIAG-5(저신뢰도) 실이미지 재검증 필요 | stage-qa-agent 2026-09-05 (4a-2 QA, `docs/PROJECT_STATUS.md` §3.19) | `diagnose()`는 이미지가 아니라 인식된 텍스트만 받아 텍스트만으로 재현한 스모크에서는 `isLowConfidence:true`가 트리거되지 않음 — 4b에서 WORK(`recognizeWork`)→DIAG(`diagnose`) 실제 파이프라인이 연결됐으니(§3.20) 진짜 저신뢰도 필기 이미지로 재검증 필요, 여전히 미해결 |
| DIAG 결과 화면 Header 토픽 배지 미구현 | design-agent 2026-09-05 3차 재검수 (4b, `docs/PROJECT_STATUS.md` §3.20) | Figma `258:326` Header Actions에는 "새 문제" 배지 옆에 토픽 배지(예: "이차함수 › 최대·최소")도 있으나 `shared-types.Diagnosis`에 대응 필드가 없어 미구현(코드에 결정 필요 주석 명시). `Diagnosis`에 토픽/개념 필드를 추가할지 오너 결정 필요 — 여전히 미해결(2026-09-06 재확인, 블로킹 아님) |
| ~~DIAG ChatFooter 해시태그 pill 데이터 모델 미확정~~ | design-agent 2026-09-06 재조사 | **해결됨(2026-09-06)** — `["#개념설명"(고정), ...관련 개념 태그(가변), "#비슷한 문제"(고정)]` 4-패턴으로 확정. V1.0 old/V2 공통으로 이미 존재하던 기존 스펙(신규 아님). 상세는 `docs/COMPONENT_MAP.md` §2 "후속 질문 입력 영역" 행 참고 |
| ~~WORK 캔버스 빈 상태 힌트 미구현~~ | design-agent 2026-09-06 재조사 | **해결됨(2026-09-06)** — Figma `242:528` 실측 완료. `EmptyStateHint`(`features/solve-session`, 1차 실행)로 구현, `isWorkStage && workStrokes.length===0`일 때만 표시. INPUT 빈 상태 힌트(`260:454`)도 동일 컴포넌트로 함께 해소 |
| iPad 실기기(가로 1194×834/Split View) 렌더 미검증 | stage-qa-agent 2026-09-05 (4b 최종 QA) | 이번 QA는 코드/Figma 실측 대조와 jsdom 컴포넌트 테스트로만 검증됨 — 실기기 또는 시뮬레이터에서 DIAG 결과 화면/WORK 단계 레이아웃 확인 필요 |
| ~~로딩 마크(`LoadingMark`) 정확한 표시 크기~~ | design-agent 2026-09-06 실측(`190:866`) | **해결됨(오너 승인 2026-09-06)** — `size={48}`. Figma에 "로딩 화면" 전용 배치 프레임은 없어(라이브러리 컴포넌트로만 존재) 확정 근거는 오너 승인. 카드 래퍼(`ELEVATED_CARD_STYLE`) 제거, 화면(또는 캔버스 작업 영역) 정중앙 투명 배경 배치는 Figma 실측(배경/카드/보더 없는 순수 마크)으로 확정 |
| ~~"새 문제 풀기" 클릭 시 정확한 이동 경로/리셋 로직~~ | 이 세션 plan-agent 2026-09-06, 오너 승인 | **해결됨** — `ProblemInputProvider`에 신규 `startNewProblem()` 추가(recognize/solve/chat/diagnose/recognizeWork 상태 전부 리셋 + 양쪽 캔버스 clear), 기존 `beginReinput()`(같은 문제 재입력 전용)은 재사용하지 않는다. `SolveLandscapePage.tsx`에서 `onNewProblem={() => { startNewProblem(); navigate("/solve/pencilcanvas"); }}`로 연결 |
| ~~"사진 찍음, 아직 인식 전" 상태 `ProblemCard` 처리~~ | design-agent 2026-09-06, 오너 승인 | **해결됨** — `data===null`(사진도 필기도 없음)일 때만 `ProblemCard` 렌더링을 끄고 `EmptyStateHint`로 대체. `{imageUrl}` 케이스(사진 있음, 인식 전/후 무관)는 대응 Figma 프레임이 없어 기존 `ProblemCard` 렌더링 그대로 유지 |
| ~~캔버스 상단 "인식됨" 칩 신규 컴포넌트 폴더 위치~~ | 이 세션 plan-agent 2026-09-06, 오너 승인 | **해결됨** — `features/solve-session/RecognizedChip.tsx`로 확정(기존 `ProblemCard`/`ActionBar`와 같은 폴더, `/solve/landscape` 전용인 `ai-solution/RecognizedProblemBar`와 명확히 분리) |
| ~~"개념설명" pill 클릭 = 토글 vs Extend 폭 연동~~ | 이 세션 plan-agent 2026-09-06, 오너 승인 | **해결됨** — 클릭 시 로컬 state로 관련개념 카드 표시/숨김 **토글**(패널 폭 Extend/Default와는 독립). 폭에 결합하면 사용자가 수동으로 넓힌 경우와 카드 토글로 넓어진 경우가 뒤섞이는 부작용이 있어 배제 |
| ~~개념설명/관련개념 기능 적용 범위~~ | 이 세션 plan-agent 2026-09-06, 오너 승인 | **해결됨** — DIAG 결과 화면(`isDiagnosisReady`)에만 적용. 기존 solve 결과 화면(`isResultReady`, V1.0 old)은 `conceptMd`가 있으면 이미 상시 "관련 개념" `ResultCard`를 노출 중이라 적용 시 카드가 중복되므로 제외 |
| ~~해시태그 중간 "개념 태그" 개수 고정 vs 가변~~ | 이 세션 plan-agent 2026-09-06, 오너 승인 | **해결됨** — **가변**(`relatedConcepts` 배열 길이 그대로, `.slice(0,2)` 등 근거 없는 매직넘버 도입 안 함) |
| `ResultCard` 제목 필드 부재 | 이 세션 plan-agent 2026-09-06 통합 조사 | Figma 실측은 라벨+제목(15px Semibold)+본문 3단인데 `ResultCard.tsx`는 라벨+본문 2단뿐(제목 필드 없음, 기존 갭 재확인). 2차 실행에서 `title?: string` 옵셔널 추가(기존 2개 호출부 하위 호환 확인됨) |
| `Diagnosis` 개념 설명 본문 텍스트 백엔드 확장 | 이 세션 design-agent 2026-09-06 조사 | `Diagnosis.relatedConcepts: string[]`는 개념 **이름**만 있고 설명 본문이 없어 "관련개념" 카드를 채울 수 없음 — `curriculum_nodes.definition_md`(PRD §7에 이미 존재하는 컬럼) 조인으로 API 응답 확장 필요(신규 컬럼/테이블 불필요). 2차 실행 범위, 진단 프롬프트/어댑터 동기화 포함 |

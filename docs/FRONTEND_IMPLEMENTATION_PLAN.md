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
- 신규 정의 필요(최초 구현 시 한 번만 만들고 이후 재사용): `ProblemCard`, `ActionBar`, `ResultPanel`, `ChatInput` (`docs/COMPONENT_MAP.md` §2)
- 재사용: `Nav Tab Bar`, `Pen Rail`(캔버스 툴), `Result Card`, `Button/Pill`
- feature: `features/drawing-canvas`, `features/camera`, `features/problem-recognition`, `features/solve-session`, `features/ai-solution`, `features/follow-up-chat`, `features/similar-problems`
- 캔버스는 `CSS Modules` 사용 대상(유일하게 허용된 특수 스타일 영역, `.claude/rules/frontend.md` §3.4)

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

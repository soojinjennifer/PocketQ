# CLAUDE.md

이 저장소에서 작업하는 Claude Code(및 서브에이전트)를 위한 상시 규칙이다.

## 프로젝트

왜수학(WhyMath) — iPad 중심 수학 개념 튜터 웹앱. 제품 요구사항의 유일한 기준은 `docs/PRD_WHYMATH.md`이며, 다른 어떤 문서나 참고 자료보다 우선한다.

## 확정 프론트엔드 기술 스택

`docs/PRD_WHYMATH.md` §6.1에서 확정한 내용이며 임의로 변경하지 않는다.

| 영역 | 채택 기술 |
|---|---|
| 프론트엔드 | React + TypeScript + Vite |
| 라우팅 | React Router |
| 스타일링 | Tailwind CSS 4 + CSS Variables 기반 디자인 토큰 |
| 특수 스타일 | CSS Modules (필기 캔버스, 복잡한 애니메이션, 가상요소 등 제한적 용도만) |
| 디자인 시스템 | 공통 UI 컴포넌트 + 디자인 토큰 (색상/간격/글꼴/모서리/그림자 중앙 관리) |
| PWA | vite-plugin-pwa |

주의: 참고 자료(`references/claude-design/source/uploads/PRD_수학개념튜터.md` 등)에 언급된 **Next.js는 채택하지 않는다.** 위 표가 유일한 기준이다.

## 폴더 구조

`docs/PROJECT_STRUCTURE.md`에 정의된 목표 구조를 따른다. 프론트엔드 소스는 `apps/web/src/{app,pages,features,shared}`로 구성한다.

- `app/` — 앱 부트스트랩, 라우터, 프로바이더
- `pages/` — URL 단위 화면 (조립만, 비즈니스 로직 없음)
- `features/` — 사용자 기능 단위 로직
- `shared/` — 공통 UI, API 클라이언트, 훅, 유틸, 디자인 토큰 스타일

상세 의존성·스타일링 규칙은 [.claude/rules/frontend.md](.claude/rules/frontend.md) 참조.

## 디자인 원칙

- **Figma가 시각적 기준이다.** 파일: `WhyMath Design System` (`references/claude-design/README.md` 참조). `references/claude-design`의 Claude Design ZIP/`.dc.html`은 참고 자료일 뿐이며, 코드를 그대로 복사하지 않는다.
- Figma와 참고 자료(ZIP)가 다르면 Figma를 우선한다.
- 임의의 색상값·픽셀값을 만들지 않는다. 토큰이나 Figma 실측값이 없으면 "결정 필요" 항목으로 남긴다.
- 동일한 UI를 화면마다 중복 생성하지 않는다 — `docs/COMPONENT_MAP.md`에 정의된 공통 컴포넌트를 재사용한다.

## 서브에이전트

`.claude/agents/`에 프로젝트 전용 에이전트가 정의되어 있다.

- `plan-agent` — 화면/기능 구현 전 구조·영향범위·재사용 컴포넌트·작업순서 분석 (읽기 전용)
- `design-agent` — 구현 화면의 Figma/토큰/공통 컴포넌트/반응형/접근성 준수 여부 검수 (읽기 전용)
- `development-agent` — 승인된 계획에 따라 실제 구현 및 테스트 수행

화면 구현은 반드시 `plan-agent` → (필요 시 `design-agent` 사전 검토) → `development-agent` → `design-agent`(사후 검수) 순서로 진행한다.

## 참고 문서

- `docs/PRD_WHYMATH.md` — 제품 요구사항 (최고 우선순위)
- `docs/PROJECT_STRUCTURE.md` — 목표 폴더 구조
- `docs/FIGMA_SCREEN_MAP.md` — 화면 ↔ Figma 프레임 ↔ 라우트 매핑
- `docs/DESIGN_SYSTEM.md` / `docs/DESIGN_TOKEN_MAP.md` / `docs/COMPONENT_MAP.md` — 확정 디자인 시스템/토큰/컴포넌트 지도
- `docs/FRONTEND_IMPLEMENTATION_PLAN.md` — 프론트엔드 구현 순서 및 완료 조건

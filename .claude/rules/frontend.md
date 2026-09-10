# 프론트엔드 의존성 및 스타일링 규칙

`apps/web/src` 대상. `docs/PRD_WHYMATH.md` §6.1/§6.2와 `docs/PROJECT_STRUCTURE.md`를 코드 수준 규칙으로 구체화한 것이다.

## 1. 폴더 의존성 방향 (단방향)

```
app → pages → features → shared
```

- `app/`은 `pages/`, `features/`, `shared/`를 모두 참조할 수 있다 (라우터/프로바이더 조립).
- `pages/`는 `features/`와 `shared/`만 참조한다. **pages는 조립만 하고 비즈니스 로직을 갖지 않는다.**
- `features/`는 `shared/`만 참조한다. **feature 간 직접 참조를 금지한다** — 다른 feature의 기능이 필요하면 `shared/`로 끌어올리거나 `pages/`에서 조합한다.
- `shared/`는 다른 어떤 계층도 참조하지 않는다 (`app`/`pages`/`features`에 의존 금지).
- 역방향 참조(`shared → features`, `features → pages` 등)는 항상 금지.

## 2. 컴포넌트 재사용 원칙

- 화면 단위로 전체를 하나의 컴포넌트로 만들지 않는다 — 화면은 `shared/ui`와 `features`의 조합이어야 한다.
- 동일한 UI 패턴(버튼, 카드, 탭바, 입력 필드 등)을 화면마다 새로 만들지 않는다. `docs/COMPONENT_MAP.md`에 정의된 공통 컴포넌트를 재사용한다.
- 재사용은 Tailwind 클래스 복사가 아니라 공통 UI 컴포넌트와 props/variant를 통해 구현한다.
- 동일한 Tailwind 클래스 조합이 3회 이상 반복되면 즉시 공통 컴포넌트 또는 variant로 분리한다.

## 3. 스타일링 규칙

1. 레이아웃, 여백, 반응형 처리는 Tailwind CSS를 사용한다.
2. 색상·글꼴·간격·모서리·그림자는 반드시 CSS Variables 기반 디자인 토큰(`docs/DESIGN_TOKEN_MAP.md`)을 통해서만 사용한다.
3. **임의 색상값/픽셀값을 만들지 않는다.** 필요한 토큰이 없으면 추측해서 만들지 말고 "결정 필요" 항목으로 기록한다.
4. CSS Modules는 필기 캔버스, 복잡한 애니메이션, 가상요소 등 Tailwind로 표현하기 어려운 경우에만 제한적으로 사용한다.
5. Figma의 고정 좌표를 그대로 옮기지 않고, iPad 가로/세로 모드와 Split View에 대응하는 반응형 레이아웃으로 변환한다.
6. 화면 전체를 채우는 고정/절대 레이아웃에는 `min-h-screen`/`h-screen`/`100vh`/(`position: fixed`인 요소의) `inset: 0` 대신 `min-h-dvh`/`h-dvh`/`100dvh`를 사용한다. iOS Safari에서 `vh` 계열 단위와 `inset: 0`은 브라우저 크롬(주소창/탭바)이 완전히 접힌 "큰 뷰포트" 기준으로 계산되어 실제 보이는 화면보다 커지고, 하단 고정 요소가 크롬에 가려지는 회귀를 반복적으로 일으킨다(카메라 촬영/미리보기 화면, Solve 화면 body 스크롤 잠금에서 실제 발생).

## 4. 코드 품질

- TypeScript strict 모드를 준수하며 `any`를 사용하지 않는다.
- 승인되지 않은 API/백엔드 기능을 프론트엔드에 임의로 구현하지 않는다.
- 새 npm 의존성을 추가하기 전에는 먼저 확인/승인을 받는다 (특히 UI 프레임워크, 상태관리, 스타일링 관련 라이브러리).

## 5. 작업 완료 게이트

작업 후 다음을 실행하고 통과를 확인한다:

```
typecheck → lint → test → build
```

하나라도 실패한 상태로 작업을 완료로 표시하지 않는다.

## 6. 참고 자료 사용 원칙

- Figma(`WhyMath Design System`)가 시각적 기준이다.
- `references/claude-design`의 Claude Design ZIP/`.dc.html` 프로토타입은 구조·콘텐츠 참고용일 뿐, 코드를 그대로 복사하지 않는다.
- Figma와 참고 자료가 다르면 Figma를 따른다.

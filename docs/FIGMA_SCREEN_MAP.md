디자인을 할때, 피그마에 있는 Math Design System을 반드시 참조하여 디자인하고, 여기에 있는 컴포넌트를 쓸 수 있을 경우 반드시 재사용이 가능하도록 공통 컨포넌트화 하여 디자인한다. 피그마 디자인 시스템 URL = https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=1-225&t=inChnhQt0UIeUlTU-1


디자인 가이드의 컴포넌트를 공통 컴포넌트화하여 react 컴포넌트에 반영한다. 

| 화면    | Figma 프레임명 (실측) | 프레임 URL    | 기준 크기 (실측) | 라우트            | 상태  |
| ----- | --------------- | --------: | -------------- | --- | --- |
| 회원가입   | `0. Register/Desktop` | [Figma 열기](https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=83-138&t=LrZQeZ022Z7LUbtl-4) | 1194×834 | `/register`       | 미구현 |
| 로그인   | `1. Login/Desktop` | [Figma 열기](https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=37-2&t=BQOVa0ToV9nrqwFf-4) | 1194×834 | `/login`       | 미구현 |
| 학년 선택 | `2. Grade Setup` |  [Figma 열기](https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=37-30&t=BQOVa0ToV9nrqwFf-4) | 1194×834 | `/grade-setup` | 미구현 |
| 문제 풀기 | `3 -1 · Solve/Pencilcanvas` | [Figma 열기](https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=127-445&t=4blrn7JcDarFlGoC-4) | 1194×834 | `/solve/pencilcanvas`       | 미구현 |
| 문제 풀기 | `3-2 · Solve/Landscape` | [Figma 열기](https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=38-21&t=BQOVa0ToV9nrqwFf-4) | 1194×834 | `/solve/landscape`       | 미구현 |
| 마이페이지 | `4 · MyPage` | [Figma 열기](https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=40-34&t=BQOVa0ToV9nrqwFf-4) | 1194×834 | `/mypage`       | 미구현 |
| 문제 촬영 · 카메라 | `5 · Capture.Camera` | [Figma 열기](https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=48-110&t=BQOVa0ToV9nrqwFf-4) | 1194×834 | `/camera`       | 미구현 |
| 문제 촬영 · 미리보기 | `6 · preview.Camera` | [Figma 열기](https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=51-129&t=BQOVa0ToV9nrqwFf-4) | 1194×834 | `/camera/preview` | 미구현 |


> 2026-07-26: Figma MCP(`get_metadata`, `get_screenshot`, `get_variable_defs`)로 6개 프레임 모두 실측 확인 완료. 프레임명·크기는 기존 표와 일치. 각 프레임의 실제 하위 컴포넌트 인스턴스는 `docs/COMPONENT_MAP.md` 참고.
>
> 2026-07-29: 이 문서를 화면명·라우트명의 최우선·단일 기준 문서로 오너가 확정. 6번 행 라우트 오기(`/camera` → `/camera/preview`) 정정.

## 확인된 사항

- 6개 화면 모두 기준 크기 1194×834로 동일 (iPad 가로 전체화면 — v1 공식 지원 환경. 세로·Split View는 별도 화면으로 구현하지 않고 전역 환경 가드 안내로 대체한다).
- 로그인 화면은 Kakao/Google/이메일 3개 버튼이 모두 동일 컴포넌트(`Button/Login`) 인스턴스로 구현되어 있음 — variant 구분은 COMPONENT_MAP.md에서 별도 정리 필요.
- 문제 풀기(Solve) 화면에서 `Problem Card`, `Action Bar`, `Result Panel`은 Figma 컴포넌트 인스턴스가 아니라 화면 전용 plain frame — 아직 재사용 컴포넌트로 정의되지 않음.
- `docs/DESIGN_COMPONENT.md`에 있는 `Chat Bubble`, `Math Activity Card`는 이번에 확인한 6개 화면(빈 상태 스냅샷)에는 인스턴스로 나타나지 않음 — 최종 Variant 구현을 보류한다(아래 "구현 보류" 참고).

## 확정 사항 (2026-07-29 오너 결정)

이 문서를 화면명·라우트명의 최우선·단일 기준 문서로 확정한다. `docs/PRD_WHYMATH.md`, `docs/PROJECT_STRUCTURE.md` 등 다른 문서의 명칭이 이 표와 다르면 이 표를 따른다.

1. **라우트/페이지 네이밍**: `/login`, `/grade-setup`, `/solve`, `/mypage`, `/camera`, `/camera/preview`로 확정. `/auth`, `/onboarding`, `history`/`profile` 분리 표기는 이번 단계에서 사용하지 않는다.
2. **카메라 라우트 구조**: 촬영(`5 · Capture.Camera`)은 `/camera`(부모), 미리보기(`6 · preview.Camera`)는 `/camera/preview`(자식, nested route)로 분리한다. 촬영 완료 시 `/camera/preview`로 이동, "다시 촬영" 선택 시 `/camera`로 복귀, 촬영 데이터 없이 `/camera/preview`에 직접 접근하면 `/camera`로 리다이렉트한다. 촬영 상태는 `features/camera`에서 로컬로만 관리한다(URL·전역 상태 저장 금지). 코드 페이지명: `CameraCapturePage`(`/camera`), `CameraPreviewPage`(`/camera/preview`).
3. **마이페이지 구조**: `/mypage` 단일 라우트로 유지한다. 이력 리스트·프로필 등은 별도 라우트가 아니라 `/mypage` 내부 영역(섹션)으로 구현한다.

## 구현 보류

- `Chat Bubble`/`Math Activity Card`: 6개 화면(빈 상태 스냅샷)에 인스턴스가 없어 최종 Variant 구현을 보류한다. 대화 진행 상태 프레임이 이 화면맵에 추가되기 전까지는 구현 범위를 확장하지 않는다.

## 컴포넌트(비라우트) 참고

아래는 URL 라우트가 없는 재사용 컴포넌트다 — 위 표(화면·라우트 기준)와 별도로 참고용으로만 기록한다. 실제 컴포넌트 인스턴스·variant 매핑은 `docs/COMPONENT_MAP.md`가 기준이다.

| 컴포넌트 | Figma 인스턴스명 | Figma 위치 | 비고 |
|---|---|---|---|
| 알림 팝업 | `Popup/Register`, `Popup/Login`, `Popup/Emailcheck` | [Figma 열기](https://www.figma.com/design/ltyPrCk8UT8DsB3tFuw7Sr/MathService?node-id=97-309&t=LrZQeZ022Z7LUbtl-4) (`Popup` 섹션, node `97:309`) | 2026-08-01 실측. 회원가입 완료/로그인 완료/이메일 인증 대기 3종. `shared/ui/modal`로 컴포넌트화(`docs/COMPONENT_MAP.md` 참고) |
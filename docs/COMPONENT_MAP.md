# 컴포넌트 지도 (Figma → shared/ui)

`docs/DESIGN_COMPONENT.md`(Figma 컴포넌트 원본 목록)와 2026-07-26 Figma MCP 실측(`get_metadata`, 6개 화면)을 대조해 작성했다. 화면마다 동일 UI를 새로 만들지 않도록, 아래 매핑을 유일한 기준으로 재사용한다.

## 1. 실제 Figma 컴포넌트 인스턴스 (화면별 실측)

| Figma 컴포넌트 | 등장 화면 | 인스턴스 수 | 제안 `shared/ui` 이름 | 비고 |
|---|---|---|---|---|
| `StatusBar` | 로그인, 학년선택, 문제풀기, 마이페이지 | 1회/화면 | `shared/ui/app-shell/StatusBar` | 상단 iOS 상태바 목업 |
| `Nav Tab Bar` | 문제풀기, 마이페이지 | 1회/화면 | `shared/ui/nav-tab-bar` | 문제풀기/마이페이지 전환 pill |
| `Button/Login` | 로그인 | 3회 (Kakao/Google/이메일) | `shared/ui/button` (`variant="social"` 등) | 3개 인스턴스가 같은 컴포넌트명 — Figma에서 variant 속성 재확인 필요(결정 필요) |
| `Grade Card` | 학년선택 | 6회 | `shared/ui/card` 또는 `features/grade-setup/GradeCard` | 선택 상태(border 강조) 포함 |
| `Pen Rail` | 문제풀기 | 1회 | `features/drawing-canvas/PenRail` | 참고 자료의 "Pan Rail" 표기는 오탈자, 실제 Figma명은 `Pen Rail` |
| `Button/Pill` | 문제풀기(풀기 버튼), 카메라 미리보기(재촬영/사용) | 총 3회 | `shared/ui/button` (`variant="pill"`) | |
| `Result Card` | 문제풀기 결과 패널 | 2회 | `shared/ui/card` 또는 `features/ai-solution/ResultCard` | |
| `Button/Selct` | 마이페이지 | 1회 | `shared/ui/button` (`variant="select"`) | Figma 인스턴스명 자체가 `Selct`(오탈자) — 원본 컴포넌트명 재확인 필요(결정 필요) |
| `Button/Logout` | 마이페이지 | 1회 | `shared/ui/button` (`variant="logout"`) | |
| `Filter Pill` | 마이페이지 | 5회 | `shared/ui/filter-pill` | 개념 필터 칩 |
| `History Row` | 마이페이지 | 4회 | `features/learning-history/HistoryRow` | |
| `Camera/Top Bar` | 카메라 촬영, 미리보기 | 1회/화면 | `features/camera/CameraTopBar` | |
| `Camera/Problem Sheet` | 카메라 촬영, 미리보기 | 1회/화면 | `features/camera/ProblemSheet` | |
| `Camera/Frame Guides` | 카메라 촬영 (미리보기에는 없음) | 1회 | `features/camera/FrameGuides` | 촬영 중에만 표시 |
| `Camera/Shutter` | 카메라 촬영 | 1회 | `features/camera/ShutterButton` | |
| `Button/Input` | 로그인·회원가입(이메일+비밀번호 묶음), 회원가입(닉네임 단일) | 로그인 1회, 회원가입 2회 | `shared/ui/input` (`InputGroup`) | `Property1=Email_Pass`(2필드 묶음)와 `Property1=input1`(단일 필드) variant. 회원가입은 닉네임 단일 필드 + 이메일/비밀번호 묶음 총 2개 인스턴스 사용(2026-08-01 실측) |
| `Popup/Register`, `Popup/Login`, `Popup/Emailcheck` | 회원가입 완료, 로그인 완료, 이메일 인증 대기 | 각 1회(모달, 화면 아님) | `shared/ui/modal` | 아이콘(체크는 텍스트 "✓", 이메일은 SVG asset)+제목+부제+구분선+하단 텍스트 버튼 구조. `docs/FIGMA_SCREEN_MAP.md` "컴포넌트(비라우트) 참고" 섹션 참고. 부제/구분선/보더 색은 `docs/DESIGN_TOKEN_MAP.md`의 `--color-modal-subtitle`/`--color-modal-divider`/`--color-modal-border` 신규 토큰 사용(2026-08-01 확정). `shared/ui/modal`의 `icon="error"` variant는 Figma에 대응 컴포넌트 없음 — 토큰만 재사용한 임시 variant이며, Figma에 정식 error/warning 팝업이 추가되면 교체 필요(2026-08-10 오너 확인) |

## 2. 아직 컴포넌트화되지 않은 화면 전용 요소 (plain frame, Figma 인스턴스 아님)

이 요소들은 Figma에서 재사용 컴포넌트로 등록되어 있지 않고 화면에 직접 그려진 frame이다 — 프론트엔드 구현 시 **신규로 공통/기능 컴포넌트를 설계**해야 하며, 화면마다 별도로 재구현하지 않는다.

| 요소 | 화면 | 제안 위치 |
|---|---|---|
| `Problem Card` | 문제풀기 | `features/solve-session/ProblemCard` |
| `Action Bar` (개념설명/풀이 체크박스 + 풀기 버튼) | 문제풀기 | `features/solve-session/ActionBar` |
| `Result Panel` (전체 우측 패널 컨테이너) | 문제풀기 | `features/ai-solution/ResultPanel` |
| 후속 질문 입력 영역 | 문제풀기 결과 패널 하단 | `features/follow-up-chat/ChatInput` |

## 3. `docs/DESIGN_COMPONENT.md`에는 있으나 이번 6개 화면에서 인스턴스 미확인 — 구현시 컴포넌트화 하여 재사용할 수 있도록 한다.

- `Chat Bubble` — 후속 질문 대화 화면(빈 상태가 아닌, 대화가 진행된 상태)에 존재할 것으로 추정되나 이번 조사 대상 6개 화면(빈 상태 스냅샷)에서는 확인되지 않음. 최종 Variant 구현을 보류한다(2026-07-29 확정).
- `Math Activity Card` — 마찬가지로 위치 미확인. 최종 Variant 구현을 보류한다.
- `History Row`(위 §1) — 마이페이지 내부 상세 화면이 화면맵에 별도로 추가되기 전까지 구현 범위를 확장하지 않는다.
- `Chat Bubble`, `Math Activity Card`, `History Row`는 서로 하나의 컴포넌트로 통합하지 않는다. 공통 외형은 `shared/ui`의 `Card` 또는 `Surface`를 재사용하고, 기능별 로직은 각 feature 내부에 둔다.
- `Icon/Refresh`, `Icon/Edit`, `Icon/Cancel`, `Icon/Erase` — `Pen Rail` 내부에 포함되어 있을 것으로 추정되나 개별 인스턴스로는 확인되지 않음(Pen Rail을 컴포넌트로 뜯어볼 때 재확인 필요).

실제 화면 구현 착수 전, 위 항목은 Figma에서 해당 상태/변형을 직접 열어 위치를 확인해야 한다 — 추측으로 컴포넌트를 새로 만들지 않는다.

## 4. 재사용 원칙

- 위 표에 있는 컴포넌트는 화면마다 새로 만들지 않고 `shared/ui` 또는 지정된 `features/*` 경로의 컴포넌트를 import해서 사용한다.
- `Button/*` 계열(`Login`, `Pill`, `Select`, `Logout`)은 전부 하나의 `shared/ui/button` 컴포넌트의 variant로 통합한다 — 화면별 버튼을 각각 새로 만들지 않는다.
- §2의 "아직 컴포넌트화되지 않은" 요소들은 처음 구현하는 화면(문제풀기)에서 한 번만 정의하고, 이후 재사용한다.

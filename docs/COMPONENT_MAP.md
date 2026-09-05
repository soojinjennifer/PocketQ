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
| 로그인 화면 "이메일을 잊었어요!"/"비밀번호를 잊었어요!" 링크, `PasswordResetModal`(code phase) "코드 다시 받기" 링크 | 로그인 | 화면 2회(node `203:328`/`203:330`, 부모 `203:347` "Forget") + 모달 1회 | `shared/ui/text-link`(`TEXT_LINK_STYLE`) | `SF Pro Semibold 15px/20px/590`, 색상 `--color-brand`, 밑줄. 배경 있는 pill/전체폭 모델인 `shared/ui/button`과 형태가 달라 공용 컴포넌트로 추출하지 않되, 여러 화면/컴포넌트에서 재사용하므로 문자열 상수는 `shared/ui/text-link/textLinkStyle.ts`로 공유 위치를 승격해 스타일 드리프트를 막는다(AUTH-9/AUTH-10, 2026-08-19) |
| AUTH-9/AUTH-10 팝업 3종(이메일 찾기 결과/로그인 이력 없음/비밀번호 변경 완료) | 로그인 | 각 1회(모달) | `shared/ui/modal`(icon="email"/"check") | **Figma에 대응 팝업 없음**(design-agent가 `Popup` 섹션 `97:309` 전체를 조사했으나 이 3종은 없음, 2026-08-18) — 기존 `Modal` 토큰만 그대로 재사용한 임시 콘텐츠(제목/문구)이며 오너 승인 하에 진행됨. Figma에 정식 디자인이 추가되면 문구/레이아웃 재검수 필요. `icon="error"` variant와 동일 성격의 임시 조치. 이 중 "로그인 이력 없음" 팝업은 확인/취소 2버튼 variant로 확장(2026-08-19) — 이 역시 Figma에 대응 2버튼 팝업이 없는 동일 성격의 임시 조치이며, `shared/ui/modal`의 `Modal`이 옵셔널 `cancelLabel`/`onCancel` prop을 받으면 하단 버튼 영역이 확인/취소로 균등 분할되고(취소는 `--color-modal-subtitle` 톤으로 톤다운), 두 prop이 없으면 기존 단일 버튼 레이아웃을 그대로 유지한다(하위 호환). "재설정 메일 발송 확인" 팝업은 2026-08-19 8자리 인증 코드 방식 재구현으로 제거되고 아래 `PasswordResetModal`의 code phase로 흡수됨 |
| 비밀번호 재설정 팝업(2단계: 인증 코드 입력 → 새 비밀번호 설정) | 로그인(비밀번호 재설정 흐름) | 1회(모달, `phase` prop으로 2단계 전환) | `features/auth/PasswordResetModal`(신규 컴포넌트) | **Figma에 대응 팝업 없음**(2026-08-18, 위와 동일 조사). `shared/ui/modal`은 입력 폼을 담을 수 없는 알림 전용 구조라 별도 컴포넌트로 신설 — 오버레이/카드/버튼 스타일은 `Modal.tsx`의 토큰을 문자 그대로 복사, 입력 필드는 `shared/ui/input`(`InputGroup`) 재사용. `phase="code"`는 이메일로 발송된 8자리 인증 코드 입력(`InputGroup` 필드에 `inputMode="numeric"`/`maxLength={8}` 재사용) + "코드 다시 받기"(`TEXT_LINK_STYLE`) + 확인 버튼, `phase="password"`는 기존 새 비밀번호/확인 입력 + 제출 버튼. 두 단계 모두 하단 "로그인 화면으로 돌아가기" 취소 경로를 공유한다(2026-08-19, 8자리 인증 코드 방식 재구현으로 1단계→2단계 팝업 구조로 확장; Supabase Auth의 recovery OTP 토큰 길이가 실측 8자리임을 확인하고 수정 — 2026-08-19). Figma에 정식 디자인이 추가되면 교체 필요 |
| `Solve/Work Line`(마스터 심볼 `248:53`, 356×26px) | 문제풀기 결과(`3-2 Solve/Landscape`, `Result Panel · V2 진단` 내부) | 3회(`254:67`/`254:72`/`254:77`) | `features/ai-solution/WorkLineList`의 개별 행 | 2026-09-04 design-agent 실측. 구조: 줄번호(순수 텍스트, 배지 아님, 11px Bold, `text-label-tertiary`) + 풀이 내용(13px) + 판정 Badge(`Badge` `size="judgment"`(신규, `rounded-full px-[8px] py-[2px] text-[11px] font-[590]`), "확인"=`variant="tint-green"`(기존 토큰), "막힌 지점"=`variant="tint-red"`(신규, `--color-accent-red #c97b6e`/`--color-fill-tint-red rgba(201,123,110,0.2)`, `docs/DESIGN_TOKEN_MAP.md` 2026-09-05 추가)+행 배경은 같은 토큰의 50% 추가 감쇠(`bg-fill-tint-red/50`)로 표현). **주의**: 이 배지는 "인식 신뢰도"가 아니라 "정답 판정(확인/막힌 지점)"이며, variant 없는 단일 symbol이라 저신뢰도 warning 상태는 Figma에 없음(§3 참고). WORK 단계 진행 중 화면(`3-1`)에는 이 컴포넌트가 쓰이지 않음 — DIAG 결과 표시(`WorkLineList`)에만 이 실측값을 근거로 쓰고, `WorkLineEditor`(WORK 진행 중 편집)의 저신뢰도/편집 UI는 Figma 실측값이 없다. **2026-09-05 사후검수 정정**: 최초 구현은 줄번호를 배지로, 판정 배지를 `tint-green`/`size="chip"`(라벨 "확인됨")으로, `isLowConfidence`(신뢰도) 분기까지 잘못 포함했었다 — design-agent 사후검수로 발견되어 위 실측값대로 재작성 완료(`isLowConfidence` 필드는 `WorkLineList`의 `WorkLine`에서 완전히 제거됨) |

## 2. 아직 컴포넌트화되지 않은 화면 전용 요소 (plain frame, Figma 인스턴스 아님)

이 요소들은 Figma에서 재사용 컴포넌트로 등록되어 있지 않고 화면에 직접 그려진 frame이다 — 프론트엔드 구현 시 **신규로 공통/기능 컴포넌트를 설계**해야 하며, 화면마다 별도로 재구현하지 않는다.

| 요소 | 화면 | 제안 위치 |
|---|---|---|
| `Problem Card` | 문제풀기 | `features/solve-session/ProblemCard` |
| `Action Bar` (v2.0: 문제 인식하기 / 아직 못 풀겠어요 / 봐 주세요 3분할. 기존 개념설명/풀이 체크박스 2분할은 폐기(`~~SOLVE-1~~`). 단계별(INPUT/WORK/DIAG·RESUME) 버튼 활성 상태는 `shared/lib/solve/actionBarState.ts`의 `getActionBarState(input)`이 결정. **구조는 "독립 버튼 3개"가 아니라 "세그먼트 컨트롤 1개"** — 실제 Figma `Solve/Action Bar`(마스터 `260:101`, variant `Stage=Problem`=`260:92`/`Stage=Work`=`249:69`, 인스턴스 `256:405`) 실측: 컨테이너 `gap-[2px] p-[6px] rounded-full bg-glass-fill border-glass-border` + 세그먼트 3개(`px-[20px] py-[10px]`) 사이 `w-px h-[22px] bg-separator` divider 2개. 그 단계의 주 행동 1개만 `bg-brand-deep`+`text-label-on-dark`+`Elevation/Floating Bar` 그림자로 강조하고 나머지는 배경 없는 텍스트(`text-label-secondary`, 비활성 시 `opacity-40`). `shared/ui/button`의 `pill-*` variant를 쓰지 않고 전용 마크업으로 구현(2026-09-05 design-agent 사후검수 P0 결함 발견 → 재작성 완료, 첫 구현이 인용한 `node 38:48`/`127:452`는 파일에 존재하지 않는 노드였음)) | 문제풀기 | `features/solve-session/ActionBar` |
| `Result Panel` (전체 우측 패널 컨테이너) | 문제풀기 | `features/ai-solution/ResultPanel` |
| `WorkLineEditor` (신규, 미구현 — WORK 단계 줄 단위 손글씨 인식 입력) | 문제풀기(`/solve/pencilcanvas`, WORK) | `features/work-input/WorkLineEditor` |
| `WorkLineList` (신규, 미구현 — 인식된 풀이 줄 목록 표시) | 문제풀기 결과 패널 | `features/ai-solution/WorkLineList` |
| `DiagnosisCard` (신규, 미구현 — 막힌 지점/오류 유형 진단 결과) | 문제풀기 결과(`/solve/landscape`, DIAG) | `features/ai-solution/DiagnosisCard` |
| `ResumeModeBar` (신규, 미구현 — 이어풀기 모드 전환 바) | 문제풀기 결과(`/solve/landscape`, RESUME) | `features/ai-solution/ResumeModeBar` |
| `ResumeResultCard` (신규, 미구현 — 이어풀기 결과 카드) | 문제풀기 결과(`/solve/landscape`, RESUME) | `features/ai-solution/ResumeResultCard` |
| `HandwritingHighlightOverlay` (신규, 미구현 — 막힌 지점 하이라이트. `HandwritingCanvas` 내부는 수정하지 않고 별도 sibling 레이어로 구현) | 문제풀기(WORK) | `features/drawing-canvas/HandwritingHighlightOverlay` |
| `Width=Default`/`Width=Extend`/`Width=Close` (Result Panel 좌측 드래그 핸들, 컴포넌트 갤러리 `174:638`/`174:640`/`174:743`, 갤러리 프레임 `174:639` 근방) | 문제풀기 결과(`/solve/landscape`) | `features/ai-solution/ResultPanelResizeHandle` | `ResultPanelShell`이 `width`(`"default"`\|`"extend"`\|`"close"`) prop과 `onExtend`/`onBackToDefault`/`onClose`/`onOpen` 콜백을 받아 좌측에 이 핸들을 항상 렌더링한다(24×88px, 패널 세로 중앙 고정). Default: 위쪽 버튼이 Extend로 전환(막대+좌측화살표 아이콘), 아래쪽 버튼이 Close로 전환(우측 쉐브런). Extend: 위쪽 버튼이 Default로 되돌림(우측화살표+막대, 좌우 반전 아이콘), 아래쪽 버튼은 Default와 동일하게 Close로 전환. Close: 콘텐츠(헤더/바디/푸터) 렌더링 없이 폭만 24px(`w-6`)로 줄고, 위쪽 버튼이 Extend로 전환(Default 위쪽과 동일 아이콘), 아래쪽 버튼이 Default로 되돌림(좌측 쉐브런, Close 아이콘을 180도 회전). 패널 폭은 Default `w-[min(420px,45vw)]`/Extend `w-[min(748px,90vw)]`(748px는 Figma 실측, 90vw 상한은 결정 필요)/Close `w-6`이며 `transition-[width] duration-300`(300ms는 결정 필요)로 전환된다 |
| 후속 질문 입력 영역 | 문제풀기 결과 패널 하단 | `features/follow-up-chat/ChatFooter`(입력창+전송 버튼+해시태그 pill 행 셸), `features/follow-up-chat/SuggestionPill`(Body 최하단 제안 질문 pill, `Badge` `variant="outline"`/`size="footnote"` 재사용) — 2026-08-16 구현. `ResultPanel`(features/ai-solution)이 `follow-up-chat`을 직접 import하지 않도록(feature 간 참조 금지) `chatContent`/`chatFooter` 슬롯 props로만 받고, 실제 조립은 `pages/solve/landscape/SolveLandscapePage`가 담당한다 |

## 3. `docs/DESIGN_COMPONENT.md`에는 있으나 이번 6개 화면에서 인스턴스 미확인 — 구현시 컴포넌트화 하여 재사용할 수 있도록 한다.

- `Chat Bubble` — 후속 질문 대화 화면(빈 상태가 아닌, 대화가 진행된 상태)에 존재할 것으로 추정되나 이번 조사 대상 6개 화면(빈 상태 스냅샷)에서는 확인되지 않음. 최종 Variant 구현을 보류한다(2026-07-29 확정). **2026-08-16 업데이트**: 6.5A(후속 질문 채팅 프론트엔드) 구현 시 design-agent가 다시 광범위하게 탐색했으나 여전히 대화가 진행된 상태의 Figma 프레임을 찾지 못했다 — 오너가 "임시 버블로 우선 구현, 추후 Figma 확정 시 교체"를 승인해 `features/follow-up-chat/ChatBubble`을 신규 색상 없이 기존 토큰만으로 구현했다(사용자 질문 `bg-fill-tint-brand`, AI 답변 `bg-bg-elevated` + `ResultCard`와 동일한 Elevation/Card 그림자). `shared/ui/modal`의 `icon="error"` variant와 동일한 성격의 임시 조치이며, 정식 Chat Bubble 디자인이 Figma에 추가되면 교체해야 한다.
- `Math Activity Card` — 마찬가지로 위치 미확인. 최종 Variant 구현을 보류한다.
- `History Row`(위 §1) — 마이페이지 내부 상세 화면이 화면맵에 별도로 추가되기 전까지 구현 범위를 확장하지 않는다.
- `Chat Bubble`, `Math Activity Card`, `History Row`는 서로 하나의 컴포넌트로 통합하지 않는다. 공통 외형은 `shared/ui`의 `Card` 또는 `Surface`를 재사용하고, 기능별 로직은 각 feature 내부에 둔다.
- `Icon/Refresh`, `Icon/Edit`, `Icon/Cancel`, `Icon/Erase` — `Pen Rail` 내부에 포함되어 있을 것으로 추정되나 개별 인스턴스로는 확인되지 않음(Pen Rail을 컴포넌트로 뜯어볼 때 재확인 필요).
- **METHOD(§4.8, 유사 문제 풀이법 목록) 화면** — 2026-09-04 design-agent가 조사한 3개 신규/재조사 프레임(`3-0 Solve/Default`, `3-1 Solve/Pencilcanvas`, `3-2 Solve/Landscape`)에는 METHOD 전용 화면이 없음. 결정 필요 항목(아래 `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §7 참고)이며, work-order 7단계(METHOD) 착수 전 별도 Figma 확인이 필요하다.
- **WORK 단계 줄 단위 인식/수정/저신뢰도 경고 UI** — 2026-09-04 design-agent가 `MathService` 파일 전체(단일 페이지, `3-0`/`3-1`/`3-2` 행 물리적 빈 공간 없음, 인접 node-id 전수 확인 포함)를 조사했으나 해당 상태의 전용 프레임을 찾지 못함(**확인된 없음**, 추정 아님). 참고 가능한 유일한 단서는 위 §1의 `Solve/Work Line` 심볼(단, 저신뢰도/편집 상태 없음)과 "인식된 문제" 행의 "수정" 텍스트 링크(`254:64`, 대상이 문제 텍스트이지 학생 풀이 줄 아님) 뿐이다. `WorkLineEditor`(work-order 3단계) 착수 전 오너가 (a) Figma 신규 프레임 제작을 요청하거나 (b) 기존 배지 톤 팔레트 재사용 임시값(추후 교체 전제)으로 진행할지 결정해야 한다.

실제 화면 구현 착수 전, 위 항목은 Figma에서 해당 상태/변형을 직접 열어 위치를 확인해야 한다 — 추측으로 컴포넌트를 새로 만들지 않는다.

## 4. 재사용 원칙

- 위 표에 있는 컴포넌트는 화면마다 새로 만들지 않고 `shared/ui` 또는 지정된 `features/*` 경로의 컴포넌트를 import해서 사용한다.
- `Button/*` 계열(`Login`, `Pill`, `Select`, `Logout`)은 전부 하나의 `shared/ui/button` 컴포넌트의 variant로 통합한다 — 화면별 버튼을 각각 새로 만들지 않는다.
- §2의 "아직 컴포넌트화되지 않은" 요소들은 처음 구현하는 화면(문제풀기)에서 한 번만 정의하고, 이후 재사용한다.

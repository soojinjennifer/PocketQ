# 디자인 토큰 매핑 (Figma → CSS Variables → Tailwind)

`docs/DESIGN_SYSTEM.md`에서 확정한 Figma 변수를 실제 구현에서 사용할 CSS Variable 이름과 Tailwind 설정에 매핑한다. **CSS Variable 이름은 이 문서를 유일한 기준으로 한다** — `shared/styles/theme.css` 작성 시 이 표를 그대로 따른다.

## 1. 색상

| Figma 변수 | 값 | 제안 CSS Variable | 참고 자료 대응 이름(있는 경우) |
|---|---|---|---|
| `label/primary` | `#232b38` | `--color-label-primary` | `colors-pastel.css`의 `--brand-ink` (동일 값) |
| `label/secondary` | `#3c3c4399` | `--color-label-secondary` | — |
| `label/tertiary` | `#3c3c434d` | `--color-label-tertiary` | — |
| `label/quaternary` | `#3c3c432e` | `--color-label-quaternary` | — |
| `label/on-dark` | `#ffffff` | `--color-label-on-dark` | — |
| `label/on-dark-secondary` | `#ffffffb2` | `--color-label-on-dark-secondary` | — |
| `bg/primary` | `#eceae2` | `--color-bg-primary` | `math-material.css`의 `--math-surface-canvas` (동일 값) |
| `bg/canvas` | `#fbfaf6` | `--color-bg-canvas` | `math-material.css`의 `--math-glass-fill` (동일 값) |
| `bg/canvas-texture` | `#fbfaf6`(design-agent 2026-09 정정, 이전 `#f5f2ed`는 추정값) | `--color-bg-canvas-texture` | 필기 캔버스 배경 텍스처 전용(`/solve/pencilcanvas`·`/solve/landscape`) — Figma MCP `get_variable_defs`(`38:21`/`127:445`)엔 이 화면에 별도 `bg/canvas-texture` 변수가 없고, 두 프레임 스크린샷의 도트 없는 영역 픽셀이 `bg/canvas`(`#fbfaf6`)와 정확히 일치함을 확인해 `--color-bg-canvas`와 동일 값으로 정정했다. 도트 패턴 자체(24px 타일/4×4px 하드엣지/약 3% 불투명도)는 `shared/styles/textures.css`의 `.bg-canvas-texture` 주석 참고 |
| `bg/elevated` | `#ffffff` | `--color-bg-elevated` | `math-material.css`의 `--math-glass-fill-strong` |
| `bg/viewfinder` | `#2f3745` | `--color-bg-viewfinder` | 신규 (카메라 전용) |
| `bg/camera-sheet` | `#232b38` | `--color-bg-camera-sheet` | 신규 (카메라 전용) |
| `brand/indigo` (`accent/primary`) | `#5e6e82` | `--color-brand` | `colors-pastel.css`의 `--brand` (동일 값) |
| `accent/primary-deep` | `#46536a` | `--color-brand-deep` | `colors-pastel.css`의 `--brand-deep` (동일 값) |
| `brand/tint`(불투명) | `#c3ccd9` | `--color-brand-tint` | 신규. 2026-09 design-agent Figma 실측(`255:96` 이어풀기 최종 답 배너). 기존 `--color-fill-tint-brand`(반투명 `#5e6e8229`)와는 다른 별도 토큰 |
| `accent/green` | `#6fa898` | `--color-accent-green` | `colors-pastel.css`의 `--accents-green` (동일 값) |
| `accent/purple` | `#9a93b0` | `--color-accent-purple` | `colors-pastel.css`의 `--accents-purple` (동일 값) |
| `accent/orange` | `#d9a05b` | `--color-accent-orange` | `colors-pastel.css`의 `--accents-orange` (동일 값) |
| `accent/yellow` | `#dcc08a` | `--color-accent-yellow` | `colors-pastel.css`의 `--accents-yellow` (동일 값) |
| `accent/red` | `#c97b6e` | `--color-accent-red` | 2026-09-05 `Solve/Work Line`(`248:53`) Figma 실측, `docs/COMPONENT_MAP.md` §1 참고 |
| `accent/steel` | `#6c8693` | `--color-accent-steel` | 신규. 2026-09 design-agent 사후검수, Figma MCP `get_design_context`(`Button/Pill` 인스턴스 `279:1202`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`, 마이페이지 "풀이 내역 지우기" 버튼 활성 배경) — 이전엔 `--color-brand-deep`으로 근사했으나 확연히 다른 톤이라 별도 등록 |
| `color-brand-rest` | `#3e4c5f` | `--color-brand-rest` | 신규. 2026-09 design-agent 사후검수, Figma MCP `get_design_context`(체크박스 인스턴스 `I279:1204;279:839`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`, 마이페이지 체크박스 checked 배경/보더) — `--color-brand-deep`(`#46536a`)과는 다른 별도 톤 |
| `separator` | `#3c3c431f` | `--color-separator` | — |
| `fill/quaternary` | `#7676801f` | `--color-fill-quaternary` | — |
| `fill/tint-blue` | `#5e6e8229` | `--color-fill-tint-brand` | brand 16% 알파 |
| `fill/tint-green` | `#6fa8982e` | `--color-fill-tint-green` | accent-green 18% 알파 |
| `fill/tint-red` | `rgba(201,123,110,0.2)` | `--color-fill-tint-red` | 2026-09-05 `Solve/Work Line`(`248:53`) Figma 실측, `docs/COMPONENT_MAP.md` §1 참고 (accent-red 20% 알파, 행 배경은 같은 값의 50% 재사용인 `bg-fill-tint-red/50`으로 10% 알파 재현) |
| `glass/fill` | `#fbfaf6f5` | `--color-glass-fill` | — |
| `glass/border` | `#ffffffd9` | `--color-glass-border` | — |
| `kakao/yellow` | `#fee500` | `--color-kakao-bg` | 신규 (소셜 로그인 전용) |
| `kakao/label` | `#191919` | `--color-kakao-label` | 신규 |
| `iConColor` | `#8a8a8e` | `--color-icon-default` | — |
| `color-stroke-1` | `#d3dce4` | `--color-stroke-1` | 신규. 2026-09 design-agent 사후검수, Figma MCP `get_design_context`(체크박스 인스턴스 `I279:1113;279:839`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`, 마이페이지 체크박스 unchecked 보더) — 불투명 블루그레이, `--color-label-quaternary`(반투명 다크 그레이)와 다른 별도 톤 |
| `bg/scrim` | `#d9d7d2` | `--color-bg-scrim` | 신규. 2026-09 design-agent 사후검수, Figma MCP `get_design_context`(`Button/Pill` 인스턴스 `279:930`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`, 마이페이지 "풀이 내역 지우기" 버튼 비활성 배경) — 앱 공용 pill 비활성 패턴(`--color-icon-default`)과 다른 이 화면 전용 값 |
| (Popup 전용 ink, `label/primary`와 동일 베이스 `#232b38` 다른 알파) | `rgba(35,43,56,0.65)` | `--color-modal-subtitle` | 2026-08-01 `Popup/Register`·`Popup/Login`·`Popup/Emailcheck` 실측. `label-secondary`(`#3c3c43` 계열)와 베이스가 달라 별도 토큰 |
| (Popup 전용 ink) | `rgba(35,43,56,0.12)` | `--color-modal-divider` | 위와 동일 출처, 팝업 내부 콘텐츠·버튼 영역 구분선 |
| (Popup 전용 ink) | `rgba(35,43,56,0.14)` | `--color-modal-border` | 위와 동일 출처, 팝업 카드 외곽 보더 |

> 참고 자료(`colors-pastel.css`)와 값이 정확히 일치하는 항목은 검증된 것으로 간주한다. `components/math/*.jsx`의 대체 브랜드값(`#4F8285` 등)은 Figma 실측과 다르므로 **사용하지 않는다**. `--color-modal-*` 3종은 2026-08-01 Figma `Popup` 섹션(node `97:309`) 실측 기준 신규 확정 토큰이며, 제목 텍스트(`#232b38`)와 아이콘 원 배경(`#5e6e82`)·버튼 텍스트(`#46536a`)·카드 배경(`#fbfaf6`)은 각각 기존 `--color-label-primary`/`--color-brand`/`--color-brand-deep`/`--color-bg-canvas`를 그대로 재사용한다(신규 토큰 아님, 중복 정의 없음).

## 2. 타이포그래피

`docs/DESIGN_SYSTEM.md` §3의 표를 Tailwind `fontSize`/`fontWeight`/`lineHeight` 조합 또는 커스텀 유틸리티 클래스(`.text-large-title` 등)로 그대로 옮긴다. weight `590`(Semibold)은 Tailwind 기본 스케일에 없으므로 `fontWeight: { semibold590: '590' }` 형태로 Tailwind 설정에 추가해야 한다 (결정 필요: 커스텀 weight 토큰 도입 여부).

## 3. Elevation / Shadow

`docs/DESIGN_SYSTEM.md` §4의 5개 토큰(`Elevation/Card`, `Tab Pill`, `Photo Card`, `Floating Bar`, `Glass Panel`)을 Tailwind `boxShadow` 커스텀 값으로 등록한다(예: `boxShadow: { card: '...', 'tab-pill': '...', ... }`). 멀티레이어 shadow이므로 CSS Variable 하나가 아니라 Tailwind 설정에 직접 문자열로 등록하는 방식을 권장한다.

## 4. Radius / Spacing — 결정 필요

Figma에 Radius/Spacing Variable Collection이 존재하지 않는다 — 임의의 스케일을 만들지 않고 다음 순서로만 진행한다(2026-07-29 확정 프로세스):

1. Figma 컴포넌트·프레임의 raw 값을 실측한다.
2. 반복되는 값을 식별한다.
3. `Figma 실측값 / 제안 토큰명 / 사용 화면·컴포넌트` 표를 작성한다.
4. 오너가 승인한 값만 디자인 토큰으로 구현한다.

- `radius/14` 외 반경 값이 확인되지 않았다. `docs/DESIGN_SYSTEM.md` §5/§7 참고. 화면 구현 착수 전 각 컴포넌트(Button, Card, Input, Grade Card 등)의 실제 반경을 위 프로세스로 재확인해야 한다.
- `radius/18`: `18px` — 2026-09 design-agent Figma 실측(`255:96` 이어풀기 최종 답 배너, `AnswerBox` `tone="resume"` 전용). 기존 반경 값들과 마찬가지로 별도 CSS Variable을 만들지 않고 Tailwind 임의값(`rounded-[18px]`)으로 코드에 직접 표현한다(코드베이스의 기존 `radius/14` 처리 방식과 동일, `rounded-[14px]` 리터럴이 여러 컴포넌트에 그대로 쓰이고 있다).
- Spacing 스케일 자체가 문서화되어 있지 않다(참고 ZIP도 "격자 없음"이라 명시). Tailwind 기본 spacing 스케일을 사용하되, 컴포넌트별로 필요한 값을 위 프로세스로 개별 확인한다.
- `radius/sm`: `2px` — 2026-09 design-agent 사후검수, Figma MCP `get_design_context`(체크박스 컴포넌트, node `279:816`/`279:818`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`) 실측. 마이페이지 개선 3번 체크박스(`shared/ui/checkbox/Checkbox.tsx`) 전용 — 기존에 임의로 쓰던 `rounded-[6px]`는 이 실측값과 맞지 않아 `rounded-[2px]`로 정정. `radius/14`/`radius/18`과 동일하게 별도 CSS Variable 없이 Tailwind 임의값으로 표현한다.

## 5. 사용 금지 목록

- `components/math/*.jsx`의 대체 브랜드/그림자 값 (`#4F8285`, `rgba(43,66,68,…)`) — Figma 실측과 불일치.
- 참고 ZIP `fig-tokens.css`의 `-xxxx`/`-yyyy`/`-zzzz` 접미사 placeholder 토큰 — 미해결 Figma 변수 바인딩.
- Plain iOS 테마 색상(`#007AFF` 등, `prototype-standalone.dc.html` 계열) — 채택된 테마 아님.

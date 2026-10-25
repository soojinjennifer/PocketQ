# 수풀잉 도형 시각화 디자인 명세 (Stage 2 사전 검토)

수풀잉(supuling) 풀이 화면에 붙는 **JSXGraph 도형·함수 그래프 패널**의 시각·상태·접근성 명세다. 데이터 계약은 `docs/FIGURE_SPEC.md`, 요구사항은 `docs/PRD_WHYMATH.md` §4.12(FIG), 진행 상태는 `docs/FIGURES_WORKFLOW_STATE.md`를 따른다.

> **Figma 대응 없음 — 임시 디자인(Figma 확정 대기).**
> 2026-10-24 design-agent가 Figma MCP로 `WhyMath Design System`(fileKey `ltyPrCk8UT8DsB3tFuw7Sr`)의 전체 페이지(`0:1` Page 1, `1:225` Design Guide, `26:4` KeyScreens)를 직접 확인했다. 그래프·도형·좌표평면·figure 관련 프레임/컴포넌트는 **없다**(추정 아님, 확인된 없음). `search_design_system`의 "graph"/"figure"/"geometry" 검색도 이 파일 라이브러리에서는 결과가 없었다(외부 커뮤니티 아이콘만 나옴). 그래서 `Action Menu`(`docs/COMPONENT_MAP.md`)와 같은 절차로 진행한다.
> - **새 색상을 만들지 않는다.** 모든 색은 `apps/web/src/shared/styles/tokens.css`의 기존 토큰이다. 알파는 기존 선례(`bg-fill-tint-red/50`, `bg-fill-tint-red/60`)처럼 기존 토큰에 불투명도만 곱한다.
> - 선 굵기·점 크기·dash·반지름처럼 실측 근거가 없는 픽셀 값은 §15 표에 모았다. **오너 승인(2026-10-24)**: 시안을 승인했고 §15 값을 확정값으로 쓴다. 단 P13(보드 높이 범위)은 오너 변경으로 **120~360px**이며, 높이 규칙은 §7.3 "내용 맞춤"으로 바뀌었다.
> - Figma에 정식 도형 패널이 추가되면 이 문서를 교체 기준으로 재검수한다.

- 렌더러 위치(plan-agent 계획): `apps/web/src/features/figure-visualization` — `FigureView(spec, stepId)`, JSXGraph SVG 렌더러, 실패 시 `FigureFallback`(description 텍스트).
- 설치 버전: `jsxgraph@1.14.1`(`apps/web/package.json`). 아래 JSXGraph 속성 이름은 이 버전의 `node_modules/jsxgraph/src/options.js`·`base/board.js`·`renderer/svg.js`를 읽고 확인했다.
- **Stage 4는 §3 매핑표를 그대로 재사용한다.**

---

## 1. 원칙

1. **색만으로 구분하지 않는다.** role은 색 + dash 패턴 + 굵기 + 점 모양(채움/속빔·크기)으로, 강조는 굵기 + 형광 언더레이 + 다른 요소의 비강조로 구분한다. 흑백으로 출력해도 given/auxiliary/result와 강조 여부가 구분돼야 한다.
2. **정확성 보증처럼 보이지 않는다(FIG-10).** "검증됨", "정확한 그림", 체크 아이콘, 녹색 성공 배지를 쓰지 않는다. 직각 표시는 명세의 `rightAngleMark`가 true일 때만 그린다. 겉보기로 90°에 가깝다고 자동 표시하지 않는다(§4.2).
3. **도형 단위로 전부 그리거나 전혀 그리지 않는다.** 렌더 도중 일부 요소가 실패하면 그 도형 전체를 `FigureFallback`으로 바꾼다. 일부만 그린 그림은 조건을 잘못 전달할 수 있다.
4. **읽기 전용이 기본이다.** Stage 2의 보드는 어떤 포인터·키보드 입력도 받지 않는다. 페이지(패널) 스크롤을 막지 않는다(§11).
5. **표면은 FigureView 밖에서 감싼다.** FigureView는 카드 표면을 갖지 않는다. 카드는 조립하는 쪽(Stage 2: `/dev/figures` 페이지)이 입힌다(§7.1).

## 2. 사용 토큰과 대비

배경은 보드 표면 `--color-bg-canvas`(`#fbfaf6`) 기준이다. WCAG 2.1 AA: 텍스트 4.5:1, 그래픽 요소(선·점) 3:1. 아래 값은 design-agent가 sRGB 상대 휘도 공식으로 직접 계산했다.

| 용도 | 토큰 | 값 | bg-canvas 대비 | 판정 |
|---|---|---|---|---|
| given 선·점, 모든 라벨 텍스트, 눈금 숫자 | `--color-label-primary` | `#232b38` | 13.64 | 텍스트·그래픽 통과 |
| auxiliary 선·점 | `--color-brand` | `#5e6e82` | 4.99 | 그래픽 통과(텍스트도 통과) |
| result 선·점 | `--color-accent-teal` | `#4f8285` | 4.13 | 그래픽 통과. **텍스트 4.5 미달 → result 라벨 텍스트에는 쓰지 않음** |
| 축 선 | `--color-label-secondary` | `#3c3c4399` | 3.38 | 그래픽 통과. **텍스트 미달 → 눈금 숫자에는 쓰지 않음** |
| 격자 | `--color-separator` | `#3c3c431f` | 1.23 | 장식(대비 기준 비적용) |
| 보드 테두리 | `--color-separator` | 〃 | — | 장식 |
| 강조 언더레이(형광펜) | `--color-accent-yellow` × α0.5 | `#dcc08a` | — | 보조 신호. 위에 올라간 선의 대비: ink 10.62 / brand 3.89 / teal 3.22 → 모두 3:1 유지 |
| 다각형·각 채움 | `--color-brand` / `--color-accent-teal` × α | — | — | 장식. 채움 위 선 대비 6:1 이상 유지 확인 |
| 라벨 halo | `--color-bg-canvas` | `#fbfaf6` | — | 선 위 라벨 가독성 |

**사용하지 않는 토큰과 이유**

- `accent-orange`(2.20)·`accent-green`(2.60)·`accent-purple`(2.80)·`accent-yellow`(1.68)·`accent-cyan`(1.76): 선 색으로 3:1 미달.
- `accent-red`(3.07): 대비는 겨우 넘지만 앱에서 "막힌 지점"(오류) 의미로 쓰고 있다(`HandwritingHighlightOverlay`, `Solve/Work Line`). 도형에 쓰면 오류로 오해할 수 있다.
- `fill-tint-green`: "확인"(정답) 판정 의미가 있어 정확성 보증처럼 읽힌다(FIG-10).

## 3. role × 상태 매핑표 (Stage 4 재사용)

### 3.1 상태 정의

| 상태 | 조건 |
|---|---|
| **기본** | 현재 단계의 `highlight`가 비어 있거나, 단계 분할에 실패해 최종 상태만 그릴 때. 보이는 모든 요소가 이 상태다. |
| **강조** | 현재 단계 `highlight`에 들어 있는 요소. |
| **비강조** | 현재 단계 `highlight`가 비어 있지 않은데, 그 목록에 없는 보이는 요소. |
| (숨김) | `appearAt` 이전이거나 `hide`된 요소. 그리지 않는다(상태가 아니라 표시 여부). |

비강조 불투명도는 role마다 다르게 둬서 **비강조여도 3:1 이상**을 지킨다(given 0.65 → 4.54, brand 0.75 → 3.07, teal 0.85 → 약 3.2).

### 3.2 선 계열 (선분·직선·반직선·원 둘레·다각형 변·함수 곡선)

JSXGraph 속성: `strokeColor`, `strokeOpacity`, `strokeWidth`, `dash`(정수, 1.14.1 `dashArray`: 1=`2,2` / 2=`5,5` / 3=`10,10`, `dashScale` 기본 false → 고정 px).

| role | 상태 | 선 색 토큰 | strokeOpacity | dash | 굵기(px) | 언더레이 |
|---|---|---|---|---|---|---|
| given | 기본 | `label-primary` | 1 | 0(실선) | 2 | 없음 |
| given | 강조 | `label-primary` | 1 | 0 | 3 | `accent-yellow` α0.5, 폭 10 |
| given | 비강조 | `label-primary` | 0.65 | 0 | 2 | 없음 |
| auxiliary | 기본 | `brand` | 1 | 2(`5,5`) | 1.5 | 없음 |
| auxiliary | 강조 | `brand` | 1 | 2 | 2.5 | `accent-yellow` α0.5, 폭 10 |
| auxiliary | 비강조 | `brand` | 0.75 | 2 | 1.5 | 없음 |
| result | 기본 | `accent-teal` | 1 | 0 | 2.5 | 없음 |
| result | 강조 | `accent-teal` | 1 | 0 | 3.5 | `accent-yellow` α0.5, 폭 10 |
| result | 비강조 | `accent-teal` | 0.85 | 0 | 2.5 | 없음 |

- **언더레이**는 같은 기하를 가진 복제 요소를 원래 요소 **아래 layer**에 굵게(폭 10, `lineCap` 기본) 그린다. 형광펜으로 밑줄 긋는 은유다. 점선 요소의 언더레이는 실선으로 그린다(띠가 끊기지 않게). JSXGraph의 `highlight*` 속성은 마우스 hover 전용이라 이 용도로 쓰지 않는다. 오히려 hover 강조가 생기지 않게 끈다(§11).
- given과 result는 둘 다 실선이지만 색(ink/teal)과 굵기(2/2.5), 그리고 결과 점 모양(§3.4)으로 구분한다. 흑백에서는 굵기·점 모양이 구분 신호다.

### 3.3 채움 (다각형·각 부채꼴)

`fillColor`, `fillOpacity`. 원은 채우지 않는다(§4.1).

| role | 채움 토큰 | 기본 α | 강조 α | 비강조 α |
|---|---|---|---|---|
| given | `brand` | 0.08 | 0.16 (= `--color-fill-tint-brand`와 같은 값) | 0.04 |
| auxiliary | 다각형: 없음 / 각: `brand` | 다각형 0 / 각 0.12 | 다각형 0 / 각 0.24 | 다각형 0 / 각 0.06 |
| result | `accent-teal` | 0.12 | 0.20 | 0.06 |

각(angle)의 채움 α는 다각형과 따로 둔다(given 각 0.12 / 강조 0.24 / 비강조 0.06, result 각은 위 result 행).

### 3.4 점 (point·midpoint·foot·intersection·tangentPoint·pointOnGraph 공통, role로만 결정)

JSXGraph: `face: 'o'`, `size`(원 반지름 px), `fillColor`, `strokeColor`, `strokeWidth`.

| role | 상태 | 모양 | 반지름(`size`) | 채움 | 테두리 |
|---|---|---|---|---|---|
| given | 기본 | 채운 원 | 3 | `label-primary` | `bg-canvas` 1.5(halo 링) |
| given | 강조 | 채운 원 + 언더레이 원 | 4.5 | `label-primary` | `bg-canvas` 1.5, 아래에 `accent-yellow` α0.5 원 반지름 9 |
| given | 비강조 | 채운 원 | 3 | `label-primary` α0.65 | `bg-canvas` 1.5 |
| auxiliary | 기본 | **속빈 원** | 3 | `bg-canvas` | `brand` 1.5 |
| auxiliary | 강조 | 속빈 원 + 언더레이 원 | 4.5 | `bg-canvas` | `brand` 2, 언더레이 반지름 9 |
| auxiliary | 비강조 | 속빈 원 | 3 | `bg-canvas` | `brand` 1.5, α0.75 |
| result | 기본 | 채운 원(크게) | 4 | `accent-teal` | `bg-canvas` 1.5 |
| result | 강조 | 채운 원 + 언더레이 원 | 5.5 | `accent-teal` | `bg-canvas` 1.5, 언더레이 반지름 10 |
| result | 비강조 | 채운 원 | 4 | `accent-teal` α0.85 | `bg-canvas` 1.5 |

- 흑백 구분: given = 작은 채운 점, auxiliary = 속빈 점, result = 큰 채운 점.
- 파생 점(중점·수선의 발 등)도 따로 스타일을 두지 않고 `role`만 따른다. 데이터 계약이 스타일 필드를 금지하므로(FIGURE_SPEC §1-4) 렌더러가 role 하나로 결정한다.
- Stage 4 탐색 모드의 드래그 가능 점은 §14.1에 따로 정의한다.

### 3.5 라벨 상태

| 상태 | 라벨 색 | 불투명도 |
|---|---|---|
| 기본·강조 | `label-primary` | 1 |
| 비강조 | `label-primary` | 0.65 (4.54:1, 12px 이상 텍스트 AA 유지) |

강조된 요소의 라벨은 굵기를 바꾸지 않는다(글자 폭이 바뀌어 위치가 흔들리는 것을 막음).

## 4. 요소 종류별 규칙

### 4.1 다각형과 원의 내부 채움

- **다각형**: §3.3대로 옅게 채운다(형태 인식을 돕는다). 변은 §3.2의 선 규칙을 그대로 따르고, 다각형 자체 `borders`의 스타일을 role에 맞춘다.
- **원**: **채우지 않는다**(모든 role·상태). 원 안에는 현·중심·반지름·내접 다각형이 자주 들어가서 채움이 겹치면 탁해지고 다각형 채움과 누적된다. 강조는 둘레 굵기와 언더레이로만 표현한다.
- 같은 영역에 채움이 여러 겹 쌓여도 α 합이 0.3을 넘지 않도록 요소 순서를 그대로 둔다(추가 처리 없음, 상한 3개 도형·요소 60개 범위에서 문제되지 않음).

### 4.2 각 호와 직각 표시

| 항목 | 제안값 | 비고 |
|---|---|---|
| 호 반지름 | **화면 18px** | JSXGraph angle `radius`는 사용자 좌표 단위이므로 렌더러가 `18 / board.unitX`로 환산하고 리사이즈 때 다시 계산한다. |
| 같은 꼭짓점의 두 번째·세 번째 각 | 반지름 +5px씩(23, 28) | 요소 순서대로. 겹친 호 구분. |
| 호 선 | role 색, 굵기 1.5(강조 2.5), dash는 role 규칙(auxiliary는 2) | |
| 직각 표시 선 | **직각 표시는 항상 실선**(role과 관계없이 dash 0). 색·굵기는 role을 따른다 | 오너 승인 시안이 실선(후속 정리, design P2-A) |
| 호 채움 | §3.3 각 채움 | 부채꼴(`type: 'sector'`) |
| 직각 표시 크기 | **한 변 10px 정사각형** | `rightAngleMark: true`일 때만. `orthoType: 'square'`. **레이어(재작업 1, P1-1)**: 점 언더레이(형광 원)를 선 언더레이와 같은 층으로 내려 직각 표시·호가 그 위에 그려진다(언더레이 3 < 각 4 < 선 5 < 점 7 < 라벨 9). 점 라벨은 각의 사분면(이등분선 방향)을 피한다(§6.3) |
| 직각 자동 표시 | **끈다** | 1.14.1 기본값이 `orthoType: 'square'`, `orthoSensitivity: 1.0`이라 89~91°이면 자동으로 정사각형이 그려진다. `rightAngleMark: false`인 각은 `orthoType: 'sector'`(또는 동등 설정)로 강제해 항상 호로 그린다. 겉보기 직각을 조건처럼 보이게 하지 않기 위해서다(FIG-10, Prompt/15 Stage 3 "외관상 각도를 조건으로 단정하지 않기"). |
| 직각 + `showMeasure` | 정사각형만 그리고 "90°" 라벨은 `showMeasure: true`일 때만 | |

### 4.3 선분·직선·반직선의 끝 처리

| 종류 | 끝 처리 |
|---|---|
| 선분 | 두 점에서 끝난다. `lineCap` 기본(`butt`). 끝점은 점 마커가 덮는다. 화살표 없음. |
| 직선 (`line`, `lineEquation`) | 양쪽 모두 보드 가장자리까지(`straightFirst`/`straightLast` true). 화살표 없음. 보드 영역에서 잘린다. |
| 반직선 | 시작점에서 출발해 한쪽만 보드 가장자리까지(`straightFirst: false`, `straightLast: true`). 화살표 없음(교과서 관례). |
| 축 | 양의 방향 끝에만 화살표(§5). |

세 종류의 구분은 "끝점 마커가 어디 있는가"로 읽힌다(선분 = 양끝 점, 반직선 = 한끝 점 + 가장자리, 직선 = 가장자리 양쪽). 끝점이 보드 밖으로 나가는 선분은 명세 오류이므로 Stage 2 검증기·bbox 검사 대상이며 디자인으로 보정하지 않는다.

### 4.4 수선의 발이 선분 밖에 떨어질 때의 연장선 (Stage 2에서 정의, Stage 4에서도 사용)

- 조건: `foot.to`가 **선분**이고, 계산된 발 H가 선분 양 끝점 사이 밖에 있을 때만 그린다. `to`가 직선이면 이미 가장자리까지 그려지므로 그리지 않는다.
- 모양: 가까운 끝점에서 H까지 **점선 `dash: 1`(`2,2`), 굵기 1, `brand` 색**. auxiliary 보조선(`5,5`, 1.5)보다 촘촘하고 가늘어서 "명세에 없던 연장"임을 구분한다.
- 등장·숨김·강조는 해당 foot 요소를 따른다(foot이 `appearAt: s2`이면 연장선도 s2부터, foot이 강조되면 연장선도 굵기 2 + 언더레이).
- 연장선은 명세에 없는 렌더러 파생 그림이므로 라벨·수치 라벨을 붙이지 않는다.

### 4.5 함수 곡선

- role 선 규칙을 따른다(보통 given 실선 2px).
- 불연속점·NaN·Infinity 구간에서는 **선을 끊는다**(수직 연결선 금지). 점근선은 명세에 `lineEquation`(보통 auxiliary)으로 있을 때만 그리며 auxiliary 점선 규칙을 따른다. 렌더러가 점근선을 임의로 추가하지 않는다.
- `domain`의 끝점이 열린/닫힌 구간인지는 계약에 없으므로 끝점 표시를 하지 않는다(오너 결정 2026-10-24).

## 5. 축·격자·눈금 라벨

| 항목 | 토큰 | 굵기/글꼴 | 비고 |
|---|---|---|---|
| 축 선 | `label-secondary` | 1px | 양의 방향 끝 화살표 **8×8px**(P19, 오너 승인 시안 기준). `axes.visible`일 때만 |
| 격자 | `separator` | 1px 실선 | `grid.visible`일 때만. 주 눈금 간격에만(보조 격자 없음) |
| 눈금 숫자 | `label-primary` | **Caption 2** 11/13 Regular 400 | `label-secondary`는 3.38:1로 텍스트 AA 미달이라 쓰지 않는다. 음수는 하이픈이 아닌 수학 마이너스(U+2212 `−`)로 표시 — 구현: JSXGraph ticks를 쓰지 않고 렌더러가 눈금 숫자를 직접 SVG 텍스트로 그린다(안전 속성 동일) |
| 원점 "O" | — | — | **표시하지 않는다**(오너 결정 2026-10-24). 0 눈금 숫자도 그리지 않는다 |
| 축 이름 (`xLabel`/`yLabel`) | `label-primary` | **Footnote** 13/18 Regular, **정체(이탤릭 아님)** | 화살표 끝 바로 바깥(오너 결정 2026-10-24: 타이포 표에 이탤릭 스타일이 없어 쓰지 않음) |
| 눈금 숫자 halo | `bg-canvas` | §6.2와 같음 | 곡선이 눈금을 지날 때 읽히도록 |

- 눈금 간격은 JSXGraph 자동 대신 "보드 폭에서 숫자 라벨 사이가 최소 32px"가 되도록 1·2·5 계열에서 고른다. 리사이즈로 px/단위가 바뀌면 격자·눈금만 다시 만든다(재작업 1, P2-2).
- **눈금 숫자 생략(재작업 1, P2-1·P1-2)**: 보드 가장자리 12px 띠에 걸리거나(화살표 끝·축 이름 영역 포함), 점 마커·점 라벨·축 이름과 겹치는 눈금 숫자는 그리지 않는다(예: F07의 x 눈금 1·3은 근 R1·R2와 겹쳐 생략).
- **거리(P19, 오너 승인 시안 Function.dc.html 측정)**: x 눈금 숫자 = 축 아래 5px(가운데 정렬), y 눈금 숫자 = 축 왼쪽 4.5px(오른쪽 정렬), x축 이름 = 보드 오른쪽 끝에서 5px·축 위 8px, y축 이름 = 축 오른쪽 7.5px·보드 위 끝에서 6px.
- 격자선은 보드 전체 범위까지 긋는다.
- 기하 도형(`kind: geometry`)은 명세가 `axes.visible: false`이면 축·눈금을 전혀 그리지 않는다.

## 6. 라벨

### 6.1 글꼴과 색

| 라벨 종류 | 타이포(DESIGN_SYSTEM §3) | 색 | 비고 |
|---|---|---|---|
| 점 라벨 (A, B, H…) | **Subheadline Semibold** 15/20 590 | `label-primary` | 모든 role 동일 색. role 구분은 점 마커가 담당. 정체(upright) — 점 이름은 이탤릭 아님 |
| 선·원·다각형 라벨 (`l`, `O` 등 요소 `label`) | Subheadline Semibold 15/20 590 | `label-primary` | 요소 중간 근처 |
| 수치 라벨 (길이·각도) | **Caption 1** 12/16 Regular 400 | `label-primary` | 숫자 폭 고정(`font-variant-numeric: tabular-nums`) |
| 눈금·축 이름 | §5 | §5 | |

- 글꼴 패밀리는 앱 전역 스택(`"SF Pro", -apple-system, "Apple SD Gothic Neo", sans-serif`)을 상속한다. JSXGraph 텍스트 기본 글꼴을 쓰지 않는다.
- result 라벨에 teal을 쓰지 않는다(4.13:1, 15px Semibold는 큰 텍스트 기준 18.66px Bold에 못 미쳐 4.5 필요).

### 6.2 Halo — 사용한다

- 모든 라벨(점·요소·수치·눈금)에 `bg-canvas` 색 외곽선을 둔다: SVG `paint-order: stroke`, `stroke: var(--color-bg-canvas)`, **`stroke-width: 3px`**(제안값), `stroke-linejoin: round`.
- 전제: 라벨을 **`display: 'internal'`(SVG `<text>`)** 로 그린다. 1.14.1의 텍스트 기본값은 `display: 'html'`이다. Stage 1 QA LOW-2가 권고한 대로 internal + textContent로 그리면 halo와 안전한 라벨 출력이 한 번에 해결된다. `useMathJax`/`useKatex`/`parse`는 켜지 않는다.
- JSXGraph가 만든 SVG 내부 노드에 대한 스타일(`paint-order`, 글꼴 상속)은 Tailwind 클래스로 붙이기 어렵다. `.claude/rules/frontend.md` §3-4의 허용 범위(Tailwind로 표현하기 어려운 경우)에 해당하므로 `features/figure-visualization` 안의 CSS Module 한 개로 제한해 둔다. 색은 CSS 변수만 참조하고 리터럴을 쓰지 않는다.

### 6.3 수치 라벨 형식과 위치

| 종류 | 형식 | 위치 |
|---|---|---|
| 각도 (`showMeasure`) | `60°` — 정수와의 차가 0.05 미만이면 정수, 아니면 소수 첫째 자리(`37.5°`) | 각의 이등분선 위, 호 반지름 + 10px 지점(부채꼴 바깥) |
| 길이 (`showLength`) | ① 해당 선분에 `length` 제약이 있으면 **그 값**(원문 조건 수치)을 그대로 표시(예: `5`). ② 없으면 좌표로 계산한 값(`formatFigureNumber`: 소수 둘째 자리 반올림, 끝자리 0 제거) **앞에 항상 `≈`**(예: `≈2.83`, `≈3`) — 오너 승인 2026-10-24. 단위는 표시하지 않는다(계약에 단위 필드 없음) | 선분 중점에서 선분에 수직으로 8px 바깥. 다각형 변이면 다각형 무게중심의 반대쪽, 단독 선분이면 위쪽(수평에 가까우면)/왼쪽(수직에 가까우면) |
| 점 라벨 | — | 점에서 6px 떨어진 곳. 다각형 꼭짓점은 무게중심 반대 방향. **그 외(재작업 1, P1-2)**: 점에 붙은 선분·직선·반직선·원(접선 방향 + 원 안쪽)·곡선·각(두 팔 + 이등분선 = 직각 표시·호가 있는 사분면)의 방향을 모아, 가장 넓게 비어 있는 방향(15° 후보 24개, 동점이면 도형 바깥쪽)에 둔다. 선분 위의 점(수선의 발·중점)은 그 결과 선분 법선 중 바깥쪽이 된다. JSXGraph `autoPosition`은 결정적이지 않아 쓰지 않는다(`labelPlacement.ts`, 단위 테스트에서 F02·F03·F04·F05·F07·F09 라벨 상자와 선·원·곡선의 겹침 0 확인) |

- `≈`와 ①의 우선 규칙은 FIG-10 때문이다. 좌표 계산값 `2.83`을 그대로 쓰면 풀이의 정답 `2√2`와 다른 값처럼 보이거나, 근삿값을 정확한 값처럼 보이게 할 수 있다(오너 승인 2026-10-24).

## 7. 패널 컨테이너와 레이아웃

### 7.1 표면 — 권장안: Stage 2는 페이지에서 감싸고, 공통화는 Stage 4

- `ELEVATED_CARD_STYLE`(`features/ai-solution/elevatedCardStyle.ts`: `bg-bg-elevated rounded-[14px] p-4` + `Elevation/Card` drop-shadow)은 `ai-solution` feature 안에 있어 `features/figure-visualization`이 import하면 feature 간 참조 금지 규칙을 어긴다.
- 리터럴을 복사하는 것도 안 된다. 이미 `ResultCard.tsx`·`RecognizedProblemBar.tsx`가 복사본을 갖고 있어 하나 더 복사하면 "3회 이상 반복" 규칙(frontend.md §2)을 넘는다.
- **권장안(검토 결과 동의)**: FigureView는 표면 없이 만들고, **Stage 2에서는 `/dev/figures` 페이지가 `ELEVATED_CARD_STYLE`을 import해 감싼다**. `pages → features` 방향이라 규칙에 맞다. Stage 4에서 결과 패널에 붙일 때 이 상수를 `shared/ui`(예: `shared/ui/card`의 상수 또는 `Card` 컴포넌트)로 올리고 `ai-solution`의 기존 3개 사용처와 `ResultCard`/`RecognizedProblemBar` 복사본을 함께 정리한다. 이 정리는 Stage 4 plan-agent 작업 목록에 넣는다.

### 7.2 구조

```
[카드 표면 — 조립하는 쪽이 입힘: ELEVATED_CARD_STYLE]
  <figure>                                  ← FigureView 루트, flex-col gap-3
    [보드 상자]  bg-bg-canvas · rounded-[10px] · border border-separator · overflow-hidden
       └ JSXGraph 컨테이너 (aria-hidden)
    <figcaption>  sr-only "그림 설명: " + description
  </figure>
```

| 항목 | 값 | 근거 |
|---|---|---|
| 보드 배경 | `bg-bg-canvas` | 카드·패널 표면 토큰. 필기 캔버스 배경과 같은 톤이라 "그림 종이" 느낌. halo 색과 일치해야 하므로 반드시 이 토큰 |
| 보드 모서리 | `rounded-[10px]` | 기존 `radius/10`(Logo small) 재사용. 카드 14px 안쪽에 16px 패딩이라 동심 모서리로 자연스럽다 |
| 보드 테두리 | `border border-separator` (1px) | `bg-elevated`(흰색) 카드 위에서 `bg-canvas`만으로는 보드 경계가 보이지 않아, 직선·반직선이 어디서 잘리는지 알 수 없다 |
| 보드와 설명 간격 | `gap-3`(12px) | ResultPanel Body의 `gap-3` 재사용 |
| 설명 글꼴 | Footnote 13/18 Regular, `text-label-primary`, `whitespace-pre-wrap`, `wrap-anywhere`(공백 없는 긴 문자열도 줄바꿈, 재작업 1) | `ResultCard` 본문과 같은 타이포. `label-secondary`는 3.38:1로 AA 미달이라 쓰지 않음 |

### 7.3 가로세로 비율과 높이 (2026-10-24 오너 변경 — 내용 맞춤)

보드 폭 = 컨테이너 폭 100%. 높이는 폭에서 계산하고, 패널 높이(키보드 표시 등)에는 반응하지 않는다. 구현은 순수 함수 `computeViewport`(`features/figure-visualization/viewport.ts`)다.

| `kind`/설정 | 높이 규칙 |
|---|---|
| geometry, 축 숨김 (`keepAspectRatio: true`) — **내용 맞춤** | ① 의미 검증 결과로 실제로 그려지는 요소의 범위를 구한다: 점, 원(중심 ± 반지름), 다각형, 선분, 각의 세 점, 그래프 조각. **무한 직선·반직선·lineEquation은 범위에서 빼고** 다른 요소 범위까지만 잘린다. ② 범위에 화면 여백 **32px(= P15 12px + 점 라벨 높이 20px)** 를 사방으로 더하고, 명세 bbox(+12px)와 겹치는 부분만 쓴다(명세 bbox보다 키우지 않는다). ③ 같은 단위 비율로 높이 = 폭 × 영역 세로/가로, **[120px, 360px]** 로 제한. 상한에 걸리면 **가로를 중심 기준 대칭 확장**, 하한에 걸리면 세로를 대칭 확장한다(그림이 잘리지 않고 가운데에 온다). 높이는 정수 px로 반올림하고, 반올림 뒤에도 내용이 들어가도록 단위를 다시 맞춘다. |
| 축이 보이는 도형(`axes.visible`) — **명세 bbox** | 원점·축 눈금이 의미가 있으므로 명세 bbox를 그대로 기준으로 한다(여백 12px만). 높이 규칙(같은 단위 비율, [120, 360], 상한 시 가로 확장)은 위와 같다. F06(좌표평면 직선, geometry)도 여기에 해당한다. |
| `keepAspectRatio: false` (function만 가능) | 높이 = 폭 × 0.75(4:3), [120px, 360px] 제한. 명세 bbox + 12px. 가로·세로 단위가 달라도 됨 |
| 내용 범위가 한 점으로 퇴화 | 명세 bbox 기준으로 돌아간다(예: 보이는 유한 요소가 교점 하나뿐인 경우) |

- 하한·상한 때문에 확장되는 방향은 명세 bbox를 넘을 수 있다(같은 단위 비율을 지키려면 피할 수 없음). 내용이 잘리는 일은 없다.
- 측정 전(폭 0)에는 결과 패널 Default 보드 폭 348px 기준 높이로 자리를 먼저 잡는다(§9).
- 단위 테스트: `viewport.test.ts` — 납작한 도형(하한 120으로 줄어듦), 세로로 긴 도형(상한 360 + 가로 대칭 확장), 명세 bbox가 내용의 3배인 도형(높이 감소, 내용+라벨 여백 보임), 같은 단위 비율, F05 원 전체 보임.

### 7.4 결과 패널 안에서의 배치 (Stage 4에서 실제 연결, 치수는 지금 확정)

| 패널 폭 | 패널 폭 계산 | Body 콘텐츠 폭(`px-5`) | 보드 폭(카드 `p-4`) | 정사각형 bbox 보드 높이 |
|---|---|---|---|---|
| Default | `min(420px,45vw)` → 1024~1366px 화면 모두 420 | 380 | **348** | 348 |
| Extend | `min(748px,90vw)` → 748 | 708 | 676 | 360(상한) → bbox 가로 확장 |
| Close | `w-6` | 콘텐츠 렌더 안 함 | FigureView 언마운트 → `freeBoard` | — |

- 패널 폭 전환은 `transition-[width] duration-300`이다. 보드는 `ResizeObserver` + `requestAnimationFrame`으로 한 프레임에 한 번만 `resizeContainer`하고, 전환 중 매 프레임 다시 만들지 않는다.
- Stage 4에서 카드 위치(풀이 카드 다음 / 단계 옆)와 헤더 캡션 여부를 정한다(§15-9).

### 7.5 iPad 가로·세로·Split View

- 현재 앱은 `shared/ui/viewport-guard/ViewportGuard`로 **세로(높이 > 폭) 또는 폭 1024px 미만이면 전체 화면 안내 오버레이**를 덮는다(`docs/FIGMA_SCREEN_MAP.md` "세로·Split View는 전역 환경 가드 안내로 대체"). 그래서 실제 표시 환경은 1024px 이상 가로(iPad mini 1133 / Air 1180 / Pro 11 1194 / Pro 12.9 1366)뿐이고, 이 범위에서 Default 보드 폭은 항상 348px이다.
- 세로 회전·Split View·Slide Over에서는 가드가 덮을 뿐 FigureView는 **마운트된 채 남는다**. 그래서 다음을 지킨다.
  - 컨테이너 폭이 0이거나 `display:none`이면 보드를 만들지 않고 기다린다(초기 크기 0 대응).
  - 회전·Split View 진입/해제로 폭이 바뀌어도 오류 없이 다시 맞춘다. 가드가 걷히면 정상 크기여야 한다.
- 소프트웨어 키보드(후속 질문 입력)가 올라와 패널 아래쪽이 줄어도(`useKeyboardInset`) 보드 높이는 폭 기준이라 다시 그려지지 않는다. 높이 상한을 `dvh`가 아닌 고정 px(360)로 둔 이유다.
- 참고(기존 불일치, 이번 범위 밖): PRD §5는 "가로/세로 모두 지원"이라 적혀 있으나 실제 구현과 화면맵은 가로 전용 + 가드다.

## 8. 실패와 대체 표시 (`FigureFallback`)

| 항목 | 명세 |
|---|---|
| 언제 | 클라이언트에서 그 도형의 렌더가 실패했을 때(의미 검증 실패, JSXGraph 예외, 요소 계산 실패, JSXGraph 청크 로드 실패·오프라인). 서버/파서 단계에서 버려진 도형(`rejected`)은 **아무것도 표시하지 않는다**(텍스트 풀이만 남음, FIG-6). |
| 구조 | 보드 상자와 같은 상자(`bg-bg-canvas rounded-[10px] border border-separator`)에 **고정 비율 없이** `p-4`, 안에 안내 문구 한 줄. 그 아래 figcaption(description)은 성공 시와 똑같이 둔다. 성공·실패 레이아웃이 같아서 설명 위치가 바뀌지 않는다. |
| 안내 문구 | **"그림을 표시하지 못했어요. 아래 설명을 참고해 주세요."** — Footnote Semibold 13/18 590, `text-label-primary`, `wrap-anywhere` |
| description | 성공 시 figcaption과 같음(Footnote 13/18, `label-primary`). 텍스트 노드로만 출력(QA LOW-2: description은 `<`·`>`·`&` 허용) |
| 아이콘 | **쓰지 않는다.** Figma에 경고 아이콘이 없고(`shared/ui/modal`의 `icon="error"`도 임시), 빨간 경고 기호는 학생에게 "내 풀이가 틀렸다"로 읽힐 수 있다. |
| 금지 문구 | "검증", "정확", "오류 코드", 거부 사유(`invalid_figure: …`) 같은 기술 문구. 사유는 `/dev/figures`에서만 보인다. |
| 라이브 영역 | 쓰지 않는다(`role="alert"` 금지). 풀이 읽기를 끊을 만큼 급한 일이 아니다. |

## 9. 로딩 상태

- Stage 2에서는 fixture가 동기 데이터라 "도형 생성 대기"는 없다. 생기는 것은 **JSXGraph 청크 지연 로딩**(번들 분리 시) 시간뿐이다. 풀이 생성 대기는 기존 `LoadingMark`(풀이 로딩)가 이미 담당하고, figures는 SSE `done`과 함께 오므로 Stage 3에서도 도형 전용 대기는 없다.

> **사실 정정(Stage 3, 2026-10-24)**: 위 문단의 "figures는 SSE `done`과 함께 오므로 Stage 3에서도 도형 전용 대기는 없다"는 더 이상 사실이 아니다. 승인된 Stage 3 설계(D1)에서 서버는 `done`을 **도형 없이 먼저** 보내고, 별도 구조화 호출이 끝난 뒤 `event: figures`를 따로 보낸다(받아들인 도형이 없으면 figures 이벤트 자체가 없다, `docs/API_SPEC.md`). 따라서 텍스트 풀이가 끝난 뒤 수 초 동안 "도형 준비 중" 구간이 생기고, 그 뒤 "도형 없음"으로 끝날 수도 있다. 이 상태의 표시 방식은 **Stage 4 design-agent 결정 항목**이다(`docs/FIGURES_WORKFLOW_STATE.md` §6.3). Stage 3은 화면을 바꾸지 않았다.
> **Stage 4 결정(2026-10-25)**: done 뒤 "도형 준비 중/없음" 표시는 §17.6을 따른다(500ms 지연 후 대기 줄 한 줄, empty는 미표시). 아래 "보드 상자 자리 + Spinner"는 그림 카드가 생긴 뒤 JSXGraph 청크를 기다리는 동안에만 쓴다.

- **권장**: §7.3 규칙으로 계산한 높이의 보드 상자를 **먼저 자리 잡아 두고**(레이아웃 이동 없음, 높이 계산에는 JSXGraph가 필요 없음) 가운데에 `shared/ui/spinner/Spinner`를 `label="그림을 준비하는 중"`으로 재사용한다. `<figure aria-busy="true">`.
- `LoadingMark`는 쓰지 않는다. 브랜드 마스코트 맥동은 "풀이를 만드는 중"의 의미로 쓰고 있어서, 한 화면에 최대 3개 도형에서 동시에 맥동하면 과하다.
- 알려진 기존 문제(이번 범위 밖, P2): `Spinner`의 표시 문구 색 `text-label-secondary`는 3.38:1로 AA 미달이다. 이번 작업에서 Spinner를 고치지 않는다.

## 10. 접근성

| 항목 | 명세 |
|---|---|
| 의미 구조 | `<figure>` + 화면에 보이는 `<figcaption>`(description). figure의 접근 가능한 이름은 figcaption에서 온다. **`role="img"` + `aria-label`을 추가로 붙이지 않는다**(같은 설명을 두 번 읽음). |
| 보드 숨김 | JSXGraph 컨테이너에 `aria-hidden="true"`. SVG 안의 라벨 조각(A, B, 60° …)을 순서 없이 읽지 않게 한다. |
| 포커스 | 읽기 모드에서 보드 안에 **Tab으로 갈 수 있는 요소가 없어야 한다**(`aria-hidden` 안의 포커스 가능 요소는 접근성 위반). 1.14.1 기본값 `keyboard.enabled: true`를 끄고, 요소 `tabindex`가 0 이상이 되지 않게 한다. |
| 스크린리더 텍스트를 화면에도 보일지 | **보인다(항상, 접지 않음 — 오너 승인 2026-10-24).** description은 그림을 못 읽는 학생뿐 아니라 그림을 해석하기 어려운 학생에게도 도움이 되고, 실패 시와 레이아웃이 같아진다. figcaption 앞에 `sr-only` "그림 설명: "을 붙여 스크린리더에서 맥락을 준다. |
| 대비 | §2 표. 텍스트 4.5:1(라벨·눈금·설명 모두 `label-primary` 13.64), 그래픽 3:1(선·점 모든 상태에서 3.07 이상). 격자·보드 테두리·채움·언더레이는 장식이라 기준 비적용, 단 그 위 선·텍스트의 대비가 유지되는 것을 확인했다. |
| 움직임 | Stage 2는 애니메이션 없음. Stage 4 단계 전환 애니메이션은 `prefers-reduced-motion: reduce`에서 끈다(§14.2). |
| 글자 크기 조절 | 보드 라벨은 px 고정(그림과 비례 유지). figcaption·안내 문구는 페이지 글자 크기를 따른다. |
| 터치 타깃 | 읽기 모드에는 조작 요소가 없다. Stage 4 버튼·드래그 점은 44px(§14.1). |

## 11. JSXGraph 보드 설정 중 디자인에 영향을 주는 것 (1.14.1 실측)

| 속성 | 1.14.1 기본값 | 읽기 모드 설정 | 이유 |
|---|---|---|---|
| `showCopyright` | `true` | `false` | 보드 안에 "JSXGraph … Copyright" 문구를 그린다. 오너 결정(화면 미표시) §12 |
| `showNavigation` | `true` | `false` | 확대/이동 버튼이 보드 위에 뜬다 |
| `showInfobox` | `true` | `false` | 점을 누르면 좌표 상자가 뜬다(좌표가 원문 조건처럼 보임) |
| `keyboard.enabled` | `true` | `false` | §10 포커스 |
| `pan.enabled` / `zoom` | pan `true`(한 손가락) | 끔 | 패널 스크롤과 충돌 |
| `registerEvents` | `true` | **`false`(구현 확정)** | **중요**: 포인터 핸들러를 등록할 때 `board.js`가 컨테이너에 `style.touchAction = 'none'`을 직접 넣는다(`base/board.js` 2207행). 이 상태면 손가락이 도형 위에서 시작한 스와이프로는 **결과 패널이 스크롤되지 않는다**. `browserPan`은 pointerdown 처리 중에 `touch-action`을 바꾸는 방식이라 첫 제스처에는 늦다. 읽기 모드는 이벤트 등록 자체를 하지 않아야 Prompt/15 Stage 4 "읽기 모드에서 페이지 스크롤 유지"를 지킨다. **확인(WU3)**: `registerEvents: false`면 `addPointerEventHandlers`가 불리지 않아 컨테이너 `style.touchAction`이 빈 값으로 남는다(실제 JSXGraph 스모크 테스트에서 단언). resize 핸들러도 등록되지 않아 내장 ResizeObserver·지연 `setTimeout`이 생기지 않는다 |
| 요소 `highlight` | hover 시 색 변경 | `highlight: false` | §3의 단계 강조와 혼동 |
| 텍스트 `display` | `'html'` | `'internal'` | §6.2 halo·안전한 출력 |
| 각 `orthoSensitivity` | `1.0` | `rightAngleMark: false`이면 정사각형 표시 끔 | §4.2 |

전역 CSS에 `touch-action`을 바꾸거나 `preventDefault`를 거는 방식으로 해결하지 않는다(Prompt/15 Stage 4).

## 12. 오픈소스 고지 — 오너 결정 검토

- 오너 결정: 고지 파일만 두고 화면에는 표시하지 않는다.
- **디자인상 문제 없음.** 오히려 권장한다. 1.14.1 기본 `showCopyright: true`는 보드마다 저작권 문구를 그려 작은 패널(348px)에서 그림을 가리고, 패널에 최대 3개 도형이면 같은 문구가 반복된다.
- 다만 디자인 범위 밖 확인 사항 하나(정보 제공, 판단은 오너): JSXGraph는 `MIT OR LGPL-3.0-or-later` 이중 라이선스다. MIT를 고르면 "소프트웨어의 복사본"에 저작권·허가 문구를 포함해야 한다. 그런데 소스의 일반 주석은 빌드 최소화 과정에서 사라진다. 저장소에 고지 파일을 두는 것만으로 **배포되는 번들(브라우저로 내려가는 사본)에 문구가 포함되는지**는 development-agent가 빌드 산출물(`dist`)에서 확인하고, 필요하면 산출물에 라이선스 파일을 함께 두는 방식을 고려한다. 고지 파일에는 MIT 선택을 명시한다. 화면 표시 요구는 아니다.
- 나중에 마이페이지 등에 "오픈소스 라이선스" 링크를 둘지는 별도 결정(필수 아님).

## 13. 개발용 `/dev/figures` 미리보기

**기존 컴포넌트 재사용으로 충분하다.** 새 공통 컴포넌트를 만들지 않는다.

| 구성 | 재사용 |
|---|---|
| 도형 카드 | `ELEVATED_CARD_STYLE`(페이지에서 import, §7.1) + `FigureView` |
| 단계 선택 | `shared/ui/filter-pill/FilterPill`(`label`, `selected`, `onClick`) — "최종" + `s1`…`sN` 칩. 선택 상태 `aria-pressed`는 FilterPill이 지원하는지 확인, 없으면 Stage 2에서 추가하지 말고 dev 전용이므로 생략 가능 |
| 폭 시뮬레이션 | 같은 fixture를 **380px**(Default Body 폭)과 **708px**(Extend Body 폭) 컨테이너에 나란히 렌더. 패널 실제 크기에서의 라벨 겹침·높이 제한을 눈으로 확인하는 용도 |
| 실패 사례 | F10a~j를 같은 카드로 렌더해 `FigureFallback` 확인. 거부 사유는 **dev 페이지에서만** 카드 아래 일반 텍스트(`text-label-primary`, 12px)로 표시 |
| 로딩 | 청크 지연을 흉내 내는 토글 1개(선택) |

- 라우트는 개발 빌드에서만 등록(`import.meta.env.DEV`)하고 운영 번들·내비게이션에 노출하지 않는다.
- dev 페이지 자체는 Figma 검수 대상이 아니다(레이아웃 자유). 단 그 안의 FigureView는 이 문서 기준으로 검수한다.

## 14. Stage 4를 위해 지금 정해 둘 것

### 14.1 읽기 모드와 탐색 모드

> **Stage 4 갱신(2026-10-25)**: 탐색 모드의 확정 명세와 구현 보류 권장은 §17.14, 자격 범위는 §17.15다. 아래 표와 다르면 §17을 따른다(테두리는 `ring-2 ring-brand`, 버튼 위치는 보드 아래).

| 항목 | 읽기 모드(기본) | 탐색 모드(`interaction.mode: "explore"`인 도형만) |
|---|---|---|
| 진입 | 기본 | 카드 안 버튼 **"움직여 보기"**(기존 `shared/ui/button` variant 재사용, 새 버튼 디자인 금지) |
| 보드 이벤트 | `registerEvents: false`, 페이지 스크롤 그대로 | 보드에만 이벤트 등록, `touch-action: none`은 **보드 컨테이너에만** |
| 보드 표시 | §7.2 | 테두리를 `border-brand`로 바꿔(굵기 그대로 1px — 또는 1.5px, §15-10) 모드 진입을 색 + 버튼 라벨 변화("탐색 끝내기")로 함께 알림 |
| 드래그 점 | — | `draggable` 점만: 반지름 6, 채움 `bg-elevated`, 테두리 `brand-deep` 2px, 터치 판정 반경 22px(지름 44px, JSXGraph `precision.touch`) |
| 초기화 | — | **"처음 모양으로"** 버튼(같은 버튼 variant). 탐색 중에만 보임 |
| 상태 분리 | 원래 명세 상태 | 탐색 좌표는 별도 상태. 원래 명세를 바꾸지 않음 |
| 동시 탐색 | — | 한 번에 도형 하나만 탐색 모드(다른 도형은 자동으로 읽기 모드) |

- 조건을 보존할 수 없는 도형은 버튼 자체를 표시하지 않는다(비활성 버튼도 두지 않음).
- 키보드: 탐색 진입·초기화·종료 버튼은 키보드로 조작 가능해야 한다. 점 드래그의 키보드 대안(JSXGraph keyboard 이동)을 제공할지는 결정 필요(§15-11).

### 14.2 단계 강조 전환

> **Stage 4 갱신(2026-10-25)**: 단계 선택은 그림 카드 안 스테퍼(이전/다음, 기본 "최종")로 정했다(§17.4). 전환은 이번 Stage에서 즉시 전환(§17.8, P17 미적용). 스테퍼 위치 텍스트("2단계 / 3")만 사용자 조작 시 낭독하고, 그림 내용은 낭독하지 않는다(§17.4·§17.7).

- 상태 계산은 항상 원래 명세에서 처음부터 다시 한다(`appearAt` → 누적 `hide` → 현재 `highlight`). 이전/다음 이동 순서와 관계없이 같은 단계는 같은 그림이 된다(FIG-8).
- 전환 애니메이션: 새로 나타나는 요소 opacity 0→1 **150ms**, 강조·비강조 전환 150ms, 숨김은 즉시. `prefers-reduced-motion: reduce`에서는 모두 즉시.
- 단계 변경 시 탐색 모드는 **자동 종료 + 초기화**를 권장한다(탐색 좌표에서 다음 단계 보조선을 그리면 원래 풀이와 다른 그림이 된다). 결정 필요(§15-12).
- 현재 단계를 어떻게 정할지(카드 안 단계 칩 vs 풀이 본문 스크롤 위치 연동)는 Stage 4 plan에서 결정. 접근성과 예측 가능성 면에서는 **명시적 단계 칩**(FilterPill 재사용)을 권장한다.
- 단계 변경을 라이브 영역으로 알리지 않는다. 단계 텍스트 자체가 맥락이다.

### 14.3 필기와의 충돌 방지

- 도형 카드는 결과 패널 안에 있고 패널이 필기 캔버스 위 레이어이므로, 읽기 모드에서는 패널이 이벤트를 받아 캔버스로 내려가지 않는다(기존 구조). 도형 쪽에서 추가 처리할 것은 §11 `registerEvents: false`뿐이다.
- 탐색 모드에서도 pointer capture는 보드 컨테이너 안에서만 한다. `HandwritingCanvas`의 pointer capture·Scribble 차단 로직은 수정하지 않는다.
- 도형 카드를 캔버스 위 다른 위치(패널 밖 오버레이)에 띄우는 설계가 나오면 `CANVAS_OCCLUDER_PROPS` 패턴(`Action Menu` 선례)으로 캔버스 잉크 가림 처리를 따로 검토해야 한다.

## 15. 픽셀·수치 — 오너 승인(2026-10-24)

모두 Figma 근거 없음. 학교 수학 교재 관례와 348px 보드 폭 기준으로 제안했고, **오너가 시안과 함께 확정값으로 승인했다(2026-10-24)**. P13만 오너 변경으로 바뀌었다.

| # | 항목 | 제안값 | 위치 |
|---|---|---|---|
| P1 | 선 굵기 given / auxiliary / result | 2 / 1.5 / 2.5 px | §3.2 |
| P2 | 강조 시 굵기 증가 | +1 px (3 / 2.5 / 3.5) | §3.2 |
| P3 | auxiliary dash | JSXGraph `dash: 2` = `5,5` px | §3.2 |
| P4 | 수선의 발 연장선 | `dash: 1` = `2,2` px, 굵기 1 | §4.4 |
| P5 | 형광 언더레이 | `accent-yellow` α0.5, 선 폭 10 px, 점 반지름 9(result 10) | §3.2, §3.4 |
| P6 | 비강조 불투명도 given / auxiliary / result | 0.65 / 0.75 / 0.85 | §3.1 |
| P7 | 채움 α (다각형 given / result, 각) | 0.08 / 0.12, 각 0.12 (강조 2배, 비강조 절반) | §3.3 |
| P8 | 점 반지름 given / auxiliary / result | 3 / 3 / 4 px (강조 +1.5), 테두리 1.5 px | §3.4 |
| P9 | 각 호 반지름, 같은 꼭짓점 증분 | 18 px, +5 px | §4.2 |
| P10 | 직각 표시 크기 | 한 변 10 px | §4.2 |
| P11 | 라벨 halo 두께 | 3 px | §6.2 |
| P12 | 점 라벨 거리, 길이 라벨 거리, 각도 라벨 거리 | 6 / 8 / 호+10 px | §6.3 |
| P13 | 보드 높이 범위 | **120~360 px**(오너 변경, 원안 180~360) + 내용 맞춤 높이 | §7.3 |
| P14 | function 기본 비율 | 4:3 | §7.3 |
| P15 | bbox 안쪽 여백 | 12 px(내용 맞춤 시 + 라벨 높이 20 px) | §7.3 |
| P16 | 눈금 숫자 최소 간격 | 32 px | §5 |
| P17 | 단계 전환 애니메이션 | 150 ms | §14.2 |
| P18 | 탐색 모드 드래그 점 | 반지름 6, 테두리 2, 터치 판정 반경 22 px | §14.1 |
| P19 | 축 화살표·눈금·축 이름 거리 | 화살표 길이 8·폭 8 px, x 눈금 숫자 축 아래 5 px, y 눈금 숫자 축 왼쪽 4.5 px, x축 이름 오른쪽 끝 5 px·축 위 8 px, y축 이름 축 오른쪽 7.5 px·위 끝 6 px — **오너 승인 시안(Function.dc.html) 기준**(재작업 1에서 측정·반영) | §5 |

## 16. 결정 목록

**결정됨(오너, 2026-10-24)**

1. 이 임시 디자인 전체를 Figma 확정 전까지 사용 — 승인(시안 https://claude.ai/artifact/YBUL65TPZZgTqqCB63hSKK).
2. §15 P1~P18 — 승인(P13은 120~360px로 변경, 높이는 §7.3 내용 맞춤).
3. 길이 수치 라벨 — 제약값이 있으면 그 값, 없으면 계산값 앞에 `≈`(§6.3).
4. figcaption description — 항상 전부 보인다(접지 않음).
5. 축 이름 — 이탤릭으로 하지 않는다.
6. 원점 "O" — 표시하지 않는다(0 눈금도 표시하지 않음).
7. "그림은 실제와 다를 수 있어요" 안내 — 넣지 않는다.
8. 함수 `domain` 끝점 — 따로 표시하지 않는다.
13. 배포 번들의 MIT 고지 — 소스 주석은 빌드 최소화로 사라지므로 `apps/web/public/licenses/THIRD_PARTY_NOTICES.txt`를 산출물(`dist/licenses/`)에 함께 둔다(빌드 산출물에서 포함 확인). 화면에는 출처를 표시하지 않는다.
15. `docs/COMPONENT_MAP.md`에 `FigureView`/`FigureFallback` 행 등록 — 완료(Stage 2 WU5).

**남은 결정(Stage 4)** — 2026-10-25 design-agent가 §17에 제안안을 냈다. 오너 확인 전까지 아래 항목은 "제안"이다.

- 9 → §17.1·§17.2(단계별 풀이 다음·최종 답 앞, 캡션 "그림" text-brand).
- 10 → §17.14(`ring-2 ring-brand`). 11 → 두지 않음(§17.14). 12 → 자동 종료 + 초기화(§17.14).
- 14 → `shared/ui/card/ElevatedCard` 컴포넌트, Stage 4 WU5(§17.10).
- 신규 16. 탐색 모드 구현 시점(D-1): 권장 (b) 보류(§17.14).
- 신규 17. §17.13 제안 수치 S4-V1~V9.
- 신규 18. `Spinner` `announce` 선택 prop 추가(§17.7).
- 신규 19. 8단계를 넘는 풀이의 직접 단계 이동(Stage 5 이후 재검토, §17.4).

9. 결과 패널 안 도형 카드 위치(풀이 카드 다음 / 단계별 인라인)와 카드 헤더 캡션("도형" 등) 유무. 캡션을 둔다면 `ResultCard`의 캡션 색(purple 2.80 / orange 2.20)은 AA 미달이라 재사용하지 말고 `text-brand`(4.99 on canvas, 5.21 on elevated) 권장.
10. 탐색 모드 테두리 1px `border-brand` vs 1.5px.
11. 드래그 점의 키보드 대안 제공 여부.
12. 단계 변경 시 탐색 모드 자동 종료·초기화.
14. `ELEVATED_CARD_STYLE`의 `shared/ui` 승격과 기존 복사본 정리 시점(권장: Stage 4 첫 작업).

---

## 17. Stage 4 — 단계별 표시와 결과 패널 연결 (2026-10-25 design-agent 사전 검토)

`.omc/plans/figures-stage4.md` §8의 질문 12개에 대한 디자인 명세다. 요약은 그 문서 §9에 있다.

> **구현 상태(2026-10-25, development-agent)**: §17.1~§17.13을 구현했다(stage-qa 전, 장부 §7). 위치: `shared/ui/card/ElevatedCard`, `features/ai-solution/SolutionStepList`, `features/figure-visualization/{SolutionFigures,resolveStepState(resolveStepStateAt),exploreEligibility}`, `shared/ui/spinner/Spinner`(`announce`). §17.14 탐색 UI(WU9)는 오너 결정 D-1로 **구현하지 않았다** — "처음 모양으로"(초기화) 버튼 미이행. 구현 중 보완: 숨긴 요소에도 기본 상태 스타일을 먼저 적용해 같은 단계 = 같은 SVG 속성을 보장(§17.5, S4-3). 실기기 iPad·VoiceOver 확인은 NOT VERIFIED.

> **Figma 대응 없음(재확인 2026-10-25).** `WhyMath Design System`(`ltyPrCk8UT8DsB3tFuw7Sr`)에서 `search_design_system`으로 "stepper"·"solution step"을 검색했다. 결과는 외부 커뮤니티 라이브러리(iOS 26 Stepper 등)뿐이고 이 파일의 컴포넌트는 없었다. 그래서 아래 명세는 **기존 토큰과 `shared/ui` 컴포넌트만 조합**한다. 새 수치는 §17.13 표에 모았고, 모두 **오너 확인 필요**다. 시안: https://claude.ai/artifact/YBUL65TPZZgTqqCB63hSKK 의 보드 5~7.

### 17.1 전체 구조 (Q5 배치)

```
풀이(solve) Body (기존 aria-live="polite")
  RecognizedProblemBar
  ResultCard concept                      (변경 없음)
  ResultCard steps → SolutionStepList     (분할 성공 시 단계 블록, §17.3)
  [도형 슬롯 figureContent]  aria-live="off"   (§17.7)
     ├ waiting: 대기 줄 (§17.6)
     └ received: 그림 카드 1~3개 (gap-3)
  AnswerBox
  chatContent

이어풀기(resume) — ResumeResultCard 내부 flex-col gap-3
  이어풀기 카드(라벨·methodName·SolutionStepList)
  [도형 슬롯 figureContent]
  AnswerBox tone="resume"
```

- plan-agent 기본안에 동의한다. 도형은 **단계별 풀이 다음, 최종 답 앞**이다. 단계를 다 읽은 뒤 그림을 보고, 이어서 답으로 가는 읽기 순서다. 최종 답이 그림 아래로 밀리지만 답은 이미 텍스트로 확정돼 있어 순서상 문제가 없다.
- 그림이 2~3개면 `figures` 배열 순서대로 쌓고 간격은 Body와 같은 `gap-3`(12px)이다. 단계 상태 k는 모든 그림이 공유한다(같은 k = 모든 그림이 같은 단계).
- MyPage(`ResultPanel` 재사용)는 `figureContent`를 넘기지 않는다. 호출부는 바뀌지 않고, 그림과 스테퍼도 없다. 단, 단계 블록은 데이터 기준이다(§17.12). 그래서 표지가 있는 과거 풀이는 MyPage에서도 블록으로 보인다(지금은 `**1단계**` 별표가 그대로 보인다. `renderMathText`가 굵게 처리를 하지 않는다).

### 17.2 그림 카드

```
[ElevatedCard as="section"]  flex flex-col gap-3            (§17.10)
  <p> "그림" | "그림 1"~"그림 3"   Caption 1 Semibold 12/16 · text-brand
  [스테퍼 줄]   단계 표시 대상일 때만 (§17.4)
  <FigureView spec stepState=k />  (기존 §7.2: 보드 상자 + figcaption)
  [탐색 버튼 줄]  WU9 범위. 이번 Stage에서는 렌더하지 않음 (§17.14)
```

- 캡션은 `ResultCard` 라벨과 같은 타이포를 쓴다. 색은 §16-9 권고대로 `text-brand`다(흰 카드 위 5.21:1, 12px에서 AA 통과). `ResultCard`의 purple(2.80)·orange(2.20)는 AA 미달이라 쓰지 않는다.
- 그림이 1개면 "그림", 2개 이상이면 "그림 1"·"그림 2"·"그림 3"이다.
- 카드 섹션의 접근 가능한 이름은 `aria-labelledby`로 캡션을 가리킨다. 그림 내용의 이름은 기존대로 figcaption(description)이 준다.

### 17.3 단계 블록 `SolutionStepList` (Q3)

| 항목 | 명세 |
|---|---|
| 조건 | `splitSolutionSteps(solutionMd).ok`일 때만 블록으로 그린다. 실패하면 지금 `ResultCard` 본문과 DOM이 같다(WU0 스냅샷) |
| 구조 | 머리말(첫 표지 앞 텍스트, 있으면) `<p>` → `<ol>` 단계 블록 N개. `<ol>`은 `list-none`(번호는 머리 라벨이 담당) |
| 머리 라벨 | 줄 맨 앞 `**N단계**`의 별표를 지우고 **"N단계"를 같은 줄 본문 앞에 인라인**으로 둔다. **Footnote Semibold** 13/18 590, `text-label-primary`. 라벨 뒤 공백 하나, 이어서 그 줄의 나머지 텍스트(Footnote Regular). 오너 승인 시안 Panel 보드의 `<strong>1단계</strong> …` 표현을 그대로 따른다. 라벨만 따로 한 줄로 쓰면 348px 폭에서 세로가 불필요하게 늘어난다 |
| 본문 | 기존 `ResultCard` 본문과 같다(Footnote 13/18, `whitespace-pre-wrap`, `renderMathText`) |
| 블록 간격 | 목록 `gap-1`(4px) + 블록마다 `-mx-2 px-2 py-1.5` → 본문 사이 시각 간격 16px. 블록 안쪽 여백은 선택 배경이 텍스트에 붙지 않게 하려는 것이다. 선택 여부와 관계없이 **모든 블록에 항상** 적용해 선택이 바뀌어도 레이아웃이 움직이지 않는다 |
| 구분선 | 쓰지 않는다. 머리 라벨의 굵기와 간격으로 충분하고, 선택 테두리(아래)와 겹쳐 보이지 않게 한다 |
| 선택 표시 | 현재 단계 k의 블록에만 `rounded-[10px] bg-fill-tint-brand ring-1 ring-brand`를 준다. **색만으로 구분하지 않는다**: 1px 테두리(brand, 흰 카드 대비 5.21:1, 비텍스트 3:1 충족)는 흑백에서도 상자 모양으로 보인다. 배경 tint는 보조 신호다. 본문 대비는 tint 위에서도 label-primary 11.5:1로 유지된다. `ring`은 box-shadow라 레이아웃을 움직이지 않는다 |
| 선택 의미 전달 | 선택 블록 `<li aria-current="step">` + 머리 라벨 뒤 `sr-only` "(그림에 표시 중)" |
| 최종 선택 시 | 강조 블록 없음. 단계 블록 전체가 평소 모양이다 |
| 블록은 버튼이 아니다 | 블록을 탭해도 단계가 바뀌지 않는다(§17.4 근거). 커서·hover·포커스 없음 |

`ResultCard kind="steps"`와 `ResumeResultCard`는 분할이 성공하면 본문 `<p>` 대신 이 목록을 렌더한다. 라벨("단계별 풀이")과 카드 표면은 그대로다.

### 17.4 현재 단계 선택 방식 (Q4)

**결정: 그림 카드 안의 스테퍼(이전/다음)만 단계를 바꾼다. 단계 블록은 현재 단계를 보여 주기만 한다. 기본 선택은 "최종"이다.**

블록 탭을 쓰지 않는 이유:

1. 그림 카드는 단계 목록 **아래**에 있다. 위쪽 블록을 탭하면 그림이 화면 밖이라 바뀐 그림이 보이지 않는다.
2. 손가락으로 패널을 스크롤하다가 블록을 잘못 탭하기 쉽다(블록이 패널 대부분을 차지한다).
3. 블록 전체를 버튼으로 만들면 스크린리더가 수식을 포함한 단계 전문을 버튼 이름으로 읽고, 텍스트 선택도 막힌다.

스테퍼 줄:

```
[이전]      2단계 / 3      [다음]
```

| 항목 | 명세 |
|---|---|
| 표시 조건 | ① 풀이 분할 성공 **그리고** ② 그 그림이 단계 정보를 가짐(`appearAt`이 null이 아닌 요소가 있거나 `steps`가 비어 있지 않음). 아니면 줄 자체를 렌더하지 않는다(그림은 최종 상태) |
| 위치 | 캡션 다음, 보드 위. 그림을 보면서 바로 누를 수 있다. 그림이 여러 개면 **카드마다** 같은 스테퍼를 둔다(공유 k). 2~3번째 그림을 볼 때 위로 스크롤해 올라가지 않아도 된다 |
| 위치 순서 | s1 → s2 → … → sN → **최종**. 최종은 sN과 보이는 요소가 같고 강조만 없는 상태다(D6, `resolveStepStateAt(spec,"final")`). 순환하지 않는다 |
| 기본값 | **최종**. ① 그림이 늦게 도착해도 처음 보이는 그림이 단계 분할 실패·서버 off와 같다. ② 아무 단계도 강조하지 않아 블록 강조도 없고 풀이 카드가 평소와 같다. ③ 그림 카드는 모든 단계를 읽은 뒤의 위치에 있다 |
| 버튼 | `shared/ui/button` `variant="pill-tint"` + `className="min-h-11"`(Tailwind 기본 44px). 라벨은 텍스트 "이전"/"다음"이다(아이콘 단독 금지, 새 아이콘 없음). pill 기본 높이는 42px(py 11 + 20)이라 44px를 맞추려고 `min-h-11`을 더한다. 흰 카드 위 tint 배경, 라벨 label-primary 11.5:1 |
| 양 끝 | s1에서 "이전", 최종에서 "다음"은 `disabled`다(기존 pill disabled 스타일). **포커스 유실 방지**: 누른 버튼이 그 동작으로 disabled가 되면 반대쪽 버튼으로 포커스를 옮긴다 |
| 상태 텍스트 | 가운데 `flex-1 text-center`. "N단계 / M"(예: "2단계 / 3"), 최종이면 "최종". Footnote Semibold 13/18, label-primary, `tabular-nums` |
| 스크린리더 | 상태 텍스트에 `aria-live="polite" aria-atomic="true"`. **사용자가 누른 결과만** 읽힌다. 처음 마운트될 때(그림 도착)는 내용이 바뀐 것이 아니라 읽히지 않는다. 스테퍼 줄은 `role="group" aria-label="그림 단계 이동"`, 버튼 이름은 보이는 라벨 그대로다. §14.2 "단계 변경을 라이브 영역으로 알리지 않는다"는 이 위치 텍스트에 한해 바꾼다(버튼을 눌러도 아무것도 들리지 않는 문제를 막기 위해). 그림 내용·강조 요소는 읽지 않는다 |
| 키보드 | 네이티브 `<button>`. Tab 순서는 이전 → 다음. 전역 단축키·화살표 키 처리 없음(전역 keydown 금지) |
| 단계 수가 많을 때 | 풀이 단계는 최대 99개, 도형 steps는 최대 20개다. 이번 Stage는 이전/다음만 둔다. AI 풀이는 보통 3~6단계라 충분하다. 실사용에서 8단계를 넘는 풀이가 잦으면 직접 이동(목록 선택)을 Stage 5 이후에 다시 검토한다(§16 남은 결정) |
| 새 풀이 | 새 요청·reset이면 k = 최종으로 돌아간다 |

### 17.5 단계 상태와 그림 (기존 §3·§14.2 보완)

- 그림은 `resolveStepStateAt(spec, k)`로 매번 원래 명세에서 처음부터 계산한다. 같은 k는 같은 그림이다(S4-3).
- 도형 steps에 없는 전역 k → 그때까지 누적된 표시 상태, 강조 없음(S4-2). 강조가 없으므로 모든 요소가 "기본" 상태(§3.1)다. 비강조로 흐리게 하지 않는다.
- 숨김 지시가 없으면 이전 보조선은 남는다(S4-4).

### 17.6 waiting / empty (Q6)

| figuresPhase | 표시 |
|---|---|
| `idle`(도형 기능 off 빌드, 요청 전) | 아무것도 없음 |
| `waiting`, done 후 **500ms 미만** | 아무것도 없음(자리도 잡지 않음) |
| `waiting`, 500ms 이상 | 도형 슬롯에 **대기 줄 한 줄**: `Spinner label="그림을 준비하는 중"`(기존 컴포넌트). 카드·보드 크기 자리는 잡지 않는다 |
| `received` | 그림 카드. 대기 줄을 대체한다 |
| `empty`(도형 이벤트 없이 스트림 종료), 오류, abort | **아무것도 표시하지 않는다.** "그림 없음" 문구도 두지 않는다 |

- **보드 크기만큼 자리를 미리 잡지 않는 이유**: done 시점에는 그림이 올지 알 수 없다. 서버가 도형을 버리면 empty로 끝난다(FIG-6). 360px 자리를 잡았다가 없애면 큰 레이아웃 이동이 생긴다. 대기 줄은 20px 정도라 사라져도 이동이 작다. 그림이 도착하면 최종 답이 아래로 밀리지만, 이것은 학생이 막 단계를 읽고 있는 시점의 아래쪽 이동이다.
- **500ms 지연 이유**: 서버 off + 웹 on이면 done 직후 스트림이 닫혀 곧바로 empty가 된다. 지연 없이 대기 줄을 보이면 한 번 깜빡인다(S4-7). 500ms는 오너 확인 필요(§17.13 S4-V1).
- §9의 "보드 상자 자리 + 가운데 Spinner"는 **그림 하나의 렌더 준비**(JSXGraph 청크 지연 로딩) 상태에 계속 쓴다. 그림 카드가 나타난 뒤 청크가 오기 전까지가 이 상태다. 이때는 그림이 있다는 것이 확정이므로 §7.3 높이로 자리를 잡는다.
- empty 문구를 두지 않는 이유: 그림은 선택적 보조 자료다. "그림이 없어요"는 실패처럼 읽히고, 서버에서 버린 도형을 표시하지 않는 기존 규칙(§8)과도 맞지 않는다.
- 기존 문제(범위 밖): `Spinner` 문구 색 `text-label-secondary` 3.38:1(§9 P2) 그대로다.

### 17.7 aria-live 충돌 (Q7)

- 결과 패널 Body는 `aria-live="polite"`라서 나중에 붙는 노드를 모두 읽는다.
- **결정**: 도형 슬롯 루트(`figureContent`를 감싸는 요소)에 `aria-live="off"`를 둔다. 가장 가까운 조상의 live 설정이 적용되므로 그림 카드·figcaption이 도착해도 읽히지 않는다(S4-9). Body 밖으로 빼는 것은 배치(단계 다음·답 앞) 때문에 불가능하다.
- **Spinner 예외**: `Spinner`는 자체 `role="status" aria-live="polite"`라서 off 아래에서도 "그림을 준비하는 중"을 읽는다. 대기를 알리면 "준비 완료"는 알리지 않는 비대칭이 생긴다. **권장**: `Spinner`에 선택 prop `announce?: boolean`(기본 true = 지금과 동일)을 더해 false면 `role`·`aria-live`를 빼고, 슬롯에서는 `announce={false}`로 쓴다. 공통 컴포넌트에 prop만 추가하므로 기존 사용처는 바뀌지 않는다. 슬롯 루트에는 waiting 동안 `aria-busy="true"`를 둔다.
- 스테퍼 상태 텍스트는 자체 `aria-live="polite"`(§17.4)이고, 사용자 조작에만 바뀐다.
- jsdom 테스트는 속성만 확인할 수 있다. 실제 낭독은 실기기 VoiceOver(§7.5-10)로 확인하고 NOT VERIFIED로 따로 둔다. VoiceOver가 off 아래 노드를 읽으면, 대안은 Body의 `aria-live`를 스트리밍 텍스트 영역으로 좁히는 것이다(범위 확장이라 오너 결정).

### 17.8 단계 전환 애니메이션 (Q8)

- **결정: Stage 4는 즉시 전환한다.** §14.2·P17(150ms)은 승인된 값으로 남겨 두되 이번에는 적용하지 않는다(오너 확인 필요).
- 이유: ① JSXGraph 속성 변경 경로에서 "강조는 페이드, 새 요소 등장은 즉시"처럼 일부만 움직여 일관성이 없다. ② 강조는 의미 신호라 바로 보이는 편이 낫다. ③ S4-3(같은 k = 같은 SVG 속성) 검사와 헤드리스 캡처가 단순해진다. ④ reduced-motion 분기가 필요 없다.
- 단계 블록의 선택 표시도 전환 없이 바뀐다. `transition` 클래스를 쓰지 않는다.

### 17.9 최소 보드 폭 (Q9)

- **`MIN_BOARD_WIDTH = 240px`(제안, 오너 확인 필요).** 근거: 가드가 덮는 Split View 폭 694px에서 패널 `min(420,45vw)`=312 → Body 272 → 보드 240px이다. 이 값이면 눈금 숫자 간격 32px(P16) 기준 7칸, 점 라벨 15px + 거리 6px, 높이 하한 120px이 모두 들어간다. 이보다 좁으면 라벨이 겹치기 시작한다.
- 실제 표시 환경(가로 ≥1024px, 가드 해제)에서 Default 보드는 항상 348px이다. 최소 폭은 **패널 폭 전환(Close→Default 300ms) 중간 프레임**과 **가드에 덮인 상태**에서만 의미가 있다.
- 최소 폭 미만일 때:
  - 보드가 이미 있으면 **직전 크기를 유지**한다. 보드 상자 `overflow-hidden`으로 잘린다. 다시 만들지도, 리사이즈하지도 않는다.
  - 보드가 아직 없으면 만들지 않는다. 보드 상자는 348px 기준 높이로 자리만 잡는다(§7.3 "측정 전" 규칙과 같다). 내용은 비워 둔다.
  - **대체 문구를 쓰지 않는다.** 전환 중 300ms 동안 문구가 깜빡이고, 가드에 덮여 있으면 아무도 보지 못한다. figcaption(description)은 항상 보이므로 내용은 전달된다.

### 17.10 카드 표면 공통화 (Q10, D-6)

- **결정: 컴포넌트 `ElevatedCard`**(`shared/ui/card/ElevatedCard.tsx`). 상수 export만으로 끝내지 않는다. `.claude/rules/frontend.md` §2("재사용은 클래스 복사가 아니라 공통 UI 컴포넌트와 props/variant로")에 맞춘다.
- props: `as?: "div" | "section" | "article"`(기본 `div`), `className?`(레이아웃 추가: `flex flex-col gap-2` 등), `children`, 그리고 `aria-*`·`id` 전달.
- 클래스: 지금 `ELEVATED_CARD_STYLE` 그대로 `bg-bg-elevated rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]`(`Elevation/Card`). 값을 바꾸지 않는다.
- 교체 대상: `DiagnosisCard`, `WorkLineList`, `ResumeResultCard`, `FigurePreviewPage`, 복사본 `ResultCard`·`RecognizedProblemBar`, 새 그림 카드. `features/ai-solution/elevatedCardStyle.ts`는 삭제한다(모든 사용처를 바꾼 뒤).
- **시각 변화 0 검증**: 문자열 동일이 아니라 **클래스 토큰 집합 동일**로 테스트한다. `ResultCard`의 복사본은 같은 클래스를 다른 순서로 갖고 있다(`bg-bg-elevated flex flex-col gap-2 rounded-[14px] p-4 drop-shadow-…`). Tailwind는 순서와 무관하다. 교체 전후 각 사용처의 루트 요소 class 토큰 집합이 같아야 하고, 태그 이름도 같아야 한다(`as` 기본 div).

### 17.11 스트리밍 중 단계 블록 (Q11)

- 스트리밍 중에도 같은 `SolutionStepList`를 쓴다. done 시점에 DOM 구조가 바뀌지 않는다.
- **잘린 표지 숨김**: 스트리밍 텍스트의 **마지막 줄**이 완성된 표지의 앞부분(정규식 `^\*{1,2}(\d{1,2}(단(계(\*{1,2})?)?)?)?$`에 맞는 줄)이면 그 줄을 렌더하지 않는다. 완성되면 머리 라벨로 바뀐다. 안 그러면 `**2단`이 본문에 잠깐 보였다가 라벨로 바뀌어 튄다.
- **불완전한 마지막 단계**: 받은 만큼 그대로 보인다(텍스트가 자라는 기존 동작).
- 첫 표지 전: 분할 실패(`no_markers`)라 기존 단일 본문이다. 첫 표지가 오면 머리말 + 블록 1로 바뀐다. 머리말 텍스트는 같은 자리에 남고 블록이 아래에 붙으므로 위치가 튀지 않는다.
- 스트리밍 중 분할이 실패로 돌아서는 경우(모델이 번호를 건너뜀)에는 단일 본문으로 돌아간다. 드물고 데이터 기준 규칙을 지키는 편이 낫다.
- 스트리밍 중에는 그림·스테퍼가 없으므로 선택 표시도 없다.

### 17.12 서버 off인데 모델이 표지를 쓴 경우 (Q12)

- **결정: 데이터 기준.** 분할이 성공하면 플래그와 관계없이 블록으로 그린다.
- 이유: ① 지금은 `**1단계**` 별표가 그대로 보인다(`renderMathText`는 굵게 처리를 하지 않는다). 블록이 오히려 낫다. ② 같은 텍스트가 플래그에 따라 다르게 보이면 MyPage 재조회와 실시간 화면이 달라진다. ③ 플래그를 화면 컴포넌트까지 넘길 필요가 없다.
- 영향: 서버 off 정상 출력에는 표지가 없어 WU0 스냅샷과 같다. 정규식이 줄 맨 앞 `**N단계**`만 인정하므로 흔한 `**1단계: 식 세우기**`는 분할되지 않는다(그대로 단일 본문).

### 17.13 Stage 4 제안 수치 — **오너 확인 필요**

모두 Figma 근거 없음. 기존 토큰·Tailwind 기본 스케일만 쓴다.

| # | 항목 | 제안값 | 위치 |
|---|---|---|---|
| S4-V1 | 대기 줄 표시 지연 | done 후 **500ms** 이상 waiting일 때만 | §17.6 |
| S4-V2 | 최소 보드 폭 `MIN_BOARD_WIDTH` | **240px** | §17.9 |
| S4-V3 | 스테퍼 버튼 최소 높이 | **44px**(`min-h-11`, pill 기본 42px 보정) | §17.4 |
| S4-V4 | 단계 블록 간격·여백 | 목록 `gap-1`(4px), 블록 `-mx-2 px-2 py-1.5`(8px / 6px) | §17.3 |
| S4-V5 | 선택 블록 표시 | `rounded-[10px]`(기존 radius/10) + `bg-fill-tint-brand` + `ring-1 ring-brand`(1px) | §17.3 |
| S4-V6 | 그림 카드 내부 간격 | `gap-3`(12px, Body·FigureView와 같음) | §17.2 |
| S4-V7 | 그림 카드 사이 간격 | `gap-3`(12px, Body gap 재사용) | §17.1 |
| S4-V8 | 단계 전환 애니메이션 | **즉시**(P17 150ms 이번 Stage 미적용) | §17.8 |
| S4-V9 | (WU9 보류) 탐색 모드 보드 표시 | `ring-2 ring-brand`(2px, box-shadow라 레이아웃 불변) | §17.14 |

### 17.14 탐색 모드 (Q1, D-1) — 명세만 확정, 구현 보류 권장

**권장: (b) 자격 판정 함수 + 이 명세만 이번 Stage에 두고, 구현(WU9)은 미룬다.** 오너 결정 필요(`.omc/plans/figures-stage4.md` §9).

디자인 관점 근거:

1. **운영 화면 노출 0.** AI는 `fixed`만 만든다(D-3). 이번 Stage에 구현해도 학생이 볼 수 있는 경로가 없다. 구현 결과는 `/dev/figures`의 F09에서만 보인다.
2. **iPad 위험이 가장 큰 부분이다.** 탐색 중 보드에는 `touch-action:none`이 필요하다. 348×최대 360px 보드는 591px 패널의 절반 이상이라 손가락 스크롤이 막히는 영역이 크다. 필기 회귀 검사(§7.2)의 "새 touch-action·preventDefault 0" 기준에도 예외를 만들어야 한다. 실기기 확인 없이는 판정할 수 없다.
3. **열린 디자인 결정이 3개 남아 있다**(§16-10·11·12). 운영 노출 없이 결정하면 실제 사용 맥락 없이 정하게 된다.
4. Prompt/15 Stage 4의 "조건을 보존할 수 있는 경우에만 탐색 허용"은 **자격 판정 함수**로 충족된다. 운영에서 자격 있는 도형이 0개이므로 모든 도형이 "조건 유지가 불가능한 도형은 읽기 전용" 규칙대로 읽기 전용이 된다. "초기화 버튼 제공"은 탐색 UI가 생길 때 함께 생기는 요구라, 구현 보류 시에는 **미이행 항목으로 명시 기록**해야 한다(완료 보고에서 숨기지 않는다).

구현할 때(WU9, 이후 Stage) 쓸 확정 명세(§14.1을 이렇게 갱신):

| 항목 | 명세 |
|---|---|
| 진입 버튼 | 자격 있는 도형 카드에만, 보드 **아래**·figcaption 위 줄에 "움직여 보기". `Button variant="pill-tint" min-h-11`. 자격 없으면 버튼 없음(비활성 버튼도 없음) |
| 탐색 중 버튼 | "처음 모양으로"(초기화) + "그만 움직이기"(종료), 같은 variant. 진입 버튼은 "그만 움직이기"로 바뀐다 |
| 탐색 테두리(§16-10) | 보드 상자에 `ring-2 ring-brand`(2px). 1px→2px 두께 변화라 흑백에서도 보이고, box-shadow라 레이아웃이 1px도 움직이지 않는다. 버튼 라벨 변화와 함께 두 신호다 |
| 드래그 점 | P18 그대로(반지름 6, 테두리 `brand-deep` 2, 터치 판정 반경 22px) |
| 키보드 대안(§16-11) | **이번 탐색 1차 구현에서는 두지 않는다.** 탐색은 선택 기능이고 같은 정보(원래 그림·설명)를 읽기 모드가 이미 준다. 목표 기준인 WCAG 2.1 AA에는 드래그 대안 요구(2.2의 2.5.7)가 없다. 진입·초기화·종료 버튼은 키보드로 조작할 수 있다 |
| 단계 변경 시(§16-12) | **자동 종료 + 초기화**. 탐색 좌표에서 다음 단계 보조선을 그리면 원래 풀이와 다른 그림이 된다 |
| 탐색 중 스크롤 | `touch-action:none`·포인터 리스너는 **보드 상자에만**, 탐색 중에만. 보드 밖(카드 여백·다른 카드)에서는 패널 스크롤이 된다. 종료 시 모두 해제 |
| 동시 탐색 | 한 번에 한 도형 |
| 라벨 | 드래그 중에는 점을 따라가되 방향은 유지하고, 손을 뗄 때 §6.3 배치를 다시 계산한다(매 프레임 방향이 바뀌면 라벨이 떨린다) |
| 무효 위치 | 거부하고 마지막 유효 위치에 둔다. 진동·경고 표시 없음 |
| 설명 문구 | figcaption은 원래 그림의 설명 그대로 둔다. 탐색 중에는 버튼 줄 아래에 Caption 1 12/16 label-primary로 **"점을 움직여도 선과 점 사이의 관계는 그대로예요. 길이와 넓이는 풀이와 달라질 수 있어요."** 한 줄(문구 오너 확인 필요). §16-7("그림은 실제와 다를 수 있어요" 안내 없음)은 읽기 모드 결정이라 충돌하지 않는다 |

### 17.15 조건 보존 범위 (Q2, D-2) 검토

plan-agent 제안안에 **동의**하고, 다음을 보완한다.

| 제안안 항목 | 검토 |
|---|---|
| `interaction.mode==="explore"`, `kind==="geometry"`, 함수 제외 | 동의 |
| 끄는 점의 의존 폐포에 given 제약(length·angleMeasure·equalLength·parallel·perpendicular·pointOnCircle·pointOnLine·tangent·collinear) 없음 | 동의. 이 9개가 제약 타입 전체(FIGURE_SPEC §3.4)라서 "폐포에 닿는 given 제약이 하나도 없음"과 같다. **폐포 정의를 명시**한다: 끄는 점 자신 + 그 점에 (직간접으로) 의존하는 모든 요소. 제약이 폐포 안 요소를 하나라도 참조하면 그 제약은 폐포에 닿는다 |
| 폐포에 showLength/showMeasure 수치 라벨 없음 | 동의. 움직이면 숫자가 원래 조건·답과 달라진다(FIG-10) |
| 자유 점만으로 된 rightAngleMark 각 없음 | 동의. **보완**: "자유 점만으로 된"이 아니라 **"derived 수직 관계로 보장되지 않는 rightAngleMark 각 없음"**으로 정의한다. F09의 ∠AHC는 H가 수선의 발이라 A를 움직여도 90°가 유지되므로 허용된다 |
| 런타임 매 프레임 재검증 통과 위치만 | 동의. **보완**: 퇴화도 거부한다. 점 일치, 길이 0 선분, 넓이 0 다각형(삼각형이 한 직선이 됨), 발·교점 계산 불가. 위치는 명세 bbox 안 12px(P15) 이내로 제한한다 |
| (추가) 축이 보이는 도형 제외 | 좌표값이 조건처럼 읽힌다(F06 등). 기하 도형이라도 `axes.visible`이면 제외 |
| (추가) 명세에 없는 조건 | 문제 원문 조건이 `constraints`에 빠져 있으면(예: "이등변"인데 equalLength 없음) 판정 함수는 알 수 없다. 지금은 AI가 explore를 만들지 않으므로(D-3) 수작업 fixture만 대상이라 받아들일 수 있다. **AI가 explore를 만들게 허용하는 시점에는 이 범위를 다시 검토해야 한다** |
| (추가) description | 탐색 중 그림이 바뀌어도 description은 원래 그림을 설명한다(§17.14 설명 문구로 보완) |

현재 자격 fixture는 F09 하나다(제약 2개 모두 `derived`, A만 드래그 가능).

### 17.16 iPad·접근성 점검표 (Stage 4 추가분)

| 항목 | 기준 |
|---|---|
| 터치 타깃 | 스테퍼 버튼 높이 44px(`min-h-11`), 가로는 pill 패딩으로 약 78px 이상(높이 44px로 타깃 충족). 단계 블록은 조작 대상 아님 |
| 보드 위 스크롤 | 읽기 모드 보드는 이벤트 0(§11). 스테퍼·카드 위에서도 세로 스와이프로 패널이 스크롤된다(S4-13) |
| 필기 | 그림 카드·스테퍼는 패널 안에 있어 캔버스와 이벤트가 분리된다. Pencil로 버튼을 눌러도 획이 생기지 않는다(§7.2) |
| 회전·Split View | 가드가 덮는 동안 보드는 §17.9 규칙. 가드가 걷히면 348px로 맞춘다 |
| 키보드 표시 | 보드 높이는 폭 기준이라 변하지 않는다(§7.5). 스테퍼도 높이 고정 |
| 포커스 링 | 기존 Button `focus-visible:ring-2 ring-brand ring-offset-2`. 선택 블록 테두리(`ring-1`)는 포커스를 받지 않는 요소라 혼동되지 않는다 |
| 대비 | 캡션 text-brand 5.21, 스테퍼 라벨·상태 label-primary 11.5 이상, 선택 테두리 brand 5.21(비텍스트 3:1) |
| reduced-motion | 애니메이션이 없어 별도 처리 없음(§17.8) |

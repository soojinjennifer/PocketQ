# 수풀잉 랜딩 페이지 디자인 명세 (구현 전 사전 검토)

- 작성: design-agent, 2026-10-25 (읽기 전용 검토, 코드 변경 없음)
- Figma: `MathService` 파일, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`, 페이지 `3. Landing Page`(`438:1116`)
  - 검토 대상: `Landing Page`(`456:235`) → 실제 화면 프레임 `Supuling Landing · Desktop 1440`(`446:8`)
  - 같은 페이지의 컴포넌트 섹션: `Supuling Landing · Components`(`441:2`)
- 영상(오너 제공)
  - 사용 방법: `vSsyDRtZmKw`
  - 설치 영상: `2RgyXWjlH9I`
- 측정 방법: Figma MCP `get_metadata`, `get_design_context`(섹션별 7회), `get_variable_defs`, `get_screenshot`을 썼다. 에셋은 MCP 임시 URL에서 scratchpad로 받아 크기만 확인했고, 저장소에는 넣지 않았다.

> 우선순위 주의: `docs/PRD_WHYMATH.md`에는 랜딩 페이지 요구사항이 없다(검색 결과 0건). 구현에 들어가기 전에 PRD에 랜딩 항목(라우트, 목적, 수용 기준)을 추가할지 오너가 정해야 한다. 아래 D-1을 보라.

---

## 0. 요약

| 항목 | 결과 |
|---|---|
| 프레임 | **데스크톱 1440 × 4232 하나뿐이다.** 콘텐츠 컨테이너는 1180이고 좌우 padding 24를 빼면 실제 내용 폭은 1132다. 영상 섹션만 내부 폭이 1000(내용 952)이다. |
| iPad 프레임과 모바일 프레임 | **없다.** 페이지 `438:1116` 전체를 확인했고 Desktop 1440만 있다. 1024~1366(iPad), 768~1023(iPad 세로와 Split View), 375~767(폰) 레이아웃은 모두 결정 필요(§6)다. |
| 팔레트 | 앱(`tokens.css`)의 블루그레이 브랜드(`#5e6e82`/`#46536a`)와 **다른 그린 팔레트**를 쓴다(`brand/deep #233538`, `brand/green #4f7d71`, `brand/mint #8fbfae`, `brand/tint #cfe3db`). 이름이 같은 토큰 2개가 서로 다른 값을 가진다(§2.1, D-3). |
| 글꼴 | Pretendard(본문 전체), Gaegu(손글씨 예시), STIX Two Math(수식), SF Pro(푸터)를 쓴다. 앱 전역 글꼴은 SF Pro 시스템 스택이고 **웹폰트를 하나도 로드하지 않는다**(D-4). |
| 공통 컴포넌트 | Figma에 랜딩 전용 컴포넌트 7종(`Landing/Button`, `Badge`, `Check Item`, `Status Chip`, `Work Line`, `Step Card`, Input Mode Toggle 일러스트)이 있다. 기존 `shared/ui`의 `Button`과 `Badge`는 **구조만 비슷하고 색, 크기, 그림자가 맞지 않는다**(§4). |
| 영상 | Figma에서는 두 영상 모두 "어두운 패널 + 72px 재생 버튼 + 캡션" 모양이고 크기는 932×524(정확히 16:9)다. **썸네일 facade를 쓰고, 클릭하면 `youtube-nocookie.com` iframe으로 바꾸는 방식**을 권장한다(§5). |
| ViewportGuard | 지금은 `App.tsx`에서 RouterProvider **전체**를 감싼다. 랜딩만 예외로 두려면 가드를 라우트 레이아웃 단위로 내려야 한다(§6.1, D-6). |

---

## 1. 섹션 구성과 순서

| # | 섹션(Figma 이름, node) | 프레임 y / 높이 | 배경 | 앵커(제안) |
|---|---|---|---|---|
| 1 | Nav (`446:9`) | 0 / 65 | `bg/nav` 반투명 + 하단 hairline | — |
| 2 | Hero (`446:20`) | 65 / 601 | 페이지 배경(`bg/page`) | `#top` |
| 3 | Why · Pain vs Solution (`446:54`) | 666 / 471 | 페이지 배경 | `#why` |
| 4 | How · 3 Touches (`447:43`) | 1137 / 520 | 페이지 배경 | `#how` |
| 5 | Video (`447:78`) — 영상 2개 | 1657 / 1409 | `brand/deep` 전체 폭(full-bleed) | `#video` |
| 6 | Demo · 진단 결과 (`447:91`) | 3066 / 493 | 페이지 배경 | — |
| 7 | CTA · 시작하기 (`447:131`) | 3559 / 602 | 카드 `#cfe3db` | `#start` |
| 8 | Footer (`447:143`) | 4161 / 71 | 페이지 배경 + 상단 hairline | — |

페이지 배경은 Figma 변수 `bg/page` = `#f3f1ea`로 본다. 루트 프레임의 fill은 MCP 출력에 직접 나오지 않아서 스크린샷과 변수 목록으로 추정했다. 구현 전에 Figma에서 한 번 확인한다.

---

## 2. 토큰 대조

### 2.1 색상

| Figma 변수 | 값 | 기존 토큰 | 판정 |
|---|---|---|---|
| `bg/canvas` | `#fbfaf6` | `--color-bg-canvas` | **일치, 재사용** |
| `bg/elevated` | `#ffffff` | `--color-bg-elevated` | **일치, 재사용** |
| `surface/well` | `#e4e1d8` | `--color-surface-well` | **일치, 재사용** |
| `kakao/yellow` | `#fee500` | `--color-kakao-bg` | **일치, 재사용** |
| `kakao/label` | `#191919` | `--color-kakao-label` | **일치, 재사용** |
| `border/edge` | `#232b3824` = rgba(35,43,56,0.14) | `--color-modal-border` | **값 일치.** 이름이 Popup 전용이라 의미가 맞지 않는다. 범용 이름(`--color-border-edge`)을 새로 만들지, 그대로 재사용할지 **오너 확인 필요** |
| `status/error-tint` | `#c97b6e33` = rgba(201,123,110,0.2) | `--color-fill-tint-red` | **값 일치, 재사용** |
| `status/error-row` | `#c97b6e1f`(12%) | (`bg-fill-tint-red/50` = 10%로 근사해 쓰는 중) | **신규. 오너 확인 필요**(12%와 10%의 차이) |
| `bg/page` | `#f3f1ea` | (`--color-bg-primary` `#eceae2`와 다름) | **신규. 오너 확인 필요** |
| `bg/nav` | `#f3f1eae0`(88%) | — | **신규. 오너 확인 필요** |
| `brand/deep` | `#233538` | `--color-brand-deep` = `#46536a` (**이름 충돌**) | **신규. 오너 확인 필요**(D-3) |
| `brand/deeper` | `#0f1c1e` | — | **신규. 오너 확인 필요** |
| `brand/green` | `#4f7d71` | (`--color-accent-teal` `#4f8285`와 비슷하지만 다름) | **신규. 오너 확인 필요** |
| `brand/mint` | `#8fbfae` | — | **신규. 오너 확인 필요** |
| `brand/tint` | `#cfe3db` | `--color-brand-tint` = `#c3ccd9` (**이름 충돌**) | **신규. 오너 확인 필요**(D-3) |
| `label/ink` | `#2f3743` | (`--color-label-primary` `#232b38`와 다름) | **신규. 오너 확인 필요** |
| `label/on-deep` | `#f3f1ea` | — | **신규**(값은 `bg/page`와 같다). 오너 확인 필요 |
| `label/on-deep-secondary` | `#f3f1eab8`(72%) | — | **신규. 오너 확인 필요** |
| `border/hairline` | `#2335381a`(10%) | — | **신규. 오너 확인 필요** |
| `status/error` | `#a85b4e` | (`--color-accent-red` `#c97b6e`와 다름) | **신규. 오너 확인 필요** |

**Figma 안에서 변수에 바인딩되지 않은 하드코딩 색**(구현할 때는 아래 토큰으로 바꿔야 한다)

| 위치 | 하드코딩 값 | 대응 변수 |
|---|---|---|
| Hero H1 "수풀잉" | `#4f7d71` | `brand/green` |
| Hero Lead 굵은 글씨 | `#2f3743` | `label/ink` |
| CTA Card 배경, CTA 이미지 배경 | `#cfe3db` | `brand/tint` |
| `Landing/Button` Primary 3D 하단 그림자 | `#0f1c1e` | `brand/deeper` |

**이름 충돌 처리 제안(D-3, 오너 결정)**

- A안(권장): 랜딩 팔레트에 `--color-landing-*` 접두사를 붙여 등록한다(예: `--color-landing-brand-deep`). 앱 쪽 토큰은 바꾸지 않는다.
- B안: 수풀잉 리브랜딩으로 앱 전체 브랜드를 그린으로 바꾼다. 영향 범위가 커서 별도 계획이 필요하다.

### 2.2 타이포그래피

Figma 텍스트 스타일을 그대로 옮겼다. 줄높이 100은 `normal`, 1.6 등은 배수다.

| Figma 스타일 | 글꼴 / 굵기 | 크기 / 줄높이 / 자간 | 사용처 |
|---|---|---|---|
| (H1, 스타일 미지정) | Pretendard ExtraBold 800 | 66 / 1.1 / -2px | Hero 제목 |
| `Landing/CTA Title` | Pretendard ExtraBold 800 | 48 / 1.15 / -1.2px | CTA 제목 |
| `Landing/H2` | Pretendard ExtraBold 800 | 42 / 1.25 / -1px | Video, Demo 제목 |
| (Why H2) | Pretendard **Bold 700** | 42 / 1.25 / -1px | Why 제목. **H2 스타일과 굵기가 다르다**(D-9) |
| (How H2) | Pretendard **Black 900** | 42 / 1.25 / -1px | How 제목. **H2 스타일과 굵기가 다르다**(D-9) |
| `Landing/Step Number` | Pretendard ExtraBold 800 | 44 / 1 / 0 | Step 번호 |
| (Step 제목) | Pretendard Bold 700 | 21 / 1.2 | Step 카드 제목 |
| `Landing/Lead` | Pretendard Regular 400 | 20 / 1.6 | Hero 리드 |
| `Landing/Label L` | Pretendard Bold 700 | 17 / normal | Primary L 버튼 |
| `Landing/Body L` | Pretendard Regular 400 | 17 / 1.65 | Demo 본문, CTA 본문 |
| `Landing/Handwriting` | **Gaegu** Regular 400 | 17 / 1.5 | Step 2 손글씨 예시 |
| `Landing/Body` | Pretendard Regular 400 | 16 / 1.5 | Check Item, Video 부제 |
| `Landing/Button M` | Pretendard SemiBold 600 | 16 / normal | Secondary 버튼, Google 버튼 |
| `Landing/Button M Bold` | Pretendard Bold 700 | 16 / normal | Kakao 버튼 |
| (Why eyebrow) | Pretendard SemiBold 600 | 16 / normal / 1.5px | "자기주도 학습을…" |
| `Landing/Body S` | Pretendard Regular 400 | 15 / 1.6 | Step 본문 |
| `Landing/Label Bold` | Pretendard Bold 700 | 15 / normal | 비교 카드 제목, Primary M 버튼 |
| `Landing/Diagnosis` | Pretendard Regular 400 | **14.5** / 1.55 | 진단 박스. 14.5는 소수 크기라서 D-9 |
| `Landing/Label` | Pretendard SemiBold 600 | 14 / normal | Nav 링크, Status Chip, 영상 캡션, Outline 배지 |
| `Landing/Label S Bold` | Pretendard Bold 700 | 14 / normal | Block 버튼 |
| `Landing/Caption` | Pretendard Regular 400 | 14 / normal | Hero 체크 |
| `Landing/Math` | **STIX Two Math** Regular | 14 / normal | Work Line 수식, 인식된 문제 |
| `Landing/Eyebrow` | Pretendard Bold 700 | 13 / normal / 1.5px | HOW IT WORKS, WATCH · 1분, 진단 결과는 이렇게 |
| `Landing/Badge L` | Pretendard Bold 700 | 13 / normal | Hero 배지 |
| `Landing/Segment` | Pretendard SemiBold 600 | 13 / normal | Step 1 토글 일러스트 |
| `Landing/Badge M` | Pretendard Bold 700 | 12 / normal | Step 배지 |
| `Landing/Badge S` | Pretendard Bold 700 | 11 / normal | 확인 / 막힌 지점 / 인식된 문제 |
| `Text/Footnote` | **SF Pro** Regular 400 | 13 / 18 | 푸터. **푸터만 SF Pro라서 일관성이 없다**(D-9) |

기존 `docs/DESIGN_SYSTEM.md` §3은 SF Pro 스케일이라서 위 스타일 가운데 대응되는 것이 **하나도 없다.** 모두 **신규이며 오너 확인이 필요하다.**

### 2.3 간격(spacing)

이 페이지에는 Figma 변수 `space/2, 4, 8, 10, 12, 14, 16, 18, 24, 28`이 **실제로 바인딩되어 있다.** `docs/DESIGN_TOKEN_MAP.md` §4의 "Figma에 Spacing Variable Collection이 없다"는 서술과 **어긋나므로 갱신해야 한다.** Tailwind 기본 스케일과 대응시키면 다음과 같다.

| Figma | px | Tailwind 기본 | 비고 |
|---|---|---|---|
| space/2, 4, 8, 12, 16, 24, 28 | 2/4/8/12/16/24/28 | `0.5`/`1`/`2`/`3`/`4`/`6`/`7` | 기본 스케일과 그대로 대응 |
| space/10, 14, 18 | 10/14/18 | `2.5`/`3.5`/`4.5` | Tailwind 4의 동적 스케일(0.25rem 단위)로 표현할 수 있다 |

**변수에 바인딩되지 않은 raw 값**(오너 확인 필요): 섹션 padding `64/40`(Hero), `40/64`(Why), `24/72`(How), `76`(Video), `80/64`(Demo), `24/88`(CTA), `26`(Footer). gap `22`(Hero 열 사이, 버튼 사이), `34`(Why), `30`(How), `44`(Demo), `32`(CTA). 버튼 padding `30`(Primary L), `26`(Primary M, Kakao), 배지 py `7/5/3`, Status Chip Action py `11`, Diagnosis 박스 `15/13`, Work 목록 gap `7`, Step 카드 p `26`, Demo 카드 p `22`, CTA 카드 p `64`.

### 2.4 모서리(radius)

| Figma | 값 | 기존 | 판정 |
|---|---|---|---|
| `radius/999` | 999 | `rounded-full` | 재사용 |
| `radius/18` | 18 | `rounded-[18px]`(DESIGN_TOKEN_MAP §4에 이미 승인) | 재사용 |
| `radius/28` | 28 | — | **신규**(비교 카드, Step 카드) |
| `radius/16` | 16 | — | **신규**(손글씨 예시 박스) |
| raw 24 | 24 | — | **신규**(Hero 이미지 카드, CTA 이미지) |
| raw 30 | 30 | — | **신규**(Demo 카드, 영상 외곽 프레임) |
| raw 22 | 22 | — | **신규**(영상 내부 패널) |
| raw 36 | 36 | — | **신규**(CTA 카드) |
| raw 11 / 8 | 11 / 8 | — | **신규**(Nav 앱 아이콘 40px / 비교 카드 앱 아이콘 30px, Tag 배지, Work Line Stuck 행) |

### 2.5 그림자(elevation)

| Figma 효과 | 기존 `DESIGN_SYSTEM.md` §4 | 판정 |
|---|---|---|
| `Math/Shadow Rest`(3겹 drop + 2겹 inset) | `Elevation/Floating Bar` = `Math/Shadow Rest`(이미 같은 값으로 등록) | **재사용**: Secondary 버튼, Nav S 버튼, Step 카드, Diagnosis 박스 |
| `Math/Shadow Raised`(drop `#232B3836`/`2E`/`1A` + inset 2겹) | `Elevation/Glass Panel`과 레이어 구성이 같다 | **재사용 후보**: Hero 카드, Card·수풀잉, Demo 카드, CTA 카드. 수치를 한 번 더 대조해 확인한다 |
| `Landing/Button Deep`(drop 0,4,0 `#0F1C1E` + drop 0,10,22 `#23353838` + inset 0,2,0 `#FFFFFF2E`) | 없음 | **신규. 오너 확인 필요** |
| `Landing/Well`(inset 0,2,4 `#232B381C` + inset 0,1,2 `#232B3814`) | `Elevation/Well Inset`과 값이 다름 | **신규. 오너 확인 필요** |
| `Landing/Video Frame`(drop 0,24,60 `#00000059`) | 없음 | **신규. 오너 확인 필요** |
| Status Chip / Kakao / Google의 drop 2~3겹(`0,8,8 #232B3824` + `0,3,0 #232B3836`) | `Elevation/Chip Raised`와 비슷하지만 3번째 레이어가 다르다 | **오너 확인 필요** |

---

## 3. 섹션별 명세(텍스트 원문은 Figma 그대로)

> 텍스트는 Figma 원문을 **띄어쓰기, 문장부호, 줄바꿈까지 그대로** 옮겼다. 맞춤법이나 오타로 보이는 부분은 §3.9에 따로 모았다. 구현에서는 오너가 확인한 최종 문구를 쓴다.

### 3.1 Nav (`446:9`)
- 크기: 전체 폭, 높이 64 + 하단 1px `border/hairline`. 배경 `bg/nav`(88% 불투명).
  - 반투명 배경은 sticky와 backdrop-blur를 의도한 것으로 보이지만 Figma에는 blur 효과가 없다(D-10).
- 안쪽: 최대 폭 1180, `px 24`, `py 12`, `justify-between`.
- 로고(왼쪽, gap 10)
  - 앱 아이콘 40×40, radius 11
  - 워드마크 이미지 67.5×26
- 링크(오른쪽, gap 22): `사용 방법` · `영상` · `왜 수풀잉?`(Landing/Label, `label/ink`)
- 버튼: `무료로 시작`
  - `Landing/Button` Primary S, `px 18`, `py 10`
  - 배경 `brand/deep`, 글자 흰색 14 SemiBold
  - 그림자 Shadow Rest

### 3.2 Hero (`446:20`)
- 레이아웃: 2열(`gap 10`), `pt 64`, `pb 40`, `px 24`. 왼쪽 열 546, 오른쪽 열 586×440.
- 왼쪽 열(세로 `gap 22`)
  1. 배지(Badge Tint L): `중1~고3 · Tablet Pencil`
  2. H1(2줄)
     - `어디서 막혔는지,`
     - `수풀잉`(`brand/green`) + `이 찾아줄게요.`
     - 나머지 글자는 `brand/deep`
  3. Lead(폭 520, Figma에서 4개 문단으로 나뉨)
     - `수학 선생님에게 다 물어보지 못했던건들, 나는 열심히 푸는데, 어디가 잘 못 되었을까 누가 알려줬으면 좋겠었죠? `
     - **`이제 AI가 내가 쓴 풀이`**`를 하나하나 읽고, 어디까지 맞았는지 , `
     - `어디서 왜 막혔는지 알려줘요. `
     - **`내 방법 그대로`**` 이어서 풀수 있게, 혹은 또 다른 방법으로 더 잘 풀게! `
  4. 버튼(`gap 22`)
     - `지금 바로 풀어보기 →`: Primary L, `px 30`, `py 16`, 17 Bold, Button Deep 그림자
     - `1분 영상 보기`: Secondary L, 앞에 22px 재생 아이콘, `px 24`, `py 16`, 배경 `bg/canvas`, 테두리 `border/edge`, 16 SemiBold `brand/deep`
  5. 체크 3개(Caption 14, `label/ink`, `gap 18`)
     - `✓ 설치 없이 브라우저에서 “홈화면 추가"로 `
     - `✓ 5초 소셜 로그인`
     - `✓ 3번 터치로 진단까지`
- 오른쪽 Hero Visual(586×440, 요소를 절대 좌표로 겹쳐 배치)
  - 카드 561×387, radius 24, 배경 `bg/canvas`, 테두리 `border/edge`, 그림자 Shadow Raised
  - 그 위에 이미지(레이어 이름: `image/hero-symbol ← supuling-hero-symbol.png 넣기`)
  - Status Chip 3개
    - Success `2번째 줄까지 정확해요`: 위치 (0, 61)
    - Error `3번째 줄: 부등호 방향 오류`: 위치 (322, 198)
    - Action `내 방법으로 계속 →`: 위치 (44, 374)
  - Chip 공통: radius 18, `px 14`, `py 10`, gap 10, 아이콘 26, 14 SemiBold, 배경 `bg/elevated`
  - Action Chip만 배경 `brand/deep`, 글자 흰색, `px 16`, `py 11`

### 3.3 Why · Pain vs Solution (`446:54`)
- `pt 40`, `pb 64`, 세로 `gap 34`, 가운데 정렬
- Eyebrow: `자기주도 학습을 통해 진짜 실력을 키우려면`(16 SemiBold, `brand/green`, 자간 1.5)
- H2(가운데 정렬, 2줄)
  - `정답만 찾는게 아니라`
  - `“내 풀이 방법이 어디서 막히는지” 알아야 하잖아요.`
- 비교 카드 2개(가로 `gap 18`, 같은 폭으로 나눔, 높이를 맞춤)
  - 카드 공통: `p 28`, radius 28, 세로 gap 14, 목록 gap 12
  - 왼쪽 카드 "기존 방식"
    - 배경 `surface/well`, Landing/Well 안쪽 그림자
    - 제목: `해설지 · 인강 · 검색 AI`(15 Bold)
    - Check Item Negative(빨간 X 16px)
      - `정답 풀이를 처음부터 다시 보여줘요, 그리고 풀이 공식을 외우게 해요`
      - `내가 쓴 풀이는 아무도 안 봐줘요. 혼자 공부, 어떻게 해야되요?`
      - `“뭘 잘못 생각했는지”는 끝내 모르고, 그냥 풀이 방법을 외워요ㅠㅠ`
  - 오른쪽 카드 "수풀잉"
    - 배경 `brand/deep`, 그림자 Shadow Raised
    - 브랜드: 앱 아이콘 30(radius 8) + `수풀잉`(15 Bold, `brand/mint`)
    - Check Item Positive(체크 16px, 글자 `label/on-deep`)
      - `일단 내가 생각해서 풀어봐요. 그리고 풀이 과정을 점검해주면 아하! `
      - `막힌 줄 번호와 이유를 콕 짚어줘요. 맞춤 과외선생님이 내 손안에 쏘옥~`
      - `쓰던 방법 그대로, 막힌 곳부터 풀어줘서 혼자 생각하는 능력이 쑤욱!`
- 주의: Check Item 글자가 `whitespace-nowrap`로 되어 있다. 반응형에서는 줄바꿈되도록 바꿔야 한다.

### 3.4 How · 3 Touches (`447:43`)
- `pt 24`, `pb 72`, 세로 `gap 30`, 왼쪽 정렬
- Eyebrow: `HOW IT WORKS`
- H2: `딱 3번 터치면 끝.`(Black 900)
- Step Card 3개
  - 배치: 가로 `gap 18`, 각 365.33(3등분), 높이 315 고정
  - 카드 공통: `p 26`, radius 28, 배경 `bg/canvas`, 테두리 `border/edge`, 그림자 Shadow Rest, 세로 gap 14
  - 헤더: 번호(44 ExtraBold `brand/mint`)와 배지(Badge Tint M)를 양 끝에 배치
  - Step 1
    - 배지 `사진 · 필기`
    - 제목 `문제를 사진으로 찍거나 손글씨로 써요`
    - 본문 `문제집을 찍거나, 사진 보관함에서 고르거나, Apple Pencil로 문제를 쓸 수 있어요`
    - 일러스트: 입력 토글. `필기로 문제 인식`(선택, `brand/deep` 배경) / `사진으로 문제 인식`. well 배경, `p 4`, gap 2, 세그먼트 `px 14`, `py 7`, 13 SemiBold
  - Step 2
    - 배지 `내 풀이`
    - 제목 `풀 수 있는 데까지 혼자서도 풀어봐요`
    - 본문 `틀려도 괜찮아요. 한 줄도 못 쓰겠다면 “아직 못 풀겠어요”로 개념과 첫 힌트부터 시작할 수 있어요`
    - 일러스트: 손글씨 박스(well, radius 16, `px 14`, `py 12`, Gaegu 17/1.5, 기호만 STIX)
      - `D = b² − 4ac`
      - `a=−2, b=4 → D = 24`
      - `D ≥ 0 이면 최댓값…?`
  - Step 3
    - 배지 `진단`
    - 제목(2줄): `“봐 주세요” 하면 ` / `AI가 친절하게 알려줘요 `
    - 본문 `계산 엔진이 줄마다 검증해서 맞은 구간, 막힌 줄, 오류 유형, 관련 개념을 알려줘요.`
    - 일러스트: Primary M 버튼 `봐 주세요`
- Step 카드 안의 토글과 버튼은 **일러스트이며 상호작용하지 않는다**(§7 참고).

### 3.5 Video (`447:78`)
- 전체 폭 배경 `brand/deep`. 안쪽 최대 폭 1000, `py 76`, `px 24`, 세로 `gap 28`, 가운데 정렬
- 헤더(gap 10)
  - Eyebrow `WATCH · 1분`(`brand/mint`)
  - H2 `직접 보면 바로 알아요`(`label/on-deep`)
  - 부제 `문제 입력 → 내 풀이 → 진단 → 이어풀기까지, 실제 화면으로.`(16/1.5, `label/on-deep-secondary`)
- Video Frame 2개(세로 gap 28)
  - 외곽: 배경 `bg/canvas`, `p 10`, radius 30, 그림자 Video Frame
  - 안쪽 패널: 932×524(**16:9**), 배경 `brand/deeper`, radius 22
  - 패널 가운데: 재생 원 72(`#F3F1EA` 원 + `#233538` 삼각형) + 캡션(14 SemiBold, `label/on-deep-secondary`, gap 12)
  - 1번 캡션: `수풀잉 사용 방법 · 1분 영상` → 영상 `vSsyDRtZmKw`
  - 2번 캡션: `수풀잉 설치 영상` → 영상 `2RgyXWjlH9I`
- 주의: Figma 레이어 이름은 **두 프레임 모두 `YouTube Embed · 2RgyXWjlH9I`로 되어 있다.** 오너 지시에 따라 1번은 `vSsyDRtZmKw`로 매핑한다.
  - 다만 YouTube oEmbed 제목을 확인한 결과가 지시와 잘 맞지 않는다.
    - `vSsyDRtZmKw`: "혼자 수학공부 하기 힘들때, 수풀잉! #수학 #ai수학 #자기주도식"
    - `2RgyXWjlH9I`: "혼자 공부해도 어렵지  않도록 풀이를 봐 주는 AI 수학 튜터! 왜?수학-PocketQ"
  - 2번 제목에 "설치"라는 말이 없고 옛 이름 PocketQ가 들어 있다. 매핑을 다시 확인해야 한다(D-7).

### 3.6 Demo · 진단 결과 (`447:91`)
- 2열(`gap 44`), `pt 80`, `pb 64`. 왼쪽 열 521, 오른쪽 카드 567.
- 왼쪽 열(세로 gap 16)
  - Eyebrow `진단 결과는 이렇게`
  - H2(2줄): `처음부터 다시?` / `아니요, 막힌 곳부터.`
  - 본문(17/1.65): `이미 맞게 쓴 줄은 다시 설명하지 않아요. 내 방법으로 계속 풀거나, 학년 범위 안의 다른 해법을 비교해서 골라요. 그래도 궁금하면 “왜?”를 몇 번이든 물어보세요.`
  - 해시태그(Badge Outline L, gap 8): `#개념설명` · `#이차함수 최대·최소` · `#비슷한 문제`
- 오른쪽 Diagnosis Card
  - 카드: `p 22`, radius 30, 배경 `bg/canvas`, 테두리 edge, 그림자 Shadow Raised, 세로 gap 12
  - 인식된 문제: Badge Tag `인식된 문제` + `y = −2x² + 4x + 1 의 최댓값`(STIX 14)
  - 내 풀이(well, radius 18, `px 14`, `py 12`, gap 7): Work Line 3줄
    - `1` `D = b² − 4ac 를 이용하자.` [확인]
    - `2` `a = −2, b = 4, c = 1 → D = 24` [확인]
    - `3` `D ≥ 0 이므로 최댓값이 존재한다.` [막힌 지점] (Stuck 행: 배경 `status/error-row`, radius 8)
  - 진단 박스(`brand/tint`, radius 18, `px 15`, `py 13`, Shadow Rest): **`풀이 진단`**` · 2번째 줄까지 정확해요. 3번째 줄에서 최댓값의 조건을 판별식으로 착각했어요 — `**`a의 부호`**`를 확인해 볼까요?`
  - 선택 버튼(gap 8, 2등분): `내 방법으로 계속`(Primary Block) / `다른 방법으로`(Secondary Block, 배경 흰색)
    - Choice 프레임 높이가 66인데 버튼은 41~43이라 아래 여백이 약 23 남는다. Figma 정리가 필요해 보인다(D-9).
- 카드 안의 버튼과 배지는 모두 **일러스트**다.

### 3.7 CTA · 시작하기 (`447:131`)
- `pt 24`, `pb 88`
- 카드: `p 64`, radius 36, 배경 `#cfe3db`(=`brand/tint`), 테두리 edge, 그림자 Shadow Raised, 2열 `gap 32`(각 열 flex 1)
- 왼쪽 열(gap 16)
  - H2(48/1.15, -1.2): `오늘 막힌 문제,` / `지금 바로 풀어봐요.`
  - 본문(17/1.65, `brand/deep`, 2줄)
    - `PC,에서, 혹은 iPad, 갤럭시 탭에서 열고, 홈 화면에 추가하면 앱처럼 써요.`
    - `이메일·닉네임·학년만 받아요.`
  - 버튼(gap 12)
    - `카카오로 시작하기`: Kakao M, `px 26`, `py 15`, 16 Bold, 배경 `kakao/yellow`, 글자 `kakao/label`
    - `Google로 시작하기`: Secondary, 배경 `bg/canvas`, 테두리 edge, 16 SemiBold `brand/deep`
  - Figma에는 **카카오 심볼과 Google "G" 로고가 없다**(D-8).
- 오른쪽 열: 이미지 484×360, radius 24, 배경 `#cfe3db`, 이미지 opacity 80%(레이어 이름 `image/cta-logo ← supuling-cta-logo.png 넣기`). 이미지 안에 "수풀잉" 글자가 들어 있다.

### 3.8 Footer (`447:143`)
- 상단 1px `border/hairline`. 안쪽 최대 폭 1180, `px 24`, `py 26`, `justify-between`
- 왼쪽: 워드마크 이미지 46.7×18 + `· 수학 풀이 진단 튜터`(SF Pro 13/18, `label/ink`, gap 10)
- 오른쪽(gap 18): `개인정보처리방침` · `이용약관`

### 3.9 문구 확인 목록(원문을 유지하되 오너 확인 필요, D-11)

| 위치 | Figma 원문 | 확인 포인트 |
|---|---|---|
| Hero Lead 1 | `물어보지 못했던건들`, `어디가 잘 못 되었을까`, `좋겠었죠?` | 띄어쓰기와 맞춤법("못했던 것들", "잘못", "좋겠죠") |
| Hero Lead 2 | `어디까지 맞았는지 , ` | 쉼표 앞 공백 |
| Hero Lead 4 | `풀수 있게` | 띄어쓰기("풀 수") |
| Hero 체크 1 | `“홈화면 추가"로` | 여는 따옴표는 곱은따옴표, 닫는 따옴표는 곧은따옴표로 섞여 있음 |
| Why H2 | `찾는게` | 띄어쓰기("찾는 게") |
| Why 왼쪽 카드 2 | `어떻게 해야되요?` | 맞춤법("해야 돼요") |
| CTA 본문 | `PC,에서, 혹은 iPad, 갤럭시 탭에서` | 쉼표 오타로 보임("PC에서") |
| Video eyebrow | `WATCH · 1분` | 2번(설치) 영상의 길이에도 맞는지 |

---

## 4. 컴포넌트 대조

### 4.1 재사용 가능한 기존 자산

| 기존 | 경로 | 랜딩 사용처 | 비고 |
|---|---|---|---|
| `Button` | `apps/web/src/shared/ui/button/Button.tsx` | 구조(`<button>`, `FOCUS_STYLE`, `disabled` 처리)를 재사용 | 현재 variant(`social-kakao`, `pill-dark` 등)는 색(블루그레이), 크기(15/semibold, `px 26`/`py 11`), 그림자가 Landing/Button과 **맞지 않는다.** 랜딩 variant를 추가하는 방식을 권장한다(아래 표). `social-kakao`는 색 토큰만 같다. |
| `Badge` | `apps/web/src/shared/ui/badge/Badge.tsx` | 구조(`span`/`button` 분기)를 재사용 | 현재 variant는 블루그레이 톤이라 Landing Tint(`#cfe3db`), Outline(캔버스 배경 + edge 테두리), Error(`#a85b4e`)와 **맞지 않는다.** variant를 추가한다. 크기 `judgment`(11, `px 8`, `py 2`)가 Badge S(11 Bold, `px 9`, `py 2`)와 가장 가깝다. |
| `TEXT_LINK_FOCUS_RING` | `apps/web/src/shared/ui/text-link/textLinkStyle.ts` | Nav 앵커, 푸터 링크 포커스 | 링 색이 `ring-brand`(블루그레이)다. 랜딩에서 그대로 쓸지 정해야 한다(D-12). |
| `Spinner` | `apps/web/src/shared/ui/spinner/Spinner.tsx` | 영상 iframe을 로딩하는 동안(선택) | — |
| `useAuthActions().signInWithOAuth("kakao" \| "google")` | `apps/web/src/features/auth/useAuthActions.ts` | CTA의 카카오/Google 버튼(D-5에서 직접 OAuth로 정할 경우) | 기존 로그인 화면과 같은 흐름 |
| `ElevatedCard` | `apps/web/src/shared/ui/card/ElevatedCard.tsx` | **재사용하지 않는다** | 표면이 `Elevation/Card`(흰색, radius 14)로 고정이라 랜딩 카드(radius 24~36, Raised 그림자)와 다르다 |
| `Logo` | `apps/web/src/shared/ui/logo/Logo.tsx` | **재사용하지 않는다** | 76/52px, 시안 테두리 고정이고 이미지도 `PocketQLogo.png`로 랜딩 아이콘과 다르다. 랜딩 Nav는 아이콘 40 + 워드마크 조합이다 |
| `InputModeToggle`, `WorkLineList`, `AnswerBox` | `apps/web/src/features/solve-session/…`, `apps/web/src/features/ai-solution/…` | **재사용하지 않는다** | 상태를 가진 인터랙티브 컴포넌트이고 블루그레이 팔레트다. 랜딩의 그림은 정적 일러스트(그린 팔레트)라서 별도로 만든다 |

### 4.2 신규 컴포넌트 제안

| Figma 컴포넌트 | variant | 제안 위치 | 사용 횟수 |
|---|---|---|---|
| `Landing/Button` (`444:36`) | Primary L/M/S/Block, Secondary L/M/Block, Kakao M | `shared/ui/button`에 `landing-*` variant를 추가하거나 `features/landing/LandingButton`으로 분리(D-13) | 실제 링크 6개 + 일러스트 3개 |
| `Landing/Badge` (`444:49`) | Tint L/M/S/Tag, Error S, Outline L | `shared/ui/badge`에 variant를 추가(D-13) | 10회 |
| `Landing/Check Item` (`444:58`) | Negative / Positive | `features/landing/CheckItem` | 6회 |
| `Landing/Status Chip` (`444:72`) | Success / Error / Action | `features/landing/StatusChip` | 3회 |
| `Landing/Step Card` (`445:43`) | Step 1/2/3(하단 슬롯만 다름) | `features/landing/StepCard`(`illustration` slot prop) | 3회 |
| `Landing/Work Line` (`445:12`) | OK / Stuck | `features/landing/DemoWorkLine` | 3회 |
| Video Facade | — | `features/landing/YouTubeFacade` 또는 `shared/ui/video-embed`(D-13) | 2회 |
| Section Header(eyebrow + H2 + 부제) | 왼쪽 / 가운데 정렬, 밝은 / 어두운 배경 | `features/landing/SectionHeader` | 4회. 같은 클래스 조합이 3회 넘게 반복되므로 분리해야 한다(frontend.md §2) |
| Landing Nav / Footer | — | `features/landing/LandingNav`, `LandingFooter` | 1회씩 |

- 페이지: `apps/web/src/pages/landing/LandingPage.tsx`에서 조립만 한다.
- 의존 방향은 `pages → features/landing → shared`를 지킨다. 인증 함수가 필요하면 `pages`에서 `features/auth`와 조합한다(feature 간 직접 참조 금지).

---

## 5. YouTube 영상 표시 방식 권장

**권장: 클릭하면 iframe으로 바뀌는 facade(lite embed). 도메인은 `youtube-nocookie.com`.**

| 기준 | 처음부터 iframe을 넣는 방식 | facade 방식(권장) |
|---|---|---|
| 로딩 성능 | iframe 1개당 YouTube 플레이어 JS와 CSS를 수백 KB 이상 즉시 받는다. 2개면 두 배다. 모바일 LCP와 TBT가 나빠진다. | 첫 화면에는 정적 패널과 썸네일만 그린다. 클릭할 때만 iframe을 만든다. |
| 개인정보 | nocookie를 써도 페이지를 열자마자 제3자에 요청이 간다 | 사용자가 재생을 누르기 전에는 YouTube 요청이 0건이다. 미성년자 대상이고 수집을 최소화한다는 원칙(PRD AUTH-4, §보안)과 잘 맞는다. |
| Figma와 일치 | Figma에 없는 YouTube 기본 UI가 처음부터 보인다 | Figma의 "어두운 패널 + 재생 72 + 캡션"을 그대로 구현할 수 있다 |

구현 명세
- 컨테이너
  - `aspect-video`(16:9)와 `w-full`을 쓴다. Figma 932×524는 16:9와 일치한다.
  - 높이 524를 고정하지 않는다.
  - 외곽 `p 10`, radius 30. 안쪽 radius 22, `overflow-hidden`.
- facade
  - `<button type="button">` 하나로 만든다.
  - `aria-label`: `"수풀잉 사용 방법 영상 재생"` / `"수풀잉 설치 영상 재생"`
  - 재생 아이콘 SVG는 `aria-hidden`이다. 캡션은 보이는 글자로 둔다.
  - 배경
    - 기본안: Figma대로 `brand/deeper` 단색
    - 대안: `https://i.ytimg.com/vi/<id>/maxresdefault.jpg` 썸네일(두 영상 모두 존재를 확인했다, HTTP 200)에 어두운 오버레이를 얹는다
    - 어느 쪽으로 할지 D-7에서 정한다
    - 썸네일을 쓸 경우 `loading="lazy"`, `decoding="async"`를 넣고 alt는 빈 값으로 둔다(버튼에 이미 라벨이 있다)
- 클릭 후
  - `<iframe src="https://www.youtube-nocookie.com/embed/<id>?autoplay=1&rel=0&playsinline=1" title="수풀잉 사용 방법 영상 (YouTube)" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy">`
  - iframe이 생기면 포커스를 iframe으로 옮긴다.
  - iOS Safari에서 autoplay가 막히면 한 번 더 탭해야 할 수 있다. 정상 동작이다.
- 실패 대비: 캡션 아래나 영역 밖에 `YouTube에서 보기`(새 탭, `rel="noopener"`) 텍스트 링크를 두는 것을 권장한다. Figma에는 없으므로 D-7에 포함한다.
- 오프라인(PWA): `youtube-nocookie.com`은 서비스 워커가 캐시하지 않는다. 오프라인일 때 facade만 보이는 것은 허용한다.
- CSP: 지금은 헤더가 없다(`render.yaml`을 확인했다). 나중에 CSP를 도입하면 `frame-src https://www.youtube-nocookie.com`과 `img-src https://i.ytimg.com`이 필요하다.

---

## 6. 반응형 명세

### 6.1 ViewportGuard 비적용(권장안)

- 현재 상태
  - `apps/web/src/app/App.tsx`에서 `<ViewportGuard>`가 `AuthProvider`와 `RouterProvider` **전체**를 감싼다.
  - 그래서 세로 화면이나 1024 미만 폭에서는 어느 라우트에서든 오버레이가 뜬다.
- 권장
  - 랜딩은 처음 방문하는 사람이 폰이나 PC에서 여는 마케팅 페이지다. 가드를 적용하지 않고 반응형으로 만든다.
  - 구현 방법: `App.tsx`의 전역 가드를 없애고, 앱 라우트를 감싸는 레이아웃 라우트(`<ViewportGuard><Outlet/></ViewportGuard>`)로 옮긴다. 랜딩 라우트는 그 레이아웃 밖에 둔다.
  - `ViewportGuard`에 경로 예외 prop을 넣는 방식은 쓰지 않는다. shared 컴포넌트가 라우트를 알게 되기 때문이다.
  - **회귀 위험**: 가드 위치를 바꾸면 `/login`, `/solve`, `/camera` 등 모든 화면이 영향을 받는다. `routing.test.tsx`와 ViewportGuard 테스트를 실제 라우터로 통과시켜 확인해야 한다(메모리 "라우터+가드 E2E" 원칙).
- 남는 UX 문제(D-6)
  - 폰 사용자가 `무료로 시작`이나 `카카오로 시작하기`를 누르면 `/login`으로 가고, 거기서는 가드 오버레이("기기를 가로로 돌려주세요" 또는 "전체 화면에서 이용해 주세요")에 막힌다.
  - 대안 1: 폰 폭에서 CTA 옆에 "iPad·PC에서 이용할 수 있어요" 안내를 붙인다.
  - 대안 2: 그대로 둔다.
- 기타
  - 화면 전체 높이에는 `min-h-dvh`를 쓴다(frontend.md §3-6). 기존 `#root { min-height: 100vh }`와 `IndexRedirect`의 `min-h-screen`은 이번 범위가 아니므로 기록만 한다.
  - PWA manifest에 `orientation: "landscape"`, `start_url: "/"`가 있다. 랜딩을 `/`에 두면 설치한 앱을 열 때 로그아웃 상태 사용자는 랜딩부터 보게 된다(D-2).

### 6.2 브레이크포인트 제안

모바일과 iPad 프레임이 없으므로 아래는 **전부 제안이며 오너 확인이 필요하다.** Tailwind 기본 브레이크포인트를 쓰고, 임의 브레이크포인트는 만들지 않는다.

| 구간 | 대상 기기 | 레이아웃 |
|---|---|---|
| `xl`(1280 이상) | PC, 1440 기준 | Figma 그대로. 컨테이너 `max-w-[1180px]`, `mx-auto`, `px-6`. 영상 섹션은 `max-w-[1000px]`. |
| `lg`(1024~1279) | iPad 가로 1180/1194/1366, 작은 노트북 | 2열을 유지한다. Hero 비주얼은 고정 586 대신 `flex-1`, 이미지는 비율을 유지한다. Status Chip은 이미지 기준 **퍼센트 위치**로 바꾼다. Step 카드 3열과 비교 카드 2열을 유지한다. 글자 크기는 Figma 값 그대로. |
| `md`(768~1023) | iPad 세로 820/834, Split View 1/2·2/3 | Hero를 1열로 쌓는다(카피 → 비주얼). Why 비교 카드는 2열을 유지하고 문장은 줄바꿈한다. Step 카드는 1열(가로 카드) 또는 2+1 중에서 고른다(결정 필요). Demo는 1열(카피 → 카드). CTA는 1열(카피 → 이미지, 이미지는 축소). H1·H2 축소 값은 결정 필요. |
| 기본(767 이하) | 폰 375~430, Split View 1/3(약 320~375) | 모든 섹션을 1열로 쌓는다. Nav는 앵커 3개를 숨기고 로고와 `무료로 시작`만 남긴다(햄버거 메뉴 없이). Hero 버튼 2개는 세로로 쌓고 전체 폭으로. Hero 체크는 세로 목록. Step 카드 높이는 고정 315 대신 auto. 영상은 `aspect-video` 전체 폭, 외곽 radius와 padding 축소는 결정 필요. Demo 선택 버튼은 2열 유지(각 50%). CTA 버튼 2개는 세로 전체 폭. 푸터는 세로 2단. |

공통 원칙
- Figma의 절대 좌표(Hero 비주얼의 칩 위치 등)는 그대로 옮기지 않는다.
- `whitespace-nowrap`(Check Item, Hero 체크, 해시태그)은 `md` 이하에서 해제한다.
- 폰에서 쓸 H1(66)·H2(42)·CTA(48) 축소 값은 Figma에 없다. 임의로 정하지 않고 D-14로 남긴다. 참고로 1440:375 비율이면 H1은 약 36~40이 되지만 이는 제안일 뿐이다.
- 고정 Nav를 쓰면 앵커 이동 시 제목이 가려지므로 각 섹션에 `scroll-margin-top`으로 Nav 높이 65를 준다.

---

## 7. 접근성

- 랜드마크
  - `<header>` 안에 `<nav aria-label="주요 메뉴">`
  - `<main>`
  - `<footer>`
  - 첫 요소로 "본문으로 건너뛰기" skip link를 둔다(Figma에 없으므로 포커스될 때만 보이게).
- 제목 구조
  - H1은 Hero 하나다.
  - 각 섹션 제목(Why, How, Video, Demo, CTA)은 H2다.
  - Step 카드 제목과 비교 카드 제목은 H3이다.
  - eyebrow는 제목이 아니므로 `<p>`로 둔다.
- 일러스트 처리(가장 중요)
  - Hero Status Chip, Step 1 토글, Step 3 `봐 주세요`, Demo 카드의 `내 방법으로 계속`/`다른 방법으로`/배지는 **실제 버튼처럼 보이지만 기능이 없다.**
  - `<button>`으로 만들지 않는다. 비대화형 요소(`div`/`span`)로 만들어 탭 순서에 들어가지 않게 한다.
  - 일러스트 묶음 전체에 `role="img"`와 요약 `aria-label`을 붙이고 내부는 `aria-hidden`으로 숨긴다.
    - 예: Demo 카드 → "진단 예시: 1·2번째 줄은 확인, 3번째 줄에서 막힘"
  - 다른 방법: 내부 텍스트를 그대로 읽게 둔다. 어느 쪽인지는 D-15로 정한다.
- 목록과 아이콘
  - Hero 체크 3개와 Check Item 6개는 `<ul>`로 만든다.
  - `✓` 글자와 X/체크 아이콘은 `aria-hidden`으로 숨긴다. 카드 제목("해설지·인강·검색 AI" / "수풀잉")이 맥락을 전달한다.
  - Step 번호는 `<ol>`로 의미를 전달하고 큰 숫자는 장식으로 처리한다.
- 대체 텍스트
  - Nav: 로고 링크 전체에 `aria-label="수풀잉 홈"`, 아이콘 alt는 빈 값, 워드마크 alt는 "수풀잉"
  - Hero 이미지: 화면 예시 설명(예: "수풀잉 풀이 진단 화면 예시")
  - CTA 이미지: "수풀잉"(이미지 안에 글자가 있음)
  - 푸터 워드마크: "수풀잉"
- 명도 대비(WCAG AA, 직접 계산한 근사치)
  - `brand/green #4f7d71`를 `bg/page #f3f1ea` 위에 쓰면 **약 4.1:1**이다. 66px H1 강조("수풀잉")는 큰 글자라 3:1 기준으로 통과한다. **13px eyebrow(HOW IT WORKS, 진단 결과는 이렇게)와 16px SemiBold Why eyebrow는 4.5:1 미달이다**(D-16).
  - `brand/mint #8fbfae`를 `bg/canvas` 위에 쓴 Step 번호(44px)는 **약 2:1**로, 큰 글자 기준 3:1에도 못 미친다. 번호를 장식으로 처리(`aria-hidden`, `<ol>`로 의미 전달)하면 텍스트 대비 요건은 피할 수 있지만 시각적 판독성 문제는 남는다(D-16).
  - `brand/mint`를 `brand/deep` 위에 쓴 경우(Video eyebrow, 수풀잉 카드 브랜드명)는 약 6:1로 통과한다. `label/on-deep-secondary`를 `brand/deep`/`brand/deeper` 위에 쓴 경우도 통과로 추정한다.
- 터치 타깃(44×44)
  - Nav 텍스트 링크(높이 17), `무료로 시작`(높이 37), 푸터 링크(높이 18)는 미달이다.
  - 시각 크기는 유지하고 padding이나 `min-h-11`로 히트 영역만 넓히는 것을 권장한다.
- 포커스: 모든 링크와 버튼에 `focus-visible` 링을 준다. 링 색(`ring-brand` 블루그레이 또는 `brand/deep`)은 D-12에서 정한다.
- 모션: 앵커 이동에 `scroll-behavior: smooth`를 쓰면 `prefers-reduced-motion: reduce`일 때는 끈다.
- 수식: `y = −2x² + 4x + 1` 같은 텍스트는 유니코드 그대로 둔다. 스크린리더가 "마이너스 2 x 제곱"에 가깝게 읽으므로 충분하다.
- 언어: `index.html`에 이미 `lang="ko"`가 있다.

### 7.1 상태(loading, empty, error, disabled)

| 상태 | 대상 | 명세 |
|---|---|---|
| loading | Hero 이미지 | 첫 화면 이미지라 `loading="eager"`, `fetchpriority="high"`를 주고 width/height를 명시해 CLS를 막는다 |
| loading | CTA 이미지, 영상 썸네일 | `loading="lazy"` |
| loading | 영상 | 클릭한 뒤 iframe이 로드될 때까지 패널 위에 `Spinner`를 띄운다(선택) |
| error | 영상 | iframe을 불러오지 못해도 `YouTube에서 보기` 링크로 대체할 수 있다(§5) |
| error | 썸네일 | 썸네일 요청이 실패하면 Figma 단색 패널로 대체한다(기본안이 단색이라 영향 없음) |
| disabled | CTA 카카오/Google | D-5에서 직접 OAuth로 정할 경우, 진행 중에는 `disabled`와 `aria-busy`를 준다. 기존 로그인 화면 패턴과 같다. |
| empty | — | 정적 페이지라 해당 없음 |
| 인증 상태 | Nav, CTA | 로그인한 사용자가 랜딩에 오면 `무료로 시작` 대신 `계속 풀기`(→ `getPostAuthDestination`)를 보일지, 랜딩을 건너뛰고 리다이렉트할지 정해야 한다(D-2) |

---

## 8. 에셋 목록

임시 URL로 받아 크기를 확인했고 scratchpad에만 저장했다. 저장소에는 넣지 않았다. MCP 임시 URL은 7일 뒤 만료되므로 **구현할 때 다시 받거나 Figma에서 내보내야 한다.**

| # | 에셋 | Figma 노드 | 받은 원본 | 표시 크기 | 처리 권장 |
|---|---|---|---|---|---|
| A1 | 앱 아이콘(Nav) | `446:12` | PNG **1662×1425, 860KB**. 원본 일러스트(`Supuling_2 2`, `456:361`)를 `object-cover`로 잘라 쓰고 있다 | 40×40 | **Figma에서 내보내야 한다.** 컴포넌트 섹션의 `asset/app-icon`(`441:4`, 80×80)을 2x/3x PNG(또는 WebP)로 내보낸다. 원본을 그대로 쓰면 860KB를 40px로 줄여 표시하게 된다. |
| A2 | 앱 아이콘(비교 카드) | `446:76` | PNG 80×80, 2.4KB | 30×30 | A1과 같은 파일(80×80)을 재사용한다 |
| A3 | 워드마크 "수풀잉"(Nav, 푸터) | `446:13`, `447:147` | PNG 135×52, 2.4KB(두 곳이 같은 파일) | 67.5×26 / 46.7×18 | 래스터 2x다. `asset/wordmark`(`441:5`)를 **SVG로 내보내기**를 권장한다. 벡터 원본이 없으면 PNG 3x를 쓴다 |
| A4 | Hero 이미지 | `453:98` | PNG **2388×1668, 528KB**(투명 배경 있음) | 559×387(약 1.43:1) | **Figma에서 내보내야 한다**: WebP와 AVIF로 1x/2x(약 1120w), `srcset`. 레이어 이름은 "hero-symbol.png 넣기"인데 **실제 내용은 앱 풀이 화면 스크린샷**이다. 최종 이미지가 무엇인지 D-17에서 확인한다 |
| A5 | CTA 이미지 | `447:142` | PNG **2000×2000, 1.09MB** | 484×360(opacity 80%, 이미지가 74% 폭으로 가운데 배치) | **Figma에서 내보내야 한다**: WebP 1x/2x(약 720w). opacity 80%는 CSS로 줄지 이미지에 미리 적용할지 정한다 |
| A6 | 영상 재생 아이콘 72 | `447:86` | SVG 540B | 72×72 | SVG를 그대로 쓴다. 하드코딩 색 `#F3F1EA`/`#233538`은 `currentColor`나 토큰으로 바꾼다 |
| A7 | 버튼 재생 아이콘 22 | Secondary L 아이콘 | SVG 540B | 22×22 | SVG를 쓴다 |
| A8 | Check Negative(X) 16 | `444:51` | SVG(stroke `#A85B4E`) | 16 | SVG를 쓴다(색 토큰화) |
| A9 | Check Positive(체크) 16 | `444:55` | SVG | 16 | SVG를 쓴다 |
| A10 | Status Chip Success 26 | `444:60` | SVG | 26 | SVG를 쓴다 |
| A11 | Status Chip Error 26 | `444:65` | SVG(원 `#C97B6E` 20% + 느낌표 `#A85B4E`) | 26 | SVG를 쓴다 |
| A12 | 파비콘, OG 이미지 | — | Figma에 없음 | — | 공유 미리보기(카카오톡 등)에 쓸 OG 이미지(1200×630)가 필요하다. **결정 필요**(D-18) |

에셋 처리 방법 요약
- **SVG 아이콘(A6~A11)**: `download_assets`나 `get_design_context`가 주는 SVG를 그대로 받으면 된다. Figma에서 따로 내보낼 필요는 없다.
- **래스터(A1, A3, A4, A5)**: 지금 MCP로 받은 원본은 크기나 형식이 맞지 않는다.
  - A1: 1662px 원본을 40px로 표시하게 된다.
  - A4, A5: 1~2MB급 PNG다.
  - A3: 저해상도 PNG다.
  - 따라서 **Figma에서 알맞은 크기와 형식으로 내보내거나** 저장소에서 변환(sharp, squoosh 등)해야 한다. 변환 도구를 npm 의존성으로 추가하려면 승인이 필요하다.
- 저장 위치 제안: `apps/web/src/assets/landing/`(import해서 Vite 해시 처리). OG 이미지만 `apps/web/public/`에 둔다.
- 참고: 같은 페이지 밖 영역에 대체 비주얼 후보가 있다.
  - 컴포넌트 섹션의 `문제인식1`(`458:130`), `문제풀이`(`458:133`), `문제풀이_그래프`(`458:166`)
  - 캔버스의 `image 1~3`(`458:98`/`458:101`/`458:104`, 2048px 스크린샷)
  - Hero 이미지를 바꿀 때 사용할 수 있다.

---

## 9. 링크 목적지

| 요소 | 위치 | 목적지(제안) | 확정 여부 |
|---|---|---|---|
| 로고(아이콘+워드마크) | Nav | `/`(랜딩 맨 위) | 제안 |
| `사용 방법` | Nav | `#how`(How · 3 Touches) | 이름으로 추정, **결정 필요**(사용 방법 영상 `#video`일 수도 있다) |
| `영상` | Nav | `#video` | 추정 |
| `왜 수풀잉?` | Nav | `#why` | 추정 |
| `무료로 시작` | Nav | `/login`(로그인 상태면 `getPostAuthDestination`) | **결정 필요**(D-5) |
| `지금 바로 풀어보기 →` | Hero | `/login`(로그인 상태면 `/solve/pencilcanvas` 또는 `/grade-setup`) | **결정 필요**(D-5) |
| `1분 영상 보기` | Hero | `#video`로 스크롤하고 1번 영상 facade에 포커스(자동 재생 여부는 결정 필요) | 추정 |
| Video facade 1 | Video | 그 자리에서 `vSsyDRtZmKw` 재생 | 오너 지시 |
| Video facade 2 | Video | 그 자리에서 `2RgyXWjlH9I` 재생 | 오너 지시. 제목과 맞지 않아 D-7 |
| `카카오로 시작하기` | CTA | A안: `signInWithOAuth("kakao")`를 바로 호출. B안: `/login`으로 이동 | **결정 필요**(D-5) |
| `Google로 시작하기` | CTA | 위와 같음(`"google"`) | **결정 필요**(D-5) |
| `개인정보처리방침` | Footer | **페이지 없음.** `/privacy` 신설 또는 외부 문서 URL | **결정 필요**(D-19) |
| `이용약관` | Footer | **페이지 없음.** `/terms` 신설 또는 외부 문서 URL | **결정 필요**(D-19) |
| Step 카드, Demo 카드, Hero 칩의 버튼 모양 요소 | 일러스트 | 링크 없음(비대화형) | 제안 |

---

## 10. 결정 필요 항목

| ID | 항목 | 선택지 / 권장 |
|---|---|---|
| D-1 | PRD에 랜딩 요구사항이 없다 | `docs/PRD_WHYMATH.md`에 랜딩(목적, 라우트, 수용 기준)을 추가할지. 함께 `docs/FIGMA_SCREEN_MAP.md`에 랜딩 행을 추가한다 |
| D-2 | 라우트 | A: `/`에 랜딩을 두고 로그인 상태면 기존 `IndexRedirect` 동작을 유지. B: `/`는 그대로 두고 `/intro` 같은 별도 경로. PWA `start_url: "/"`를 `/login`으로 바꿀지도 함께 정한다 |
| D-3 | 그린 팔레트 토큰 등록 방식(`brand/deep`, `brand/tint` 이름 충돌) | 권장: `--color-landing-*` 접두사로 신규 등록. 또는 앱 전체를 리브랜딩 |
| D-4 | 웹폰트(Pretendard, Gaegu, STIX Two Math) | 로드 방식(CDN `<link>` 또는 셀프호스팅 woff2 서브셋)과 로딩 정책(`font-display: swap`)을 정한다. npm 패키지(예: `pretendard`)는 **새 의존성 승인 대상**이다. STIX Two Math의 배포처(Google Fonts 제공 여부)도 확인해야 한다. 웹폰트를 쓰지 않으면 시스템 폰트로 대체하는데, 그러면 Figma와 시각 차이가 생긴다 |
| D-5 | CTA 목적지 | `무료로 시작`, `지금 바로 풀어보기`, 카카오/Google을 `/login`으로 보낼지 OAuth를 바로 시작할지. 로그인 상태일 때 보여줄 문구도 정한다 |
| D-6 | ViewportGuard 범위와 폰 사용자 안내 | 권장: 가드를 앱 라우트 레이아웃으로 내리고 랜딩은 제외. 폰에서 CTA를 누르면 가드에 막히는 문제를 어떻게 안내할지 정한다 |
| D-7 | 영상 매핑과 facade 모양 | 2번 영상(`2RgyXWjlH9I`)의 YouTube 제목이 "설치 영상"과 맞지 않는다(PocketQ 홍보 영상으로 보임). 패널 배경을 Figma 단색으로 할지 YouTube 썸네일로 할지, "YouTube에서 보기" 대체 링크를 추가할지 정한다 |
| D-8 | 소셜 버튼 브랜드 표기 | 카카오 로그인 디자인 가이드(심볼과 지정 문구), Google 로그인 브랜딩 가이드("G" 로고)를 지킬지. Figma에는 아이콘이 없다. 기존 로그인 화면 `Button/Login`과 맞출지도 정한다 |
| D-9 | Figma 내부 불일치 | Why H2(Bold)와 How H2(Black)가 `Landing/H2`(ExtraBold)와 다르다. 푸터만 SF Pro다. `Landing/Diagnosis` 14.5px. Demo Choice 높이 66의 남는 여백. 통일할지 원본대로 할지 정한다 |
| D-10 | Nav 동작 | sticky(상단 고정) 여부, backdrop-blur 여부(Figma에는 blur가 없다) |
| D-11 | 문구 교정 | §3.9의 맞춤법, 띄어쓰기, 쉼표 오타를 고칠지 |
| D-12 | 포커스 링 색 | 랜딩에서 기존 `ring-brand`(블루그레이)를 쓸지 그린 계열로 바꿀지 |
| D-13 | 컴포넌트 위치 | Landing/Button과 Badge를 `shared/ui`의 variant로 추가할지, `features/landing`의 전용 컴포넌트로 둘지. 영상 facade를 shared로 올릴지 |
| D-14 | 반응형 값 | iPad 세로와 폰용 Figma 프레임을 추가할지(권장), 아니면 §6.2 제안대로 진행할지. 폰에서 H1·H2 크기, 섹션 padding, 카드 radius를 정한다 |
| D-15 | 일러스트의 스크린리더 처리 | 요약 `aria-label`로 묶을지 내부 텍스트를 노출할지 |
| D-16 | 명도 대비 미달 | `brand/green` 작은 글씨(13~16px eyebrow)는 약 4.1:1, `brand/mint` Step 번호는 약 2:1이다. 색을 조정할지 예외로 허용할지 |
| D-17 | Hero 이미지의 정체 | 레이어 이름은 "hero-symbol"인데 내용은 앱 스크린샷이다. 최종 이미지를 확정한다 |
| D-18 | 메타데이터 | 랜딩 `<title>`, description, OG 이미지와 문구. SPA라 크롤러 대응(정적 메타)이 필요하다. 지금 `index.html`에는 `<title>수풀잉</title>`만 있다 |
| D-19 | 개인정보처리방침과 이용약관 | 페이지(또는 문서 URL)가 없다. 미성년자 대상 서비스라서 공개 전에 마련해야 한다 |
| D-20 | 신규 radius, spacing, shadow 값 | §2.3~2.5의 신규 값(radius 16/22/24/28/30/36/11/8, Landing/Button Deep, Well, Video Frame 그림자, 섹션 padding)을 토큰으로 승인할지, 랜딩에 한정한 임의값으로 둘지. 이 결정에 따라 `docs/DESIGN_TOKEN_MAP.md` §4의 "Figma에 Spacing/Radius 변수가 없다" 서술도 갱신한다 |

---

## 11. 구현 기록(development-agent, 2026-10-25)

- 진입점: `apps/web/home.html` → `src/app/landing/main.tsx`(`LandingApp`). 앱(`index.html`)과 번들을 나눈 멀티 페이지 빌드다(`vite.config.ts` `BUILD_INPUT`, SW `navigateFallbackDenylist: [/^\/home\.html$/]`). `App.tsx`, `routes.tsx`, `IndexRedirect`, `ViewportGuard`, manifest `start_url`은 바꾸지 않았다(D-2, D-6 → 별도 경로 `/home.html` 채택).
- 로그인 상태면 `location.replace("/")`, 확인 중에는 Spinner만 보인다. `getSession`이 3000ms(`SESSION_CHECK_TIMEOUT_MS`) 안에 끝나지 않으면 랜딩을 먼저 그리고, 늦게 세션이 확인되면 그래도 `/`로 이동한다.
- 기기 안내 문구: "iPad 가로 화면에 최적화되어 있어요"(오너 결정, 폰·세로 화면 사용자 대상).
- 토큰: `--color-landing-*`, `--font-landing-*`, `--radius-landing-*`, `--shadow-landing-*`(`shared/styles/tokens.css`, D-3 A안·D-20 랜딩 한정).
- 웹폰트: `home.html`에서만 CDN `<link>`(Pretendard jsdelivr v1.3.9 dynamic subset, Gaegu·STIX Two Math Google Fonts, `display=swap`).
- **반응형: Figma 확정 대기(D-14).** 1440 프레임만 있어 §6.2 제안대로 잠정 구현했다 — `lg`(1024+) 2열/3열, 그 아래 1열. Hero Status Chip은 `md` 이상에서 퍼센트 위치, 그 아래에서는 이미지 아래 세로 목록. H1 36→48(md)→60(lg)→66(xl), H2 30→42(lg), CTA 제목 30→36(md)→48(lg)은 Tailwind 기본 스케일을 쓴 잠정값이다.
- 문구 교정(D-11, 오케스트레이터 결정): `PC,에서`→`PC에서`, `해야되요`→`해야 돼요`, `풀수`→`풀 수`, `찾는게`→`찾는 게`, `맞았는지 ,`→`맞았는지,`, `“홈화면 추가"`→`“홈화면 추가”`. 나머지 §3.9 항목(`못했던건들`, `잘 못`, `좋겠었죠`, `WATCH · 1분`)은 원문 유지(결정 필요).
- 대비(D-16): 밝은 배경 eyebrow `brand/green`(4.13:1) → `brand/deep`(11.35:1). Step 번호 `brand/mint`(1.97:1) → `brand/green`(4.46:1, 44px 큰 글자 기준 3:1 통과).
- Nav·Hero의 `무료로 시작`/`지금 바로 풀어보기 →`는 CTA 섹션(`#start`)으로 이동한다(D-5 잠정). CTA 카카오/Google은 `features/auth/startOAuthSignIn`으로 OAuth를 바로 시작한다.
- 영상: 1번 `vSsyDRtZmKw`(사용 방법), 2번 `2RgyXWjlH9I`(설치). facade는 Figma대로 `brand/deeper` 단색 패널이다(§12 M-4 반영, YouTube 썸네일·덮개 제거).
- 푸터 개인정보처리방침·이용약관은 링크 없는 글자(D-19 결정 필요).

---

## 12. 구현 후 디자인 검수(design-agent, 2026-10-26)

- 방법
  - `pnpm --filter web build` 후 `vite preview --port 5199`(https)로 띄웠다. 검수가 끝난 뒤 서버를 종료했다.
  - headless Chrome(CDP)으로 375, 820, 1180, 1440 폭의 전체 페이지를 캡처했다.
  - 각 폭에서 다음을 측정했다: `scrollWidth`와 `clientWidth`(루트의 `overflow-x-clip`을 잠시 `visible`로 바꾼 상태 포함), 화면 밖으로 나간 요소, 제목의 줄별 폭, 터치 타깃 크기.
  - Figma `446:8` 스크린샷(1440×4232)과 구현 1440 캡처를 섹션별로 나란히 놓고 비교했다.
  - 명도 대비는 반투명 토큰을 실제 배경 위에 합성한 뒤 WCAG 공식으로 계산했다.
- 오너 결정(랜딩 팔레트와 CDN 폰트, 잠정 반응형, CTA에서 OAuth 직접 시작, 기기 안내 문구)과 오케스트레이터 기본값은 검수 대상에서 뺐다.

### 12.1 판정: **PASS with minor**(BLOCKER 0 · HIGH 0 · MEDIUM 6 · LOW 9)

| 항목 | 결과 |
|---|---|
| 1440 충실도 | 섹션 높이가 Figma와 거의 같다. Nav 69/65, Hero 602/601, Why 473/471, How 523/520, Video 1413/1409, Demo 485/493, CTA 602/602, Footer 71/71이고, 페이지 전체는 4238/4232다. 색, 글꼴(Pretendard, Gaegu, STIX), 모서리, 그림자도 Figma와 맞는다. 차이는 Hero 이미지의 잘린 범위, Hero 리드 문단의 줄나눔, 영상 썸네일, 수식 줄 안 한글 글꼴이다(M-1, M-2, M-4, M-6). |
| 가로 스크롤 | 4개 폭 모두 clip을 해제한 상태에서도 `scrollWidth == clientWidth`(375/820/1180/1440)다. **숨은 overflow는 없다.** 화면 밖에 있는 요소는 `sr-only` skip link(-1px) 하나뿐이고 정상이다. |
| 토큰 | 랜딩 코드(`features/landing`, `pages/landing`, `app/landing`, `YouTubeEmbed`)에서 raw hex, rgb, 임의 색, 모서리 값, 그림자 값은 0건이다. 임의 px 값은 모두 §2~3의 Figma 실측값이거나 Figma 좌표를 퍼센트로 바꾼 값이다. Hero 칩 위치 13.9%, 45%, 85%, 7.5%는 Figma 61, 198, 374, 44를 440과 586으로 나눈 값과 일치한다. Figma에 없는 값은 잠정 반응형 축소값과 영상 덮개 60%뿐이고, 둘 다 §11에 잠정이라고 적혀 있다. |
| 재사용 | `LandingButton`이 `shared/ui/button`과 겹치는 것은 정당하다. 이유는 셋이다. 공유 `Button`은 `<button>`만 지원하는데 랜딩에는 `a`와 비대화형 `span`이 필요하다. 공유 `Button`의 기본 스타일은 `w-full rounded-[14px]`이고 포커스 링이 블루그레이다. D-13에서 랜딩 전용으로 두기로 했다. 같은 클래스 조합이 3회 이상 반복된 경우는 L-7 하나다. |
| 접근성 | 랜드마크(header, nav, main, footer, skip link)와 제목 순서(h1 → h2 → h3)를 지켰다. facade 라벨("… 영상 재생"), iframe `title`, 재생 뒤 포커스 이동, 일러스트를 `role="img"` + `aria-hidden`으로 처리한 것, alt, `motion-safe:scroll-smooth`(애니메이션 없음)도 통과다. 미달 항목은 명도 대비 2건과 포커스 링 1건이다(M-3, M-4, M-5). |

### 12.2 MEDIUM

| ID | 파일:줄 | 근거 | 권장 수정 |
|---|---|---|---|
| M-1 | `features/landing/HeroSection.tsx:69-80`, `assets/landing/hero-1120.webp`, `hero-560.webp` | Figma에서는 Hero 카드 안 스크린샷의 iPad 상태바가 잘려 보이지 않는다. 구현에서는 상태바("오후 9:50 10월 24일 토요일", Apple Pencil 표시, 배터리 92%)가 카드 위쪽에 그대로 보이고, 이미지 전체가 덜 확대되어 보인다. 1440, 820, 375 모두 같다. | Figma `453:98`의 이미지 crop(fill transform)을 적용한 상태로 1x와 2x WebP를 다시 내보낸다. `aspect-[1120/782]`와 `object-cover`는 그대로 둔다. CSS `object-position`과 scale로 맞추는 방법은 쓰지 않는다. 폭마다 결과가 달라진다. |
| M-2 | `features/landing/HeroSection.tsx:35-40` | Figma의 Lead는 4개 문단(§3.2)이다. "… 좋겠었죠?" / "이제 AI가 내가 쓴 풀이…" / "어디서 왜 막혔는지 알려줘요." / "내 방법 그대로…"로 나뉘어 있다. 구현은 한 문단으로 이어 붙여서 1440에서 줄나눔이 Figma와 다르다. | 문장 경계에 `<br className="hidden lg:block" />`(또는 `lg:` 이상에서만 블록)을 넣어 1024 이상에서 Figma의 4문단 구조를 따르게 한다. 그 아래 폭에서는 지금처럼 이어서 흘린다. |
| M-3 | `features/landing/LandingBadge.tsx:14`(`error-s`), `DemoSection.tsx:22,28` | "막힌 지점" 배지(11px Bold)는 `#a85b4e`를 `fill-tint-red`(20%), `status/error-row`(12%), `surface/well` 순으로 겹친 배경(합성값 `#dcc3b8`) 위에 쓴다. 대비가 **2.94:1**로 AA 4.5:1에 미달이다. 일러스트(`aria-hidden`) 안에 있지만 화면에는 보이는 글자다. | Figma 값 자체가 미달이므로 **결정 필요**로 남긴다. 후보는 셋이다. (a) Stuck 행 안의 배지 배경을 `bg-bg-elevated`로 바꾼다. 흰 배경 위에서 약 5:1이 된다. (b) 더 어두운 `--color-landing-status-error-strong`을 Figma에 추가한 뒤 적용한다. (c) D-16처럼 일러스트 예외로 기록한다. |
| M-4 | `features/landing/VideoSection.tsx:16-18,48,53,56` | YouTube `hqdefault` 썸네일을 쓴 결과가 Figma(단색 `brand/deeper` 패널)와 다르다. 문제는 둘이다. (1) 2번 영상(`2RgyXWjlH9I`) 썸네일에 **타사 표기 "IDPAi+"**가 크게 보인다. 수풀잉 브랜드 페이지와 맞지 않는다. (2) 1번 썸네일은 밝은 UI 화면이라서 60% 덮개를 씌워도 캡션(`label/on-deep-secondary`, 14px) 대비가 밝은 부분에서 약 **2.9:1**로 떨어진다. | Figma 기본안인 단색 패널로 돌아간다. 방법은 `thumbnailSrc`를 넘기지 않는 것이다. 이렇게 하면 이미지 요청도 0건이 된다. 썸네일을 유지하려면 두 가지가 필요하다. (a) 2번 영상의 커스텀 썸네일 교체를 오너에게 요청한다. (b) 캡션 뒤에 `bg-landing-brand-deeper/80` pill 배경을 두어 4.5:1을 확보한다. |
| M-5 | `shared/ui/video-embed/YouTubeEmbed.tsx:24` | facade의 포커스 링은 `ring-brand`(`#5e6e82`, 앱 블루그레이), 4px inset이다. 썸네일 덮개 위 대비가 `brand/deeper` 대비 3.34:1이고, 밝은 썸네일 부분에서는 **1.14:1**이다(WCAG 1.4.11 비텍스트 대비 3:1 미달). 랜딩 포커스 색(D-12, `brand/deep`)과도 다르다. | 공유 컴포넌트가 랜딩 토큰을 직접 알면 안 된다. 대신 `focusRingClassName?: string` prop을 추가한다. 랜딩에서는 `focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-landing-label-on-deep`(밝은 링)을 넘긴다. M-4의 단색 패널을 쓰면 링 대비는 `#f3f1ea`와 `#0f1c1e` 사이라서 약 16:1이 된다. |
| M-6 | `shared/styles/tokens.css:121`(`--font-landing-math`), `DemoSection.tsx:26,47` | Work Line과 "인식된 문제" 줄 전체가 `font-landing-math`라서 한글("를 이용하자", "이므로 최댓값이…", "의 최댓값")이 STIX에 없는 글자로 처리된다. 그래서 시스템 serif(명조)로 대체되어 자간이 벌어져 보인다. Figma는 한글을 고딕(Pretendard)으로 그린다. | 수식 스택에서 generic `serif` 앞에 한글 대체 글꼴을 넣는다. `"STIX Two Math", "STIX Two Text", "Cambria Math", "Pretendard Variable", Pretendard, serif`로 바꾼다. 토큰 한 줄만 고치면 되고 컴포넌트는 바꾸지 않는다. |

### 12.3 LOW

| ID | 파일:줄 | 근거 | 권장 수정 |
|---|---|---|---|
| L-1 | `LandingButton.tsx:63`, `LandingNav.tsx:47`, `landingStyles.ts:18` | `min-h-11` 때문에 Nav `무료로 시작`의 **보이는 높이**가 Figma 37에서 44로 커졌다. Nav도 65에서 69로 늘었다. `scroll-mt-[65px]`는 실제 헤더 69와 4px 어긋난다. §7은 히트 영역만 넓히라고 권장했다. | `primary-s`는 보이는 크기를 Figma대로 두고 히트 영역만 넓힌다(`relative after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']`). 그다음 scroll margin을 실제 헤더 높이와 맞춘다. |
| L-2 | `HowSection.tsx:34` | Step 일러스트가 `mt-auto`로 카드 바닥에 붙어 있다. Figma는 본문 바로 아래(gap 14)에 이어서 놓는다. Step 1 토글과 Step 3 버튼의 위치가 1440 비교에서 다르게 보인다. | `mt-auto`를 지운다. 카드 높이는 `lg:min-h-[315px]`로 이미 유지된다. |
| L-3 | `HowSection.tsx:32` | 375 폭에서 Step 1 제목이 "문제를 사진으로 찍거나 손글씨로 / **써요**"로 끊긴다. 마지막 줄 폭은 36px다. | h3에 `text-balance`를 추가한다. `SectionHeader` h2와 같은 처리다. |
| L-4 | `LandingNav.tsx:40` | Nav 링크 "영상"의 타깃이 **24×44**로 폭이 44 미만이다. 1180과 1440에서 측정했다. WCAG 2.5.8 AA(24)는 통과하지만 프로젝트 기준 44에 미달이다. | 링크에 `min-w-11 justify-center`를 추가하거나 좌우 `px-2`를 주고 그만큼 `gap-[22px]`을 줄여 보이는 간격을 유지한다. |
| L-5 | `CtaSection.tsx:84` | 820(iPad 세로)에서 CTA 이미지가 카드 폭 전체(약 740×550)로 커져서 CTA 섹션 높이가 970이 된다. 1440에서는 602다. | 1024 미만에서 `max-w-[484px] mx-auto`(Figma 실측 폭)로 제한한다. 폰에서 높이를 줄이려면 D-14에서 함께 정한다. |
| L-6 | `HeroSection.tsx:43` | "지금 바로 풀어보기 →"의 `→`를 스크린리더가 "오른쪽 화살표"로 읽는다. | `<span aria-hidden="true"> →</span>`으로 감싼다. |
| L-7 | `LandingButton.tsx:22-28`, `HeroSection.tsx:13`, `HowSection.tsx:46` | `bg-landing-brand-deep text-bg-elevated` 조합이 6회 반복된다. 그리고 배경 토큰(`bg-elevated`)을 글자색으로 쓰고 있다. | 상수 `LANDING_PRIMARY_SURFACE = "bg-landing-brand-deep text-label-on-dark"`를 `landingStyles.ts`에 만들어 재사용한다. 글자색은 의미 토큰 `--color-label-on-dark`(`#ffffff`, 값이 같다)로 바꾼다. |
| L-8 | `DemoSection.tsx:24-26` | Work Line 행 간격이 Figma보다 약 4px 넓다. 1440 측정에서 Figma는 31, 구현은 35다. `text-sm`의 기본 line-height 20px 때문이다. Figma는 `normal`이다. | 수식 span에 `leading-normal`을 준다. |
| L-9 | `HeroSection.tsx:72`, `LandingNav.tsx:31`, `assets/landing/wordmark.png` | `sizes`가 768~1023에서 `100vw`(약 772px)라서 2x 화면에는 1544w가 필요한데, 가장 큰 후보가 1120w라 조금 흐리다. 앱 아이콘은 원본 일러스트를 가운데 기준으로 잘라 나뭇잎 윗부분이 Figma `asset/app-icon`(`441:4`)보다 더 잘린다. 워드마크는 2x PNG라서 3x 화면에서 흐리다. | 1600w 후보를 추가한다. 아이콘은 `441:4`를 그대로 내보낸 이미지로 교체한다. 워드마크는 SVG로 바꾼다(§8 A1, A3). |

### 12.4 반응형 확인 결과

| 폭 | 결과 |
|---|---|
| 375 | 모든 섹션이 1열이다. Nav는 로고와 `무료로 시작`만 남는다. Hero 버튼은 전체 폭으로 세로 배치되고, 칩은 이미지 아래 세로 목록이 된다. 제목 줄나눔은 L-3 하나를 빼면 정상이다. 문단 최대 폭은 327이다. |
| 820 | Hero, How, Demo, CTA가 1열이고 Why 비교 카드는 2열이다. 리드와 Demo 본문 한 줄 폭이 최대 772px(한글 약 45자)로 조금 길지만 허용 범위다. 화면 비율에 맞지 않는 것은 L-5(CTA 이미지)다. |
| 1180 | Figma 구성(2열과 3열)을 그대로 따른다. H1은 60px이다. 이상 없음. |
| 1440 | §12.1 표와 같다. |

### 12.5 다음 단계

- M-1 ~ M-6을 development-agent가 수정한다. M-3과 M-4(b)는 오너가 먼저 결정해야 한다. 수정이 끝나면 design-agent가 다시 검수한다.
- LOW 항목은 같은 작업에서 처리해도 되고 다음 작업으로 미뤄도 된다.

### 12.6 검수 반영(development-agent, 2026-10-26)

| ID | 반영 |
|---|---|
| M-1 | 원본 2388×1668에서 상단 상태바(Apple Pencil 표시 포함)를 빼고 Figma `453:98`의 확대 범위에 맞춰 잘랐다(`sips` crop 2242×1566, offset y100·x60). 560/1120/1600w WebP로 다시 내보냈고 `srcset`에 1600w를 추가, `sizes`를 `(min-width:1280px) 560px, (min-width:1024px) 45vw, calc(100vw - 48px)`로 고쳤다. |
| M-2 | Lead를 Figma 4문단 경계에서 `<br className="hidden lg:inline" />`로 나눈다(1024 이상만). |
| M-3 | **일러스트 예외로 기록 — 오너 결정 대기.** Demo 카드 "막힌 지점" 배지(11px Bold, `#a85b4e` on 합성 `#dcc3b8`)는 **2.94:1**로 AA 4.5:1 미달이다. 오케스트레이터 결정으로 Figma 색을 유지한다(일러스트 `role="img"` + `aria-hidden`). 대안: (a) 배지 배경을 `bg-bg-elevated`로 바꿔 약 5:1 확보, (b) 더 어두운 에러 토큰(예: `--color-landing-status-error-strong`)을 Figma에 추가 후 적용. |
| M-4 | 썸네일·60% 덮개 제거, `brand/deeper` 단색 패널. `YouTubeEmbed`의 선택 prop `thumbnailSrc`는 남겨 둔다. |
| M-5 | `YouTubeEmbed`에 `focusRingClassName` prop 추가(기본값은 기존 `ring-brand` inset 링). 랜딩은 `ring-landing-label-on-deep`(약 16:1)을 넘긴다. |
| M-6 | `--font-landing-math`에 `"Pretendard Variable", Pretendard`를 `serif` 앞에 넣었다. |
| L-1 | `LandingButton`의 `min-h-11`을 없애고 `LANDING_HIT_AREA`(가운데 정렬 `::after`, 최소 44×44)로 바꿨다. Nav `무료로 시작`의 보이는 높이는 37, 헤더는 65로 돌아와 `scroll-mt-[65px]`와 맞는다. 버튼 라벨 줄높이는 Figma `normal`(`leading-normal`). |
| L-2 | Step 일러스트의 `mt-auto` 제거. |
| L-3 | Step h3에 `text-balance`. |
| L-4 | Nav 링크·로고 링크도 `LANDING_HIT_AREA`(최소 44×44). |
| L-5 | CTA 이미지를 모든 폭에서 `max-w-[484px]`, 1024 미만은 `mx-auto`. |
| L-6 | "지금 바로 풀어보기", "내 방법으로 계속"의 `→`를 `aria-hidden` span으로 감쌌다. |
| L-7 | `LANDING_PRIMARY_SURFACE = "bg-landing-brand-deep text-label-on-dark"`(`landingStyles.ts`)로 6곳을 묶었다. |
| L-8 | Work Line·인식된 문제 수식 span에 `leading-normal`. |
| L-9 | 1600w 후보와 `sizes`는 M-1에서 반영. **결정 필요/후속**: 앱 아이콘을 Figma `asset/app-icon`(`441:4`) 원본 내보내기로 교체, 워드마크를 SVG로 교체(§8 A1·A3) — Figma 재내보내기가 필요하다. |

### 12.7 재검수(design-agent, 2026-10-26)

- 방법
  - 새 빌드를 `vite preview --port 5199`로 띄우고, 검수 뒤 종료했다.
  - headless Chrome으로 375, 820, 1180, 1440 폭에서 DPR 2로 측정했다. 측정 항목은 다음과 같다.
    - `overflow-x-clip` 해제 상태의 가로 overflow
    - `::after` 히트 영역 크기와 그 가장자리를 `elementFromPoint`로 찍은 결과
    - Tab 키 순회에서 `:focus-visible`이 걸리는지와 링 레이어가 있는지
    - 제목과 Lead의 줄 수
    - `currentSrc`(선택된 이미지 후보)
  - 앵커 이동 확인에는 `prefers-reduced-motion: reduce`를 에뮬레이트했다.
  - 처음 측정한 375 결과는 이전 서비스 워커 precache가 내준 옛 번들이었다. 그래서 새 프로필로 다시 측정한 값을 썼다(아래 참고 항목 N-1).

#### 판정: **PASS**(BLOCKER 0 · HIGH 0 · MEDIUM 0. M-3은 오너 결정 대기인 예외로 남는다 · LOW 3)

| ID | 결과 | 근거 |
|---|---|---|
| M-1 | 해결 | 1440 비교에서 상태바가 사라졌고 Figma와 같은 범위로 잘렸다. 선택된 후보는 375에서 1120w(표시 폭 327), 820에서 1600w(737), 1180에서 1120w(549), 1440에서 1120w(560)로 모두 알맞다. |
| M-2 | 해결(잔여는 L-10) | 1024 이상에서 문단 경계로 줄이 바뀐다. 1024 미만에서는 이어서 흐른다. |
| M-3 | 예외로 기록(오너 결정 대기) | 2.94:1 그대로다. 일러스트(`role="img"`) 예외로 §12.6에 기록되었으므로 이번 판정에 넣지 않는다. 공개 전에 오너가 결정해야 한다. |
| M-4 | 해결 | 4개 폭 모두 `#video img`가 0개다. Figma와 같은 단색 패널이고, 재생을 누르기 전 YouTube 요청은 0건이다. 캡션 대비는 8:1 이상이다. |
| M-5 | 해결(잔여는 L-11) | 4개 폭 모두 facade에 `:focus-visible`이 걸리고 `rgb(243,241,234) 0 0 0 4px inset` 링이 보인다. 링과 패널(`brand/deeper`)의 대비는 15.4:1이다. |
| M-6 | 해결 | 계산된 스택은 `"STIX Two Math", …, "Pretendard Variable", Pretendard, serif`다. 수식 줄의 한글이 고딕으로 렌더링되어 Figma와 같다. STIX가 맨 앞이라 라틴 문자와 기호는 계속 STIX로 나온다. |
| L-1 | 해결 | Nav `무료로 시작`의 보이는 높이는 37이고, 헤더는 66(콘텐츠 65 + hairline)이다. 이 둘이 `scroll-mt-[65px]`와 1px 차이인데 무시해도 된다. |
| L-2, L-3 | 해결 | Step 일러스트가 본문 바로 아래에 온다. 375에서 Step 1 제목이 132/173으로 균형 있게 나뉘고, "써요" 한 단어만 남던 줄이 없어졌다. |
| L-4 | 해결 | 로고, Nav 링크 3개, `무료로 시작`의 히트 영역이 모두 44×44 이상이다. 히트 영역 위·왼쪽 가장자리를 `elementFromPoint`로 찍으면 자기 자신이 잡힌다. 히트 영역끼리 겹치는 곳은 없다(화면에 보이지 않는 `sr-only` skip link만 예외). |
| L-5 | 해결 | 820에서 CTA 이미지는 484, 가운데 정렬이다. CTA 섹션 높이가 970에서 817로 줄었다. |
| L-6 ~ L-8 | 해결 | `→`가 `aria-hidden`이다. `LANDING_PRIMARY_SURFACE`가 `text-label-on-dark`를 쓴다. Work Line 행 간격이 Figma 31px과 맞는다. |
| 공통 | 통과 | 4개 폭 모두 clip을 해제해도 `scrollWidth == clientWidth`다(375/820/1180/1440). 랜딩 코드에 raw hex와 rgb는 0건이다. Tab 순회에서 대화형 요소 12개 모두 `:focus-visible`과 링이 확인된다. 밝은 배경 위 링 `brand/deep`의 대비는 페이지 배경 대비 11.35:1, CTA tint 대비 9.56:1이다. |

#### 남은 LOW

| ID | 파일:줄 | 근거 | 권장 수정 |
|---|---|---|---|
| L-10 | `features/landing/HeroSection.tsx`(Lead `<p>`, `max-w-[520px]`) | "풀 수" 띄어쓰기를 고친 뒤 Lead 마지막 문단이 520px을 넘는다. 1180, 1280, 1440에서 6번째 줄에 "풀게!"(40px)만 남고, 1024에서도 같다. Hero 높이는 1440 기준 634로 Figma 601보다 33px 크다. **허용하지 않는다. 첫 화면에서 보이는 줄 끝 고아다.** 브라우저에서 확인한 대안은 셋이다. `lg:max-w-[546px]`(Figma 왼쪽 열 실측 폭)이면 1180 이상에서 **5줄**이 되고 마지막 줄은 524px로 Figma와 같은 구성이다. `text-pretty`만 쓰면 6줄 그대로이고 마지막 줄이 "잘 풀게!" 62px가 된다. 자간 -0.2px도 5줄이 되지만 Figma에 없는 값이라 쓰지 않는다. | `max-w-[520px]`을 `max-w-[520px] lg:max-w-[546px] text-pretty`로 바꾼다. 1180 이상은 Figma처럼 5줄이 된다. 열 폭이 483뿐인 1024~1179에서는 한 단어 고아 대신 두 단어("잘 풀게!")가 남는다. |
| L-11 | `features/landing/VideoSection.tsx:15`(`VIDEO_FOCUS_RING`) | inset 링(`#f3f1ea`)이 바로 바깥 베젤(`bg/canvas #fbfaf6`, p 10)과 이어져서, 포커스가 "흰 테두리가 4px 두꺼워진 것"처럼만 보인다. 패널 대비 15.4:1이라 WCAG는 충족하지만 알아보기 약하다. | 링을 베젤과 떼어 놓는다. 예: `focus-visible:outline-2 focus-visible:outline-offset-[-8px] focus-visible:outline-landing-label-on-deep`(어두운 4px 간격이 생긴다). 또는 `ring-landing-brand-mint`를 쓴다(`brand/deeper` 대비 약 8:1, 베젤과 색이 구분된다). |
| L-9 | — | §12.6에 따라 후속 작업이다. 앱 아이콘 `441:4`를 다시 내보내고, 워드마크를 SVG로 바꾼다. | 그대로 둔다. |

#### 참고(디자인 범위 밖)

- N-1: SW precache에 `home.html`이 들어 있다. 그래서 이미 방문한 사람은 배포 직후 첫 방문에서 이전 랜딩을 본다. 이번 측정에서도 재현되었다. 앱과 같은 workbox 동작이라 의도된 것일 수 있다. 랜딩 문구를 자주 바꿀 계획이면 `home.html`을 precache에서 빼거나 NetworkFirst로 둘지 development-agent가 판단한다.

---

## 13. Stage QA(stage-qa-agent, 2026-10-26)

대상: 커밋 전 작업 트리의 랜딩 일체(`home.html`, `vite.config.ts`, `app/landing`, `pages/landing`, `features/landing`, `features/auth/{startOAuthSignIn,useAuthActions}`, `shared/ui/video-embed`, `shared/styles/{tokens,theme}.css`, `assets/landing`). 커밋 2c43ec9(CAS)는 범위 밖. 제품 코드는 고치지 않았다. 변이 시험은 백업에서 복원했고 `git diff`와 untracked 파일 해시가 시험 전후 같다(이 문서만 design-agent §12.7 추가로 달라졌다).

### 13.1 판정: **STAGE CONDITIONAL PASS — FIX REQUIRED**(BLOCKER 0 · HIGH 0 · MEDIUM 2 · LOW 7)

기능, 보안, 회귀, 배포 준비는 통과했다. MEDIUM 2건(SW 거부 목록의 실효성, 그 테스트의 공백)은 작은 수정이고, 고친 뒤 재검증하면 PASS다. 배포 직전에 처리하는 것을 권한다.

### 13.2 게이트(저장소 루트)

| 단계 | 결과 |
|---|---|
| typecheck | 0 |
| lint | 0 |
| test | 최종 0: api 71 파일/1,045, web 122 파일/1,279. **첫 실행은 1 실패**였다. `MyPage.figures.test` "solve·resume 그림이 각자 자리에"가 `waitFor` 1초를 넘겼다(diff 밖, 단독 재실행 통과). §7.18.4의 "재실행 1회"를 쓴 두 번째 실행은 기계 부하(load 74, macOS 데몬이 CPU 점유)로 vitest worker 응답 시간 초과가 났다(web 118/122 파일 통과 후 중단, 단언 실패 없음). load 3에서 세 번째 실행이 36초에 전부 통과했다. 규칙상 "첫 실행 0"은 충족하지 못했고 환경 부하로 판정한다. 랜딩 관련 테스트는 어느 실행에서도 실패하지 않았다 |
| build | 0 (precache 12개, 8에서 증가) |

### 13.3 dist 확인

| 항목 | 결과 |
|---|---|
| `dist/home.html`과 전용 청크 | PASS. `assets/home-*.js` 29.6kB. 공유 청크 `global-*.js`(400kB)는 앱과 랜딩이 같이 쓴다 |
| 메인 번들에 랜딩 코드 없음 | PASS. "iPad 가로 화면", `vSsyDRtZmKw`, `2RgyXWjlH9I`, `youtube-nocookie`, "WATCH"가 `home-*.js`에만 있다. 앱 JS 합계(main 576kB + global 400kB)는 직전 빌드(약 977kB)와 같다 |
| `sw.js` denylist | `denylist:[/^\/home\.html$/]` 있음 |
| `home.html`이 precache에 있나 | 있다(`home.html`, `home-*.js`, `global-*`). **문제 여부**: 아래 M-QA-1, L-QA-3 |
| SW 활성 상태에서 `/home.html` | PASS(정확한 경로만). Chromium+SW에서 `/home.html`, `/home.html?utm_source=x`, `/home.html#video`는 랜딩을 돌려주고 오프라인에서도 열린다. precache 라우트가 NavigationRoute보다 먼저 맞는다. denylist 줄을 지운 `sw.js` 복사본으로도 같은 결과여서, **이 정규식은 정확한 경로에서는 없어도 결과가 같다** |
| SW 활성 상태에서 `/home.html?ref=kakao` | **FAIL → M-QA-1.** index.html이 나가고 SPA의 "페이지를 찾을 수 없습니다"가 보인다 |
| 앱 라우트와 fallback | PASS. SW 활성에서 `/login`은 로그인 화면, 없는 경로는 SPA 404 화면(기존 동작). 오프라인 `/login`도 정상 |

### 13.4 기능(사용자 흐름, Chromium 헤드리스, Supabase 통신은 전부 가로채 스텁 처리)

| 요구 | 결과 | 증거 |
|---|---|---|
| 로그인 상태면 `/`로 `location.replace` | PASS | 유효 세션을 localStorage에 심으면 `/home.html` → `/`(→ `/grade-setup`)로 이동한다. 랜딩 h1은 한 번도 그려지지 않았다. 뒤로 가기가 `/home.html`로 돌아가지 않는다 |
| 확인 중 Spinner | PASS | 만료 세션 + 갱신 요청 4.5초 지연: 1.5초 시점에 `role=status`만 있고 h1 없음 |
| 3초 넘으면 랜딩 | PASS | 같은 실험 3.3초 시점에 h1 있고 Spinner 없음 |
| 늦은 세션도 이동 | PASS | 같은 실험에서 4.54초에 `/`로 이동 |
| 영상 위치와 주소 | PASS(해석 확인 필요) | 사용 방법 `vSsyDRtZmKw` → 설치 `2RgyXWjlH9I` 순으로 **한 Video 섹션 안**에 나란히 있다(Figma 구성, §9 오너 지시와 같음). 페이지 맨 아래가 아니라 "설치 영상이 섹션 아래쪽"이다. 오너가 "맨 아래"를 페이지 하단(CTA 근처)으로 뜻했다면 위치가 다르다 |
| facade와 nocookie | PASS | 재생 전 iframe 0개, 단색 패널, 외부 요청은 폰트 CDN 3곳(jsdelivr, googleapis, gstatic)뿐이다. 클릭 뒤 `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&rel=0&playsinline=1`, `referrerpolicy=strict-origin-when-cross-origin`, `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`, 포커스가 iframe으로 이동. 키보드 Enter로도 재생된다 |
| CTA 카카오/Google | PASS | 클릭 시 `/auth/v1/authorize?provider=kakao|google&redirect_to=<origin>`(스텁 가로채기, 실제 로그인 없음). `redirect_to`는 `window.location.origin`이라 기존 `/login`과 같다 |
| 기기 안내 문구 | PASS | "iPad 가로 화면에 최적화되어 있어요"가 CTA 섹션에 1개 |
| 외부 링크 rel | 해당 없음 | 랜딩에 `target=_blank`와 외부 `<a>`가 0개다. 푸터 개인정보처리방침·이용약관은 링크 없는 글자(D-19) |
| 비밀값 | PASS | `home.html`에 키, 토큰 없음. Supabase anon 키는 기존 앱 번들과 같은 공개 키다 |
| 스크롤과 앵커 | PASS | body 스크롤 잠금 없음(wheel 1500px 이동), `#video` 앵커 이동 시 헤더 아래 65px에 맞는다 |

### 13.5 반응형

Chromium과 WebKit(헤드리스 근사. 실제 iPad Safari 아님)에서 폭 320, 507(Split View), 694, 820, 1024, 1194, 1366 모두 `overflow-x-clip` 해제 후에도 `scrollWidth == clientWidth`이고 화면 밖 요소가 없다. 1194×834 첫 화면 캡처에서 겹침과 잘림이 없다. Hero 리드의 고아 단어(L-10)와 포커스 링(L-11)은 design-agent §12.7 그대로 남아 있다.

### 13.6 회귀

| 항목 | 결과 |
|---|---|
| `useAuthActions` diff | PASS. `startOAuthSignIn`으로 옮긴 본문이 원본과 글자 단위로 같다(`provider`, `redirectTo: window.location.origin`, `error.message` 반환). `OAuthProvider`/`AuthActionResult` 타입은 re-export |
| 로그인 테스트 | PASS. `auth`, `pages/login`, 랜딩, video-embed, MyPage.figures 10 파일 85 테스트 |
| 변경 금지 파일 | PASS. `App.tsx`, `routes.tsx`, `IndexRedirect.tsx`, `ViewportGuard.tsx`는 `git status`에 없다. manifest `start_url: "/"`와 `vite.config.ts`의 삭제된 줄 0개 |
| 토큰 | PASS. `tokens.css`, `theme.css` 삭제 줄 0, 추가 선언 66개가 전부 `*-landing-*`다. 기존 값 변경 없음 |
| 새 의존성 | 없음. `package.json`, lockfile 무변경 |
| 코드 감사 | TODO, FIXME, console, debugger, `@ts-ignore`, `eslint-disable`, `dangerouslySetInnerHTML`, 하드코딩 비밀 0건. 랜딩 → auth는 `pages/landing`에서만 주입해 feature 간 참조 금지를 지켰다 |

### 13.7 변이 시험(각각 적용 → 관련 테스트 → 복원)

| 변이 | 결과 |
|---|---|
| 세션이 있어도 이동 안 함 / `/login`으로 이동 / `replace`→`assign` | 모두 잡힘 |
| 제한 시간 3000→30000 / 타이머 콜백 무동작 | 잡힘 |
| 제한 시간 뒤 늦은 세션 이동 차단(`isActive=false`) | 잡힘 |
| Spinner 제거 | 잡힘 |
| OAuth provider를 google로 고정 / `redirectTo`를 href로 / 오류를 삼킴 / 카카오 버튼이 google 호출 | 모두 잡힘 |
| iframe 도메인 `youtube-nocookie`→`youtube.com` / 처음부터 iframe 렌더 / 두 영상 id 맞바꿈 | 모두 잡힘 |
| iframe `allow` 속성을 `*`로 | **살아남음 → L-QA-1** |
| denylist 정규식 값 변경(`homex`) | 잡힘 |
| **denylist를 workbox 설정에서 제거(배선 삭제)** | **살아남음 → M-QA-2** |
| `BUILD_INPUT`에서 home 제거 / `input` 배선 제거 | 잡힘 |
| 기기 안내 문구 변경 | 잡힘 |

### 13.8 배포 준비(Render 정적 사이트)

- `render.yaml`의 `pocketq-web.routes`는 `/* → /index.html` rewrite 하나다. `staticPublishPath: apps/web/dist`라서 `dist/home.html`이 그대로 올라간다.
- 운영 도메인에 읽기 요청으로 확인했다. `/sw.js`, `/manifest.webmanifest`, `/icons/icon-192.png`는 rewrite와 상관없이 파일로 200이 나가고, 없는 경로(`/nonexistent-xyz`)는 index.html 200이다. 지금 `/home.html`은 아직 배포 전이라 404(text/plain)다. 파일이 있는 경로는 파일이 우선하므로 **배포하면 `/home.html`이 그대로 나갈 것으로 판단한다. 설정 변경은 필요 없다.** 단 배포 후 실제 확인 전까지는 NOT VERIFIED다.
- 배포 후 확인 순서: ① `curl -I https://pocketq.groundmoyo.com/home.html`이 200 `text/html`인지, 본문에 `home-*.js`가 있는지 ② 이미 앱을 방문한 브라우저(SW 활성)에서 `/home.html`을 열어 랜딩이 나오는지 ③ Supabase Redirect URLs에 `https://pocketq.groundmoyo.com`, `/**`가 있는지(`docs/DEPLOYMENT.md`에 이미 있음).

### 13.9 이슈

**MEDIUM**

| ID | 내용 | 수정 |
|---|---|---|
| M-QA-1 | `navigateFallbackDenylist: [/^\/home\.html$/]`는 Workbox가 경로+쿼리에 대해 검사하는데 `$`로 끝나 쿼리가 붙으면 맞지 않는다. 정확한 `/home.html`은 precache가 먼저 응답해서 이 줄이 없어도 결과가 같고, `?utm_*`, `?fbclid` 외의 쿼리(`/home.html?ref=kakao`, 카카오톡·네이버 등 공유 링크)는 SW가 활성인 사용자(앱을 한 번 열어 본 사람)에게 index.html을 줘 "페이지를 찾을 수 없습니다"가 보인다. 새 방문자와 SW 없는 사용자는 영향 없다. 정규식을 `/^\/home\.html/`로 바꾼 `sw.js` 복사본에서 `?ref=kakao`가 랜딩으로 나오는 것을 확인했다 | `NAVIGATE_FALLBACK_DENYLIST = [/^\/home\.html(?:\?|$)/]`(또는 접두 `/^\/home\.html/`). 오너 명시 값이 `$`형이므로 오너 확인 필요 |
| M-QA-2 | `viteConfig.test.ts`가 상수 `NAVIGATE_FALLBACK_DENYLIST`만 검사한다. `workbox.navigateFallbackDenylist`에 실제로 연결되었는지는 안 본다(줄을 지워도 통과). 쿼리가 붙은 경로 사례도 없다 | 설정의 VitePWA 플러그인 옵션에서 `workbox.navigateFallbackDenylist`가 그 상수를 가리키는지 단언하고, `/home.html?ref=x`도 케이스에 넣는다 |

**LOW**

| ID | 내용 |
|---|---|
| L-QA-1 | iframe `allow` 속성을 검사하는 테스트가 없다(변이 생존). 단언 하나로 충분하다 |
| L-QA-2 | 영상 재생 자체(YouTube 쪽 임베드 허용 여부, 오류 153/150)는 확인하지 못했다. iframe 주소와 요청 도달만 확인 |
| L-QA-3 | `home.html`에도 `registerSW.js`가 들어가 있어서, 랜딩만 보고 가는 방문자도 SW가 설치되고 앱 전체(약 1MB)를 배경에서 내려받는다. 또 precache 때문에 이미 방문한 사람은 배포 직후 첫 방문에 이전 랜딩을 본다(design-agent N-1과 같은 건, `autoUpdate`라 다음 방문부터 새 것). 랜딩 문구를 자주 바꿀 계획이면 `home.html`에서 SW 등록을 빼거나 precache에서 제외 |
| L-QA-4 | Workbox `cleanUrls`로 SW 활성 시 `/home`도 랜딩이 나오지만 운영 서버에서는 SPA 404다. `/home.html/`도 SPA 404. 요구 범위 밖이라 둔다 |
| L-QA-5 | 랜딩 Tailwind 유틸리티와 토큰이 앱의 `global-*.css`에도 들어간다(`landing` 187회). 단일 Tailwind 진입점이라 피할 수 없고 크기 영향은 측정하지 않았다 |
| L-QA-6 | `og:image`, `twitter:image`가 없다(`twitter:card=summary`). 공유 미리보기에 이미지가 안 나온다 |
| L-QA-7 | CTA 버튼 글자는 "카카오로 시작하기"/"Google로 시작하기"(Figma 문구). 요구 문구 "시작"과 어미만 다르다 |

### 13.10 NOT VERIFIED

- 실제 iPad Safari와 Split View(WebKit 헤드리스 근사만): NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED
- 실제 카카오/Google OAuth 왕복(요구에 따라 하지 않음). `authorize` 요청 주소만 확인
- 운영 도메인에서의 `/home.html`(미배포)
- YouTube 영상 실제 재생
- 오너의 "설치 영상은 맨 아래" 해석(위 13.4)

### 13.11 다음 단계 전 필수 수정

1. M-QA-1: denylist 정규식을 쿼리까지 막도록 수정(오너 확인).
2. M-QA-2: denylist 배선과 쿼리 사례를 테스트에 추가.
3. (권장) L-QA-1 `allow` 단언, 영상 위치 해석 오너 확인.
수정 후 재검증은 `viteConfig.test`, 변이 M6a 재시험, 빌드 후 SW 활성 `?ref=` 프로브면 충분하다.

### 13.x 재검수·Stage QA 반영(development-agent, 2026-10-26)

| ID | 반영 |
|---|---|
| M-QA-1 | `NAVIGATE_FALLBACK_DENYLIST = [/^\/home\.html(?:[?#]|$)/]` — workbox가 pathname+search로 비교하므로 쿼리·해시도 막는다(오케스트레이터 결정). |
| M-QA-2 | workbox 옵션을 `buildWorkboxOptions()`로 분리해 export. `viteConfig.test.ts`가 `vite-plugin-pwa`를 mock해 VitePWA에 실제로 넘어간 `navigateFallbackDenylist`·`globIgnores`를 검증한다(설정에서 빼면 6개 테스트 실패 확인). 사례: `/home.html`·`?ref=x`·`#video` 일치, `/home`·`/`·`/login` 불일치. |
| N-1 / L-QA-3 | `globIgnores`에 `home.html` 추가 — 랜딩은 precache하지 않고 항상 네트워크에서 받는다. SW 등록은 그대로. |
| L-QA-1 | iframe `allow`·`allowfullscreen`·`referrerpolicy` 단언 추가. |
| L-10 | Hero Lead `max-w-[520px] lg:max-w-[546px] text-pretty`(546 = Figma 왼쪽 열). |
| L-11 | 영상 facade 포커스: inset 링 유지 + `outline-2 outline-solid outline-offset-[-8px] outline-landing-label-on-deep`. 링과 outline 사이에 어두운 패널 띠가 남아 흰 베젤과 구별된다(headless Chrome 캡처로 확인, mint 대안은 쓰지 않음). |

### 13.12 재검증(stage-qa-agent, 2026-10-26, 위 §13.x 수정 반영 뒤)

**최종 판정: STAGE PASS — READY FOR NEXT STAGE**(BLOCKER 0 · HIGH 0 · MEDIUM 0 · LOW 5). 제품 코드는 고치지 않았다. 변이 시험 전후 `git diff`와 변경·untracked 파일 해시가 같다.

| 항목 | 결과 |
|---|---|
| 게이트 | typecheck 0, lint 0, test 0(**첫 실행**: api 71 파일/1,045, web 122 파일/1,279→1,289), build 0(precache 11개, 12에서 감소). 이번에는 §7.18.4 예외를 쓰지 않았다 |
| M-QA-1 | 해결. 거부 목록 `/^\/home\.html(?:[?#]|$)/`. 빌드 뒤 SW 활성 Chromium(Render rewrite 에뮬레이션 서버, 포트 5198)에서 `/home.html`, `?ref=kakao`, `?ref=kakao&utm_source=x#video`, `#video`, `?utm_source=x` 모두 네트워크에서 받은 랜딩(index.html 아님, `?ref=kakao`도 "페이지를 찾을 수 없습니다" 없음). 없는 경로는 SPA 404 화면, `/login`은 로그인 화면(기존 동작) |
| M-QA-2 | 해결. 변이 시험: 배선 삭제(M6a) 5건 실패, workbox를 빌더 없이 리터럴로 교체 5건 실패, 정규식 `$`만 3건, 해시 누락 1건, 너무 느슨한 접두 2건 실패 — 전부 잡힘 |
| N-1 / L-QA-3 | 해결. `sw.js`에 `home.html` precache 항목이 없다(`home-*.js`는 있음). `globIgnores`의 `home.html`을 지우는 변이는 테스트 1건이 잡는다. **업그레이드 시나리오**: 옛 빌드(home.html precache, SW 제어 중)에서 새 빌드로 SW를 갱신하면 `/home.html`이 SW 응답(옛 번들 `home-BBh3Dlzo`)에서 네트워크 응답(새 번들 `home-BPCOG3KG`)으로 바뀌고 캐시에 `home.html`이 남지 않는다. 대가로 랜딩은 오프라인에서 열리지 않는다(`/login` 앱 화면은 열림, 의도된 변경) |
| L-QA-1 | 해결. `allow`, `referrerPolicy`, `allowFullScreen` 각각 변이 시 테스트가 실패한다 |
| JSXGraph 런타임 캐시 | 변경 없음. `VITE_FIGURES_ENABLED=true` 빌드(scratch outDir)의 `sw.js`에 `/assets/jsxgraph-[^/]+\.js$/` CacheFirst, `cacheName:"jsxgraph"`, `maxEntries:4`가 있고 precache에 jsxgraph 청크가 0개다. 기본(off) 빌드에는 jsxgraph가 `sw.js`에 0회다. 리팩터 전 인라인 리터럴과 같다. 다만 이 세 값을 지키는 **자동 테스트는 없다**(urlPattern, `jsxgraph-*.js` globIgnore를 바꾸는 변이가 테스트를 통과함 — 리팩터 전에도 없던 공백, LOW-1) |
| L-10 | 해결. Chromium·WebKit 1194/1440에서 Hero 리드 5줄, 마지막 줄 524px(고아 없음). 1024에서는 6줄, 마지막 줄 두 단어(62px/84px)로 design-agent 예측과 같다 |
| L-11 | 해결. Chromium 1194에서 facade 포커스가 `outline: 2px solid rgb(243,241,234)`, offset -8px로 베젤과 떨어진다. WebKit 헤드리스는 Tab 포커스가 안 걸려 확인하지 못했다(NOT VERIFIED, 실기기 필요) |
| 가로 overflow | Chromium·WebKit 320/507/820/1024/1194/1440에서 `scrollWidth == clientWidth` |

남은 LOW(차단 아님): LOW-1 jsxgraph 런타임 캐시 설정 무테스트(위), L-QA-2 영상 실제 재생 미확인, L-QA-4 `/home`·`/home.html/`는 SW 활성 때와 운영 서버 동작이 다름(범위 밖), L-QA-5 앱 `global-*.css`에 랜딩 유틸리티 포함, L-QA-6 `og:image` 없음. L-QA-7 CTA 문구는 Figma대로 유지(오너 결정). 영상 "맨 아래" 배치 해석은 오너 확인 항목으로 남는다.

NOT VERIFIED: 실제 iPad Safari·Split View(PHYSICAL DEVICE TEST REQUIRED), 실제 OAuth 왕복, 운영 도메인 `/home.html`(미배포; 배포 뒤 `curl -I`로 200 text/html과 `home-*.js` 확인), YouTube 실제 재생, WebKit 포커스 링.

---

## 14. Round 2 사전 검토(design-agent, 2026-10-26)

- 기준
  - 승인된 계획 `.omc/plans/landing-round2.md`(D2-1 ~ D2-12)
  - Install 섹션은 Figma 프레임이 없다. 그래서 Video 섹션(`447:78`)의 실측값과 기존 토큰만으로 정한다.
- 측정에 쓴 자료
  - 썸네일 4장: `maxresdefault`(두 영상 모두 1280×720, 실재)와 `hqdefault`(480×360을 16:9로 잘라 씀). 각각 932×524로 줄인 뒤 픽셀 단위로 WCAG 대비를 계산했다.
  - 오너 에셋 3종
  - headless Chrome 페인트 순서 실험

### 14.0 계획 수정이 필요한 항목(**BLOCKER**, 구현 전에 반영)

- **D2-8 포커스 링이 썸네일에 가려진다.**
  - 원인: facade `<button>`에 주는 inset `box-shadow`(ring)와 음수 offset `outline`이, 버튼 안의 `absolute` 썸네일 `<img>` 아래에 그려진다.
  - 실험: 실험 페이지에서 ring과 outline 둘 다 자식 이미지 아래로 들어가 보이지 않았다. 마지막 자식 span에 같은 스타일을 주면 이미지 위에 그려졌다(ring 0~4px, 사이 틈 4~6px, outline 6~8px).
  - 지금 랜딩에서 링이 보이는 이유: 썸네일이 없고, 덮개 span이 투명이기 때문이다.
- 수정 명세
  - `YouTubeEmbed`의 `focusRingClassName`을 **버튼이 아니라 버튼의 마지막 자식인 장식 span**에 적용한다. span은 `aria-hidden`, `pointer-events-none absolute inset-0 rounded-[inherit]`이다.
  - 버튼에 `group`을 주고, prop 값은 `group-focus-visible:` 접두사를 붙여 쓴다.
  - 버튼과 그 장식 span이 패널 radius를 따르도록 버튼에도 `rounded-[inherit]`를 준다.
  - 기본값(`ring-brand`)의 동작은 유지한다. 앱에는 썸네일을 쓰는 곳이 없다.
- 테스트: "썸네일이 있을 때 포커스 장식 span이 img보다 뒤(DOM 순서)에 있다"를 추가한다.

### 14.1 Install 섹션(`features/landing/InstallVideoSection.tsx`)

| 항목 | 명세 |
|---|---|
| 셸 | Video와 같다. `<section id="install" aria-labelledby="install-title" class="bg-landing-brand-deep {LANDING_SCROLL_MARGIN}">` 안에 `mx-auto flex w-full max-w-[1000px] flex-col gap-7 px-6 py-14 lg:py-[76px]`를 둔다. 같은 조합이 두 번 쓰이므로 `LANDING_DARK_BAND_INNER` 상수로 묶기를 권장한다. 바깥 `bg-landing-brand-deep`은 섹션 의미 클래스라서 각 섹션에 그대로 둔다. |
| 위치와 간격 | CTA(`pb-14 lg:pb-[88px]`) 다음, Footer 앞에 둔다. CTA 카드의 아래 여백이 밝은 띠로 남으므로 따로 간격을 더하지 않는다. Footer의 위 hairline(`border-landing-border-hairline`)은 어두운 띠 다음에도 그대로 둔다(밝은 배경 위라 보인다). |
| 헤더 | `SectionHeader align="center" tone="dark"`, 굵기는 기본 extrabold(`Landing/H2`)다. 문구는 다음과 같다. eyebrow `INSTALL`, H2 `홈 화면에 추가하는 방법`, subtitle `설치 없이 브라우저에서 홈 화면에 추가하면 앱처럼 열려요.` D2-9의 H2를 유지하고 subtitle을 더했다. Hero 체크 "설치 없이 브라우저에서 …"와 같은 어휘를 쓴다. CTA 본문 "홈 화면에 추가하면 앱처럼 써요"와 문장이 겹치지 않게 했다. |
| 영상 | `LandingVideoFrame videoId="2RgyXWjlH9I" title="수풀잉 설치" caption="수풀잉 설치 영상" autoplayOnView`. 프레임은 Video와 같다(`bg-bg-canvas rounded-landing-panel shadow-landing-video-frame p-1.5 md:p-2.5`). |
| 내용 확인(결정 대기, D2-5) | 이 영상의 YouTube 제목에 "설치"라는 말이 없고, 썸네일에는 타사 표기 **"IDEAi+"**가 크게 나온다(계획서의 "IDPAi+"는 오타). 섹션이 "홈 화면에 추가하는 방법"을 약속하므로 영상 내용과 맞는지 오너가 확인한다. 오너가 YouTube에서 커스텀 썸네일로 바꾸는 것을 권장한다. |
| 기타 | Video 섹션 eyebrow `WATCH · 1분`은 이제 사용 방법 영상 하나만 가리키므로 그대로 맞다. Nav에는 항목을 추가하지 않는다(D2-10). |

### 14.2 썸네일 위 캡션, 재생 아이콘, 포커스 링

대비 측정값(최솟값 / 하위 5% / 중앙값). 위치는 932×524 패널 기준으로 캡션 220×30 영역(가운데 y≈325), 재생 원 둘레 37~44px, 가장자리 10px 띠다.

| 대상 | `vSsyDRtZmKw`(밝은 UI 화면) | `2RgyXWjlH9I`(어두운 배경) | 판정 |
|---|---|---|---|
| 캡션 글자를 썸네일 위에 바로 올림 | 1.00 / 1.02 / 1.13 | 2.2 / 4.2 / 7.1 (hq) | 미달. pill이 꼭 필요하다 |
| 캡션 pill `bg-landing-brand-deeper/60` | 4.06 / 4.06 / 4.35 | 7.0 / 9.6 / 11.9 | 미달 |
| **캡션 pill `bg-landing-brand-deeper/80`(D2-7)** | **8.16** / 8.16 / 8.48 | **10.8** / 12.5 / 13.7 | **확정**. 최악의 픽셀에서도 AA 통과 |
| 재생 원(`label/on-deep`)과 주변 썸네일 | 1.00 / 1.05 / 1.12 | 1.00 / 1.04 / 5.45 | **미달**. 밝은 화면 위에서 원이 보이지 않는다 |
| 포커스 ring `brand/deeper`와 베젤 `bg/canvas` | 16.68 | 16.68 | 통과(썸네일과 무관) |
| 포커스 outline `label/on-deep`과 썸네일 가장자리 | 1.00 / 1.08 / 17.2 | 17.5 이상 | 1번 영상에서는 보조 역할만 한다. ring이 주 표시이므로 허용 |

- **D2-7 확정**
  - pill: `rounded-full bg-landing-brand-deeper/80 px-3 py-1 text-sm font-semibold text-landing-label-on-deep`
  - 글자색을 `label/on-deep-secondary`에서 `label/on-deep`으로 바꾼다. 72% 알파를 겹치면 대비가 떨어지기 때문이다.
  - 아이콘과 pill 사이 `gap-3`(Figma 12)은 그대로 둔다.
- **재생 아이콘 수정(신규)**
  - `VideoPlayIcon`을 감싸는 요소에 `rounded-full ring-4 ring-landing-brand-deeper/80`를 준다.
  - 어두운 테두리와 흰 배경의 대비는 약 9:1, 밝은 원과는 약 8:1이다. Figma의 밝은 원 모양은 그대로 둔다.
  - 덮개 전체(예전 60% scrim)는 다시 넣지 않는다. 썸네일을 보여 달라는 것이 오너 요청이다.
- **D2-8 확정, 단 §14.0 수정이 전제다.**
  - 값: `group-focus-visible:ring-4 group-focus-visible:ring-inset group-focus-visible:ring-landing-brand-deeper group-focus-visible:outline-2 group-focus-visible:outline-solid group-focus-visible:outline-offset-[-8px] group-focus-visible:outline-landing-label-on-deep`
  - 이 값을 장식 span에 준다.
- 참고(LOW)
  - 1번 썸네일은 가장자리가 흰색이라서, 포커스가 없을 때 패널 경계가 베젤(`#fbfaf6`)과 붙어 보인다. 바깥 베젤 radius가 30, 안쪽이 22라서 모서리는 구별된다. 따로 처리하지 않는다.
  - muted 자동 재생 뒤 보이는 YouTube 자체 UI(음소거 해제 버튼)는 디자인 범위 밖이다.

### 14.3 오너 앱 아이콘(Nav 40px, Why 카드 30px)

| 항목 | 측정 |
|---|---|
| `app-icon-rounded.png` 168×168 | 둥근 모서리, 청록 테두리, 아래쪽 그림자가 이미지에 구워져 있다. 불투명 영역은 x 8~160, y 4~156이다. **"수풀잉" 글자가 y 114~144(높이의 18%)에 들어 있다.** |
| 40px로 표시 | 글자 높이가 약 7px이다. 판독할 수 없는 얼룩처럼 보이고, 바로 옆 워드마크 "수풀잉"(26px)과 같은 말을 반복한다. |
| 30px로 표시(Why 카드, `brand/deep` 위) | 글자 높이가 약 5px이다. 바로 옆에 제목 텍스트 "수풀잉"이 있어 역시 반복된다. CSS `rounded-landing-icon-sm`(8)이 이미지에 구워진 모서리(30px 기준 약 5px)보다 커서, 테두리 모서리가 조금 잘린다. |

- **판정: 그대로는 권장하지 않는다(결정 필요, 오너).** 코드는 바꾸지 않았다.
- 권장 순서
  1. 오너에게 **글자 없는 아이콘**(일러스트만, 정사각형, 투명 테두리 없음, 최소 120px)을 요청한다.
  2. 받을 수 없으면 168 원본에서 **x 30~138, y 4~112(108×108)**를 잘라 글자를 뺀 뒤, 40/80px WebP로 만든다. 모서리는 CSS radius(`rounded-landing-icon` 11, `-icon-sm` 8)가 담당한다.
  3. 오너가 "글자 포함"을 원하면 그대로 쓰고, 중복을 의도된 것으로 기록한다.
- `app-icon-small.png`(84)도 글자가 들어 있어 같은 문제가 있다.
- 2x(80px)는 168 원본에서 줄이므로 해상도는 충분하다.

### 14.4 OG 이미지 1200×630(`apps/web/scripts/og-landing/og-landing.html`)

- 캔버스: 1200×630, `background: var(--color-landing-bg-page)`
  - 모든 콘텐츠는 가운데 **1200×600 안전 영역(y 15~615)** 안에 둔다. 아래 배치에서 실제로 쓰는 범위는 y 85~545다.
  - 좌우 여백은 64다.
  - 2:1 미리보기(카카오톡 등)에서도 잘리지 않는다.
- 오른쪽 로고 카드
  - 크기와 위치: 460×460, left 676, top 85
  - 모양: `border-radius: var(--radius-landing-cta)`(36), `background: var(--color-bg-canvas)`, `border: 1px solid var(--color-landing-border-edge)`, `box-shadow: var(--shadow-landing-raised)`
  - 이미지: `logo-960.png`를 `object-fit: contain`, 460×460으로 넣는다.
  - 근거: logo-2000의 배경이 `#fbfaf6`로 `bg/canvas`와 같아서 카드와 이음매 없이 붙는다.
- 왼쪽 텍스트 열: x 64, 폭 564(1200 − 64 − 460 − 48 − 64), 세로 가운데 정렬, 세로 간격 22(Figma Hero gap)
  1. 배지 `중1~고3 · Tablet Pencil`(Hero 원문)
     - `background: var(--color-landing-brand-tint)`, `color: var(--color-landing-brand-deep)`
     - 13px Bold, padding 7/12, radius 999(`Landing/Badge L`)
  2. H1 두 줄 `어디서 막혔는지,` / `수풀잉이 찾아줄게요.`
     - `font-family: var(--font-landing-sans)`, 800, **52px**, line-height 1.1, letter-spacing -2px
     - 색은 `var(--color-landing-brand-deep)`이고, "수풀잉"만 `var(--color-landing-brand-green)`이다.
     - 52px는 1440 기준 66px에서 측정한 둘째 줄 폭 691px를 564px에 맞게 줄인 값이다(691 × 52/66 ≈ 544).
  3. 설명 한 줄 `AI가 내 풀이를 한 줄씩 읽고, 막힌 곳을 짚어줘요.`
     - 20px Regular, line-height 1.6(`Landing/Lead`), `color: var(--color-landing-label-ink)`
     - home.html description을 줄인 문장이다. 20px에서 약 500px로 한 줄에 들어간다. 줄바꿈되면 18px로 줄인다.
- 금지 사항
  - raw hex를 쓰지 않는다.
  - 워드마크는 넣지 않는다. 로고 안에 "수풀잉"이 이미 있다.
  - 도메인 텍스트는 넣지 않는다. 미리보기 카드가 도메인을 따로 보여 준다.
- 렌더링: 계획 D대로 1200×630, DPR 1로 만든다. 렌더링 전에 `document.fonts.ready`를 기다린다. Pretendard가 CDN에서 늦게 오면 시스템 글꼴로 찍힌다.
- 메타: 계획 D대로 넣는다. `og:image:alt` = `수풀잉 — 어디서 막혔는지, 수풀잉이 찾아줄게요`

### 14.5 사후 검수 때 확인할 항목

- 썸네일이 있는 상태에서 Tab으로 facade에 포커스했을 때 ring과 outline이 보이는지. 375, 820, 1180, 1440 캡처로 확인한다.
- 캡션 pill과 재생 아이콘 테두리를 실제 화면에서 측정한다.
- Install 섹션의 H2가 6번째 H2이고, Footer 링크 두 개의 히트 영역이 44 이상이며 focus 링이 보이는지.
- OG PNG가 1200×630이고 300KB 이하인지. 텍스트가 안전 영역 안에 있는지.

### 14.6 Round 2 구현 기록(development-agent, 2026-10-26)

- 기준: 계획 `.omc/plans/landing-round2.md`(D2-1 ~ D2-12 승인), 위 §14.0 ~ 14.4(계획보다 우선).

#### 결정 확정

- **"막힌 지점" 배지(§12 M-3) — 오너 확정(2026-10-26).** Figma 색을 그대로 둔다. 일러스트 예외(`role="img"`, 2.94:1)로 기록하고 코드는 바꾸지 않는다. M-3은 더 이상 결정 대기가 아니다.
- **오너 앱 아이콘(§14.3) — 오케스트레이터 결정: 2안(crop).** `app-icon-rounded.png`(168)에서 x 30~138, y 4~112(108×108)를 잘라 구워진 "수풀잉" 글자를 뺐다. 이것으로 `assets/landing/app-icon-40.webp`(1x)와 `app-icon-80.webp`(2x)를 만들었고, 모서리는 CSS radius(`rounded-landing-icon` 11, `-icon-sm` 8)가 담당한다. `app-icon-120.webp`는 지웠다.
  - 오너가 **글자 없는 아이콘**(정사각형, 일러스트만, 120px 이상)을 주면 같은 두 파일만 바꾸면 된다. 원본 파일은 세션 scratchpad `landing/owner/`에만 두고 저장소에는 넣지 않았다.
  - crop 윗줄(y 4)에 원본 청록 테두리가 1px 정도 걸친다. 40px 표시에서는 약 0.4px라 보이지 않는다(2x 캡처로 확인).
  - 두 WebP가 4KB 미만이라 Vite가 data URI로 인라인한다(빌드 산출물에 별도 파일이 없다).
- **법적 고지(D-19) — 링크로 전환.** Footer `개인정보처리방침` → `/privacy.html`, `이용약관` → `/terms.html`(같은 탭, `LANDING_HIT_AREA`로 히트 영역 44 이상, `LANDING_FOCUS_RING`). 오너가 `apps/web/public/{privacy,terms}.html`을 올려 배포하기 전까지 운영(Render)은 이 두 URL에 **text/plain 404("Not Found")**를 돌려준다 — Render는 없는 `.html` 경로에 SPA rewrite를 하지 않는다(§15 L-R2-2 운영 확인, 2026-10-26 정정. 처음 기록한 "SPA 404 화면"은 로컬 에뮬레이션 서버 기준이라 틀렸다). **공개 전에 두 페이지를 반드시 올린다.** 올리기 전에 Footer가 공개되면 사용자는 빈 "Not Found"를 본다.

#### 구현 요약(계획 항목 대응)

| 계획 | 구현 |
|---|---|
| A 공유 코드 | `shared/ui/video-embed/`에 `youTubeUrls.ts`, `youTubePlayerMessages.ts`, `useViewportPlayback.ts`, `YouTubePlaybackGroup.tsx` + `youTubePlaybackGroupContext.ts`(react-refresh 규칙 때문에 context·hook을 분리)를 두었다. `YouTubeEmbed`에는 `thumbnailFallbackSrc`와 `autoplayOnView`를 추가했다. `shared/lib/dom/usePrefersReducedMotion.ts`도 추가했다. |
| §14.0 | `focusRingClassName`은 버튼의 마지막 자식 장식 span(`aria-hidden pointer-events-none absolute inset-0 rounded-[inherit]`)에 붙는다. 버튼에는 `group rounded-[inherit]`를 준다. 기본값은 `group-focus-visible:ring-4 group-focus-visible:ring-inset group-focus-visible:ring-brand`이다. 앱에는 다른 사용처가 없다. |
| A 랜딩 | `features/landing/LandingVideoFrame.tsx`가 베젤, 썸네일(maxres → hq → 패널 단색), 재생 아이콘 ring(`ring-landing-brand-deeper/80`), 캡션 pill(`bg-landing-brand-deeper/80 text-landing-label-on-deep`), §14.2 포커스 값을 담는다. `VideoSection`은 `vSsyDRtZmKw` 하나만 보인다. `LandingPage`는 `<main>`을 `YouTubePlaybackGroup`으로 감싼다. |
| B | `features/landing/InstallVideoSection.tsx`(`id="install"`)는 §14.1 문구를 쓰고 `2RgyXWjlH9I`를 `autoplayOnView`로 재생한다. 셸 조합은 `LANDING_DARK_BAND_INNER`(`landingStyles.ts`)로 뽑아 Video와 함께 쓴다. 페이지 순서는 Hero → Why → How → Video → Demo → CTA → Install → Footer이고, Nav는 바꾸지 않았다. |
| D | `apps/web/scripts/og-landing/og-landing.html` + `logo-960.png`(`sips -Z 960`). §14.4 배치를 그대로 따르고, 색·모서리·그림자·글꼴은 `tokens.css` 변수만 쓴다. `document.fonts.ready`와 로고 load 전까지 내용을 숨긴다. 결과물 `apps/web/public/og-landing.png`는 1200×630, 135,549 bytes이다. 렌더 명령은 HTML 주석에 있다. `--dump-dom`으로 `data-pretendard="true"`(실제로 받은 Pretendard 면이 있음)를 확인했다. 설명 문장은 20px로 한 줄에 들어가 18px 축소는 일어나지 않았다. `home.html`에는 `og:image`(+width/height/type/alt), `twitter:card=summary_large_image`, `twitter:image`를 넣었다. |
| F | `vite.config.ts`에 `STATIC_HTML_PAGES = ['home.html','privacy.html','terms.html']`(globIgnores)와 denylist `/^\/(?:home|privacy|terms)\.html(?:[?#]|$)/`를 두었다. |

#### 계획과 다르게 구현한 점

- 자동 재생 직후 바로 만든 iframe에는 `playVideo`를 보내지 않는다(`autoplay=1&mute=1`이 이미 재생한다). 그 사이에 pauseVideo가 보류돼 있으면 playVideo로 바꿔 둔다.
- 우리가 보낸 pauseVideo가 이미 멈춘 플레이어로 가면 상태 알림이 오지 않는다. 그래서 마지막 상태가 2(일시정지)이면 `expectingPause`를 세우지 않는다. 그러지 않으면 다음 실제 사용자 일시정지를 놓친다.
- 그룹이 멈춘 경우에도 `expectingPause`를 세운다. 그룹 일시정지를 사용자 일시정지로 잘못 기록하지 않게 하기 위해서다.
- 동작 줄이기 상태에서도 화면을 벗어나면 일시정지한다. 다시 들어왔을 때 이어 재생하지는 않는다(자동 재생으로 보기 때문이다). 클릭으로 재생한 영상도 같은 규칙을 따른다.
- 화면 가운데에 오는 순간 facade를 iframe으로 바꾸는 일은 effect가 아니라 렌더 중 state 조정으로 처리한다(`react-hooks/set-state-in-effect` 규칙). 명령과 claim은 `useEffectEvent`(React 19.2)로 보낸다.

#### 브라우저 확인(프로덕션 빌드, Render 흉내 서버 :5199, 확인 뒤 종료)

- 구조: H2 6개(마지막 "홈 화면에 추가하는 방법"). `main`의 마지막 자식은 `#install`이다. `#video`의 버튼은 1개(사용 방법)다. 두 maxres 썸네일 모두 1280×720으로 실재한다. 아이콘 currentSrc는 40/80 WebP다. Footer 링크 두 개의 히트 영역은 각각 89.97×44, 44.98×44다.
- 포커스(실제 Tab, 375/820/1180/1440): 장식 span이 img 뒤에 있다. `box-shadow` inset 4px `rgb(15,28,30)`, outline `solid 2px rgb(243,241,234) offset -8px`가 썸네일 위에 보인다.
- 자동 재생(1440×900, 실제 YouTube 상태 메시지 기준):
  - 가운데 → `mute=1` iframe, 상태 1, 포커스는 BODY에 그대로다.
  - 맨 위 → 상태 2.
  - 다시 가운데 → 상태 1.
  - 맨 아래 → Install 상태 1, Video 상태 2.
  - Video에 playVideo를 직접 보냄 → Video 1, Install 2(그룹 동작).
- 820×1180 맨 아래: Install 영상은 top 620 / 가운데 590이라 가운데 선에 닿지 않는다. 그래도 보이는 비율 1.0이라 상태 1로 재생된다(0.9 규칙).
- SW(제어 상태 확인 뒤):
  - `/login`, `/some/spa/route` → `fromServiceWorker: true`(대조군).
  - `/privacy.html`, `/privacy.html?v=2`, `/terms.html`, `/terms.html#section-3`, `/home.html?ref=kakao` → `fromServiceWorker: false`, 서버 문서가 그대로 온다.
  - precache에 세 HTML이 없다. (대역 페이지가 없을 때 로컬 에뮬레이션 서버는 SPA 404 화면을 냈지만, 운영 Render는 text/plain 404다 — 위 "법적 고지" 정정 참고.)

#### 오너 확인 남은 항목

- `2RgyXWjlH9I` 영상 내용과 "홈 화면에 추가하는 방법" 제목이 맞는지 확인하고, 썸네일의 타사 표기 "IDEAi+"(D2-5)를 처리한다. YouTube 커스텀 썸네일로 바꾸는 것을 권장한다.
- 글자 없는 앱 아이콘을 줄 수 있으면 주고, `public/privacy.html`·`public/terms.html`을 올린다. 개인정보처리방침에 YouTube(썸네일·스크롤 시 iframe 요청, D2-6)를 적는다.

### 14.7 Round 2 사후 검수(design-agent, 2026-10-26)

- 방법
  - QA가 쓰는 `dist`를 건드리지 않으려고, 빌드를 scratchpad 경로(`--outDir`)로 따로 만들었다. 이 빌드를 `vite preview --port 5199`로 띄웠고, 검수가 끝난 뒤 종료했다.
  - headless Chrome에서 375×812, 820×1180, 1180×820, 1440×900(DPR 2) 네 가지를 측정했다.
  - facade 화면을 고정해 캡처하려고 `prefers-reduced-motion: reduce`를 켰다. 이 상태에서는 자동 재생이 막힌다.
  - 실제 Tab 키로 포커스를 옮기며 캡처했다.

#### 판정: **PASS with minor**(BLOCKER 0 · HIGH 0 · MEDIUM 0 · LOW 3)

| 항목 | 결과 |
|---|---|
| Install 셸 | `#video`와 `#install` 안쪽 클래스가 같다(`LANDING_DARK_BAND_INNER`). padding은 56/56(1024 미만), 76/76(1024 이상)이고 gap 28, max-w 1000이다. 순서는 `top > why > how > video > demo > start > install > footer`이고, H2 6개 가운데 마지막이 "홈 화면에 추가하는 방법"이다. eyebrow, H2, subtitle 문구는 §14.1과 같다. |
| 간격 | CTA 카드 아래의 밝은 띠(88)와 어두운 Install 띠, Footer hairline이 1440과 375 모두에서 자연스럽게 이어진다. Install 높이는 375에서 454, 820에서 684, 1180과 1440에서 840이다. |
| 썸네일 | 4개 폭 모두 두 영상의 `maxresdefault`(1280w)를 불러왔다. 버튼 radius 22는 `rounded-[inherit]`가 적용된 결과다. |
| 캡션 pill | `bg-landing-brand-deeper/80` 위에 `label/on-deep` 글자다. 높이는 28이다. 밝은 썸네일(1번)에서도 또렷하다. §14.2 측정 기준으로 최소 8.16:1이다. |
| 재생 아이콘 ring | `ring-4 ring-landing-brand-deeper/80`이 밝은 UI 위에서 원의 윤곽을 만든다. 375와 1440 캡처에서 확인했다. |
| 포커스 span | 두 facade 모두 마지막 자식 span(`aria-hidden="true"`)이 DOM 순서상 `img` 뒤에 있다. 실제 Tab 포커스에서 어두운 4px ring과 그 안쪽 밝은 2px outline이 썸네일 **위에** 그려진다. 4개 폭 모두 캡처로 확인했다. §14.0 BLOCKER는 해결되었다. |
| 오너 아이콘 | Nav는 40px(radius 11), Why는 30px(radius 8)이고, 같은 80px WebP를 쓴다(data URI). 구워진 "수풀잉" 글자는 없다. 테두리 잔선은 L-12에 적었다. |
| OG | 1200×630, 135,549 bytes. §14.4 배치(로고 카드 460 at 676/85, 배지·H1·설명 한 줄)와 같다. 그림자를 포함한 콘텐츠 범위가 y 81~587로 안전 영역(15~615) 안에 들어 있다. `og-landing.html`에 raw hex와 rgb가 0건이고, 색, 모서리, 그림자, 글꼴은 모두 토큰 변수다. 메타 7개(og:image, width, height, type, alt, twitter:card, twitter:image)를 확인했다. |
| Footer 링크 | `/privacy.html`과 `/terms.html`을 같은 탭에서 연다. 보이는 크기는 90×18과 45×18이고 히트 영역은 90×44와 45×44다. 둘이 겹치지 않는다. 글자색은 `label/ink`(Footer 텍스트와 같음, 밑줄 없음)이고, 포커스 링은 `brand/deep` 2px에 offset 2px다. 4개 폭에서 확인했다. |
| 가로 overflow | 4개 폭 모두 clip을 해제해도 `scrollWidth == clientWidth`다. |
| 토큰 | `features/landing/*`와 `shared/ui/video-embed/*`에 raw hex와 rgb가 0건이다. 새로 생긴 임의 값은 계획에 있는 `outline-offset-[-8px]`과 `rounded-[inherit]`(키워드)뿐이다. |

#### LOW

| ID | 파일 | 근거 | 권장 수정 |
|---|---|---|---|
| L-12 | `assets/landing/app-icon-40.webp`, `app-icon-80.webp` | crop 시작선 y 4에 원본 청록 테두리가 **두 줄**(원본 y 4~5, `#9fc6cc`) 걸린다. 80px 결과물에서 0~1행이 청록색이다. 화면에서는 Nav 40px에서 약 0.7 CSS px, Why 30px에서 약 1 device px 두께로 아이콘 윗변에 옅은 청록 선이 남는다. §14.6에 적힌 "약 0.4px라 보이지 않는다"는 과소평가다. | 원본에서 **x 31~137, y 7~113(106×106)**으로 다시 자른다. y 6은 아직 청록과 흰색이 섞인 행이고, 글자 띠는 y 114부터 시작한다. 이 영역으로 40/80 WebP를 다시 만든다. 코드는 바꿀 필요가 없다. |
| L-13 | `features/landing/SectionHeader.tsx`(subtitle `<p>`) | 375에서 Install subtitle이 "…추가하면 앱처럼 / **열려요.**"로 끊긴다. Video subtitle도 같은 구조다. | subtitle `<p>`에 `text-balance`를 준다. H2와 Step h3는 이미 같은 처리를 하고 있다. |
| L-14 | `features/landing/LandingFooter.tsx`(링크 클래스) | 포커스 링이 글자에 바로 붙어 offset의 흰 띠가 글자 끝과 겹친다. Nav 링크도 같은 패턴이다. 기능에는 문제가 없다. | 링크에 `px-1 -mx-1`을 준다. 보이는 위치는 그대로 두고 링과 글자 사이에 여백만 생긴다. Nav 링크에도 같게 적용할지는 선택이다. |

#### 오너 확인(디자인 범위 밖, §14.6과 같음)

- 설치 영상의 썸네일에 타사 표기 "IDEAi+"가 있다. 영상 내용과 "홈 화면에 추가하는 방법"이 맞는지 확인이 필요하다.
- 1번 썸네일 오른쪽 위에 **이전 앱 아이콘(글자 포함)**이 보인다. 오너가 YouTube 썸네일을 새로 만들 때 함께 바꾸기를 권장한다.

---

## 15. Stage QA (round 2)(stage-qa-agent, 2026-10-26)

대상: 6849c94 위의 커밋 전 변경(Round 2: 썸네일, 가운데 자동 재생·일시정지, 한 번에 하나만 재생, Install 하단 이동, OG 이미지, 오너 아이콘, 푸터 법적 링크, SW denylist/globIgnores 일반화). 계획 `.omc/plans/landing-round2.md`, 구현 기록 §14.6. 제품 코드는 고치지 않았다. 변이 시험 뒤 제품 파일 해시와 `git diff`가 시험 전과 같다(이 문서만 다른 에이전트의 추가로 달라졌다).

### 15.1 판정: **STAGE CONDITIONAL PASS — FIX REQUIRED**(BLOCKER 0 · HIGH 0 · MEDIUM 2 · LOW 8)

동작은 실제 브라우저에서 요구대로 확인했다. 막는 것은 **오너가 말한 규칙을 지키는 자동 테스트의 공백**(MEDIUM 2)뿐이고, 제품 코드 수정은 필요 없다.

### 15.2 게이트(저장소 루트)

| 단계 | 결과 |
|---|---|
| typecheck | 0 |
| lint | 0 |
| test | **첫 실행과 §7.18.4 재실행 1회가 모두 실패**했고 세 번째에 통과했다. 1회차: web 123/125 파일(`figuresChatStep.integration` 5초 타임아웃·`waitFor`, `MyPage.figures` 5초 타임아웃), 2회차: 같은 두 파일(MyPage.figures는 다른 케이스). 둘 다 diff 밖이고 JSXGraph 지연 로딩 테스트다. 실패 시 기계 부하는 load 13~65(OneDrive File Provider·다른 프로젝트 Playwright가 CPU 점유). 두 파일 단독 3회 연속 통과(load 146 중에도), load 8에서 시작한 3회차 전체 실행 통과(api 71/1,045, web 125 파일/1,331). 규칙상 "첫 실행 0"은 충족하지 못했고 재실행 한도(1회)도 넘었다. 환경 부하로 판정하되 근거는 이 표다 |
| build | 0. precache 11개, `main-*.js` 576.01kB·`global-*.js` 400.50kB는 Round 1과 바이트 수가 같아 랜딩 코드가 앱 번들에 섞이지 않았다. `sw.js`에 `home/privacy/terms.html` precache 항목 없음, denylist `/^\/(?:home|privacy|terms)\.html(?:[?#]|$)/`. `dist/og-landing.png` 포함 |

### 15.3 요구사항별 결과(브라우저는 Chromium 헤드리스, 실제 YouTube 응답, Render rewrite 에뮬레이션 서버 5198)

| 요구 | 결과 | 증거 |
|---|---|---|
| 로드 시 썸네일 | PASS | 로드 직후 iframe 0개, `i.ytimg.com` maxres 2건(둘 다 1280×720), youtube(nocookie) 요청 0건 |
| 가운데 자동 재생(음소거) | PASS | 가운데 도달 → iframe `…&enablejsapi=1&origin=http%3A%2F%2Flocalhost%3A5198&mute=1`, 플레이어 상태 1, `document.activeElement`는 BODY |
| 벗어나면 일시정지, 히스테리시스 | PASS | 가운데 상태 1 → 50% 보임 상태 1 유지 → 10% 보임 상태 2 → 다시 50%에서도 상태 2 유지 → 가운데 복귀 상태 1 |
| 한 번에 하나만 | PASS | 맨 아래로 이동 시 Install 1·Video 2. Install 재생 중 Video에 `playVideo`를 보내면 Video 1·Install 2(그룹) |
| 사용자 일시정지 후 자동 재개 없음 | PASS | 화면 안에서 외부 `pauseVideo` → 상태 2, 위로 갔다 돌아와도 2 유지. 다시 재생시키면(상태 1) 이후 이탈·복귀에서 자동 재개됨 |
| 동작 줄이기, 데이터 절약 | PASS | 둘 다 스크롤해도 iframe 0개. 클릭하면 `mute=1` 없는 iframe이 생기고 포커스가 iframe으로 이동 |
| 자동 재생은 포커스를 옮기지 않음 | PASS | 자동 재생 두 경우 모두 `activeElement` = BODY |
| Install이 페이지 맨 아래, 푸터 위 | PASS | DOM 순서 CTA → `#install` → footer(변이 L3이 잡음). H2 6개. `#video`에는 사용 방법 영상만 |
| 막힌 지점 배지 불변 | PASS | `DemoSection`/`LandingBadge` 변경 없음(git status에 없음) |
| OG | PASS | `og-landing.png` 1200×630 PNG 135,549B, `og:image`는 절대 URL, width/height/type/alt, `twitter:card=summary_large_image`, `twitter:image`. 이미지를 직접 열어 확인(제목·로고 카드, 잘림 없음) |
| 오너 아이콘 | PASS | Nav와 Why가 `app-icon-40/80.webp` srcset을 쓴다. `app-icon-120.webp` 삭제, 코드 참조 없음(테스트에서 부재 단언) |
| 푸터 링크 | PASS | `/privacy.html`, `/terms.html`, 같은 탭. 클릭 시 해당 문서로 이동 |
| SW denylist·globIgnores | PASS | SW 활성 상태에서 `/privacy.html`, `/privacy.html?x`, `/terms.html`, `/terms.html#y`, `/terms.html?a=1#y`, `/home.html`, `/home.html?ref=kakao`, `/home.html#video` 모두 `fromServiceWorker=false`로 서버 문서가 온다(대역 페이지 사용). `/login`, 없는 경로, `/privacy`, `/privacy.html/`는 SW가 SPA로 응답(기존 동작). precache의 html은 `index.html` 하나 |

### 15.4 보안

- `postMessage`는 `youTubePlayerMessages.ts` 한 곳에서만 호출하고 targetOrigin은 항상 `https://www.youtube-nocookie.com`이다(`*` 없음, 변이 S1이 잡음). 수신은 `event.origin`, `iframe` 존재, `event.source === iframe.contentWindow`를 모두 확인하고 파싱 오류는 무시한다(변이 S2, S3, S3b 모두 잡음).
- 도메인은 nocookie 유지(변이 S4가 9개 테스트 실패), `origin` 파라미터는 `encodeURIComponent(window.location.origin)`(S5a/b/d 모두 잡음), `enablejsapi=1`(S5c 잡음). `allow`, `referrerpolicy`, `allowFullScreen` 유지.
- 새 의존성 없음, 비밀값·`dangerouslySetInnerHTML`·`console`·`eslint-disable` 0건. `shared/ui/video-embed`는 랜딩 토큰을 알지 못한다.
- 개인정보: 이제 **클릭 전에도** `i.ytimg.com`(Google)으로 썸네일 요청이 나간다(D2-6, 오너 수용). 방침 문서에 YouTube 항목이 있어야 한다.

### 15.5 변이 시험(제품 파일 백업 → 변이 → `video-embed`·`lib/dom`·`pages/landing`·`app/landing` 테스트 → 복원)

잡힘(대표): 가운데 rootMargin 변경, 재생 비율 0.9를 1.1·0.5로, 비율 분기 제거, 일시정지 비율 0.25→0.05, 사용자 일시정지 재개 방지 제거·기록 제거, 그룹 claim 무동작, 클릭 claim 제거, 이탈 시 pause 제거, 자동 재생 음소거 제거, 포커스(자동 재생이 포커스 이동 / 클릭이 포커스 안 옮김), 동작 줄이기·데이터 절약·IntersectionObserver 가드 제거, 썸네일(오류 무시·자리표시 폭 검사 제거·fallback 후보 제거·maxres/hq 바꿈·URL 오류), denylist 3종과 해시 분기, STATIC_HTML_PAGES의 privacy·terms 제거, spread 제거, 푸터 두 href, Install 순서, Install 영상 id, 아이콘 srcset, `og:image` 상대경로·`twitter:card`·width·`twitter:image`·type, PNG IHDR 폭 1바이트 변경.

**살아남음(테스트 공백)**

| ID | 변이 | 의미 |
|---|---|---|
| T-1 | `autoplayOnView`를 **Install에서 제거**, **Video에서 제거** | 랜딩 두 영상의 자동 재생 연결을 보는 테스트가 없다. 오너 핵심 기능이 조용히 꺼질 수 있다 |
| T-2 | `LandingPage`에서 `YouTubePlaybackGroup` 제거 | 랜딩의 "한 번에 하나만"이 통째로 빠져도 통과 |
| T-3 | 일시정지 비율 0.25→0.5, 히스테리시스 제거(`ratio !== null`만) | 25~90% 구간 "재생 중이면 유지" 테스트가 없다(현 테스트는 facade 상태에서 iframe이 안 생기는 것만 본다) |
| T-4 | `centerHit` 제거(`shouldPlay`가 비율 분기만) | 가운데 선 규칙을 비율 1과 따로 시험하지 않는다(`enterCenter`가 항상 비율 1을 같이 보낸다) |
| T-5 | 그룹 claim이 **자기 자신도** 멈춤 | 그룹 테스트가 A가 멈추는 것만 보고 B가 멈추지 않는 것은 안 본다 |
| T-6 | `thumbnailFallbackSrc`를 랜딩에서 전달하지 않음 | 랜딩의 hq fallback 연결 무테스트 |
| T-7 | "재생 상태 1일 때 claim", "구역 진입 시 claim" 제거, 이탈 중 일시정지도 사용자 일시정지로 기록 | 다른 경로가 같은 효과를 내거나 경계 사례. 낮은 위험 |

위 공백의 실제 동작은 15.3의 브라우저 시험으로 확인했으므로 **현재 제품 동작은 맞다**. 문제는 이후 수정이 조용히 깨뜨릴 때 잡히지 않는다는 점이다.

### 15.6 이슈

**MEDIUM**

| ID | 내용 | 필요한 수정(테스트만) |
|---|---|---|
| M-R2-1 | T-1, T-2, T-6: 랜딩 연결 테스트 공백 | `LandingPage.test`에서 IntersectionObserver를 스텁하고, Video·Install 두 영상이 각각 가운데 진입 시 iframe(`mute=1`)을 만드는지, 한쪽 재생 시 다른 쪽에 pauseVideo가 가는지, 썸네일 오류 시 hq로 바뀌는지 단언 |
| M-R2-2 | T-3, T-4, T-5: 재생 규칙 테스트 공백 | `YouTubeEmbed.test`에 ① 재생 중 비율 0.5에서 pauseVideo가 가지 않음 ② 0.1이면 감 ③ 가운데만 닿고 비율 0.5일 때 재생 ④ claim 뒤 claim한 영상에 pauseVideo가 가지 않음을 추가 |

**LOW**

| ID | 내용 |
|---|---|
| L-R2-1 | 게이트 환경 불안정(15.2). 도형 지연 로딩 테스트 2개(`figuresChatStep.integration`, `MyPage.figures`)가 부하 13 이상에서 연속 실패했다. Round 1에서도 같은 파일이 한 번 실패했다. 랜딩 diff와 무관하지만 반복되므로 후속에서 타임아웃 여유나 병렬 수를 검토할 만하다 |
| L-R2-2 | 운영 도메인 확인(읽기 요청): `/privacy.html`, `/terms.html`, `/home.html`, `/og-landing.png`가 모두 **text/plain 404**다(미배포). §14.6과 계획은 "SPA 404 화면"이라고 적었지만 Render는 없는 `.html`에 rewrite를 하지 않고 일반 404를 돌려준다. 법적 페이지를 올리기 전에 푸터를 공개하면 사용자는 빈 "Not Found"를 본다. **공개 전 두 페이지 업로드 필수** |
| L-R2-3 | 카카오톡·페이스북은 OG 이미지를 캐시한다. 배포 직후 미리보기가 안 나오면 각 서비스의 캐시 초기화 도구를 쓴다 |
| L-R2-4 | `expectingPause`: 이미 재생 중이 아닌 상태(버퍼링 등)의 플레이어에 `pauseVideo`를 보내면 일시정지 알림이 안 와서 플래그가 남고, 이후 진짜 사용자 일시정지 한 번을 놓칠 수 있다(구현은 마지막 상태가 2인 경우만 예외 처리). 최악의 결과는 자동 재개 한 번 |
| L-R2-5 | iframe `load` 시점에 `playerReady=true`로 보고 보류 명령을 보낸다. onReady 전에 보낸 pause는 플레이어가 무시할 수 있다(undocumented 채널, 계획 위험 항목) |
| L-R2-6 | 맨 아래 Install 영상이 90% 규칙으로 재생되는 것은 1440×900에서만 확인했다. 820×1180은 §14.6 개발 측 확인에 의존 |
| L-R2-7 | `Install` 영상 썸네일의 타사 표기(IDEAi+)와 영상 내용 일치 여부는 오너 확인 항목이다(D2-5) |
| L-R2-8 | 앱 아이콘은 168px 원본의 crop이다. 글자 없는 원본을 받으면 두 파일만 교체 |

### 15.7 NOT VERIFIED

- 실제 iPad Safari의 음소거 자동 재생, IntersectionObserver 가운데 선 동작, iOS 저전력 모드: NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED(WebKit 헤드리스는 구조 확인에만 썼고 YouTube 자동 재생 시험은 하지 않았다)
- 카카오톡·페이스북·X의 OG 미리보기 렌더(미배포)
- 운영 도메인의 `/home.html`, `/privacy.html`, `/terms.html`, `/og-landing.png`(미배포·미업로드)
- 썸네일 위 캡션 pill 대비와 포커스 링의 시각 판정(design-agent 범위)

### 15.8 다음 단계 전 필수 수정

1. M-R2-1, M-R2-2: 위 테스트 추가(제품 코드 변경 없음). 재검증은 해당 변이(T-1~T-6) 재시험이면 충분하다.
2. 공개 전: `public/privacy.html`, `public/terms.html` 업로드(L-R2-2), 방침에 YouTube 항목 포함.

### 15.9 수정 반영(development-agent, 2026-10-26)

- **M-R2-1:** `LandingPage.test`에 IntersectionObserver 대역을 넣었다(공용 `src/test/youTubeTestUtils.ts`, 대상별 조종 `controlsFor`). 다음을 단언한다.
  - Video·Install 각각 관찰자 2개가 있고, 가운데 진입 시 `mute=1` iframe이 생긴다.
  - Install이 재생을 시작하면, 화면을 벗어나지 않은 Video에 pauseVideo가 간다.
  - 두 영상 모두 maxres 오류 시 hq로 바뀐다.
- **M-R2-2:** `YouTubeEmbed.test`에 다음을 추가했다.
  - 재생 중 비율 0.5와 경계값 0.25에서는 pauseVideo가 없고, 0.1에서는 보낸다.
  - 비율 0.5에 가운데 선만 닿아도 재생한다.
  - claim한 영상 자신에게는 pauseVideo가 가지 않는다.
- **변이 재시험:** T-1a/1b, T-2, T-3a(0.25→0.5)/3b(히스테리시스 제거), T-4, T-5, T-6과 아래 두 수정의 역변이 M-7, M-8, 모두 10/10을 잡았다. 처음에는 T-3a를 놓쳤는데(0.5에서 `0.5 < 0.5`가 거짓), 0.25 경계 단언을 더해 잡았다. 변이는 모두 복원했다.
- **L-R2-4:** 우리가 보낸 pauseVideo의 일시정지 알림을 2초(`EXPECTED_PAUSE_WINDOW_MS`)만 기다린다. 시간이 지나면 `expectingPause`가 풀린다. 재생 상태 알림이 와도 풀린다.
- **L-R2-5:** iframe `load`는 더 이상 준비 신호가 아니다.
  - 준비는 onReady 또는 상태 알림(플레이어가 이미 듣고 있음)으로 판단한다.
  - 보류 명령은 준비될 때 보내고 비운다.
  - `load` 때는 보류 중인 `playVideo`만 미리 보낸다(onReady가 안 오는 환경 대비). 준비되면 한 번 더 보낸다.
- **L-R2-6:** 프로덕션 빌드 실기 재확인(Chrome, 실제 YouTube 상태 메시지).
  - 820×1180 맨 아래에서 Install 영상은 top 620 / 가운데 590이라 가운데 선에 닿지 않는다. 그래도 보이는 비율 1.0으로 상태 1(재생)이다.
  - 1440×900에서 가운데 재생, 맨 위 일시정지, 다시 재생, Install 재생 시 Video 일시정지, 그룹 동작 모두 L-R2-5 수정 뒤에도 그대로다.
- **L-12:** x 31~137, y 7~113(106×106)으로 다시 잘라 `app-icon-40.webp`·`app-icon-80.webp`를 다시 만들었다. 윗변 가운데는 흰색이다. 네 귀퉁이 몇 픽셀만 원본 둥근 테두리에 걸리는데, CSS radius가 잘라 낸다.
- **L-13:** SectionHeader subtitle에 `text-balance`를 주었다. 375에서 "열려요."만 한 줄에 남던 줄바꿈이 두 줄로 고르게 나뉜다.
- **L-14:** Footer 법적 링크에 `-mx-1 px-1`을 주었다. 히트 영역은 97.97×44, 52.98×44다.
- **법적 페이지 404 정정:** §14.6 "법적 고지" 항목을 운영 기준(text/plain 404, 공개 전 업로드 필수)으로 고쳤다.

### 15.10 재검증(stage-qa-agent, 2026-10-26, §15.9 수정 반영 뒤)

**판정: STAGE CONDITIONAL PASS — FIX REQUIRED**(BLOCKER 0 · HIGH 0 · MEDIUM 1 · LOW 이월 + 신규). Round 2 MEDIUM 2건(M-R2-1, M-R2-2)은 **해결**됐고 동작도 실제 브라우저에서 그대로다. 새로 도입한 L-R2-5 로직에서 같은 종류의 테스트 공백 1건이 남았다(제품 코드 수정 불필요).

| 항목 | 결과 |
|---|---|
| 게이트 | 첫 실행에서 전부 0. typecheck 0, lint 0, test 0(api 71/1,045, web 125 파일/1,340, load 56 중에도 통과), build 0(precache 11, 랜딩 세 HTML 항목 없음, denylist 유지, `main-*.js` 576.01kB·`global-*.js` 400.50kB 불변) |
| T-1 ~ T-6 독립 재시험 | 전부 잡힘: T-1a/b(두 영상 `autoplayOnView` 제거), T-2(`YouTubePlaybackGroup` 제거), T-3a(0.25→0.5)·3b(히스테리시스 제거)·3c(0.25→0.1), T-4(`centerHit` 제거), T-5(claim이 자신도 멈춤), T-6(landing hq fallback 미전달). T-7b(진입 시 claim)도 이번에는 잡힘 |
| 복원 | 변이 34개 시험 뒤 변경·untracked 파일 해시와 `git diff`가 시험 전과 동일 |
| 실기기 아님 · 라이브 점검(Chromium, 실제 YouTube 상태, 5198) | 1440×900과 820×1180 모두 같은 결과. 로드 시 iframe 0 → 가운데 도달 `mute=1`·상태 1·포커스 BODY → 맨 위 상태 2 → 다시 가운데 상태 1 → 맨 아래 Install 1·Video 2 → Video에 `playVideo`를 보내면 Video 1·Install 2. 820×1180 맨 아래에서도 Install 재생(90% 규칙) 확인. 히스테리시스(가운데 1 → 50% 1 → 10% 2 → 50% 2 유지 → 가운데 1)와 사용자 일시정지 후 자동 재개 없음(재생 후 재개 복구)도 그대로 |

**L-R2-4 / L-R2-5 변이 결과**: 잡힘 — 창 타이머 제거, 창 3,600,000ms, load가 곧 준비(옛 동작), load 때 보류 pause 전송, 상태 메시지가 준비로 인정 안 됨, ready 메시지가 준비로 인정 안 됨, 준비 시 보류 명령 버림, 보류 명령 미저장.

| ID | 내용 |
|---|---|
| **M-R3-1 (MEDIUM)** | 생존: **`postListening` 호출 삭제(L5j)**. L-R2-5로 준비 판단이 onReady·상태 메시지에만 의존하게 되어 `listening`을 안 보내면 YouTube가 아무 메시지도 안 보내 보류 pause가 영영 안 나간다(영상이 화면을 벗어나도 안 멈춤). 이전에는 load 폴백이 가려 줬다. 같은 구역의 생존: 로드 후 요청된 pause를 곧바로 보내는 변이(L5g, 정확히 L-R2-5가 막으려던 동작), load 때 playVideo 미리 보내기 제거(L5h). 수정(테스트만): iframe `load` 때 nocookie targetOrigin으로 `{event:"listening",channel:"widget"}`가 간다, load 직후·준비 전 `pauseVideo`는 전송되지 않고 첫 상태 메시지 뒤에 나간다, 준비 전 보류 `playVideo`는 load 때 먼저 간다 |
| LOW | 생존(L-R2-4 쪽): 창 1ms로 줄여도 통과(조기 만료 경계 미시험), 재생 상태·일시정지 알림이 플래그를 푸는 경로(L4d/e), 이미 멈춘 플레이어는 플래그 안 세움(L4f), 플래그 자체를 안 세워도 통과(L4g — 그룹이 멈춘 영상이 화면 안에 남아 있을 때 사용자 일시정지로 오인되어 자동 재개가 안 되는 경우), 언마운트 타이머 해제(L4h). 영향은 자동 재개 한 번 놓치는 정도. 보류 명령 비우기 누락(L5f)도 생존 |
| LOW(이월) | L-R2-1 게이트 환경 부하(이번엔 재현 없음), L-R2-2 운영 404·법적 페이지 업로드, L-R2-3 OG 캐시, L-R2-7·8 오너 확인. 새 가설: 화면을 막 벗어난 영상의 늦은 "재생" 알림이 claim으로 이미 재생 중인 다른 영상을 멈출 수 있는 경합(빠른 스크롤, 미재현) |

NOT VERIFIED: 실제 iPad Safari·iOS 저전력 모드(PHYSICAL DEVICE TEST REQUIRED), 운영 배포 후 `/home.html`·`/privacy.html`·`/terms.html`·`/og-landing.png`, OG 미리보기 렌더, 디자인 L-12/13/14의 시각 판정(design-agent).

**다음 단계 전 필수**: M-R3-1 테스트 추가. 재검증은 변이 L5g, L5h, L5j 재시험이면 충분하다. 공개 전에는 법적 두 페이지 업로드(L-R2-2)가 여전히 필요하다.

### 15.11 M-R3-1 수정 반영(development-agent, 2026-10-26)

- 테스트만 추가했다(`YouTubeEmbed.test.tsx`, 7건). 제품 코드는 바꾸지 않았다.
  1. iframe load 때 nocookie targetOrigin으로 `{event:"listening", id(비어 있지 않은 문자열), channel:"widget"}`를 한 번 보낸다.
  2. load 뒤·준비 전 `pauseVideo`는 보내지 않는다. 첫 onReady 때 정확히 한 번 가고, 이후 onReady·상태 메시지로는 다시 가지 않는다.
  3. 상태 메시지(첫 알림)도 준비 신호라서, 보류된 `pauseVideo`가 한 번 간다.
  4. load 뒤·준비 전 `playVideo`는 미리 간다.
  5. 준비 때 보류 명령을 비운다. 그 뒤 onReady, 상태 메시지, iframe `load` 재발생이 와도 다시 보내지 않는다.
  6. L4g: 그룹이 멈춘 영상이 화면 안에 있는 동안 받은 일시정지 알림은 사용자 일시정지로 기록되지 않는다. 다시 화면에 들어오면 playVideo가 간다.
  7. L4h: 일시정지 대기 타이머가 언마운트 때 해제된다(fake timer 개수 1 → 0).
- 변이 재시험(백업 → 변이 → video-embed·lib/dom·pages/landing·app/landing 테스트 → 복원). 모두 잡았다.
  - L5j(`postListening` 삭제)
  - L5g(준비 전 pause 즉시 전송)
  - L5h-a(load 때 보류 playVideo 제거)
  - L5h-b(load 뒤 playVideo 미리 전송 제거)
  - L5f(준비 때 보류 비우기 누락)
  - L4g(플래그 미설정)
  - L4h(언마운트 해제 누락)
  - L5f는 `markPlayerReady`가 이미 준비됐으면 바로 돌아오기 때문에 "다음 준비 메시지"로는 드러나지 않는다. 남은 보류 명령은 iframe `load`가 다시 올 때 다시 보내지므로, 그 경로로 단언한다.
- 복원 뒤 대상 테스트는 89/89다.

### 15.12 최종 재검증(stage-qa-agent, 2026-10-26, §15.11 M-R3-1 수정 뒤)

**최종 판정: STAGE PASS — READY FOR NEXT STAGE**(BLOCKER 0 · HIGH 0 · MEDIUM 0 · LOW 이월). M-R3-1은 해결됐다. 제품 코드는 바뀌지 않았다(빌드 산출물 해시 `main-DQYVuLwG`, `global-OH8_r4CV`가 직전 재검증과 같다).

| 항목 | 결과 |
|---|---|
| 독립 변이 재시험 | 잡힘: L5j(`postListening` 삭제), L5g(준비 전 pause 즉시 전송), L5h(load 뒤 playVideo 미리 전송 제거)와 L5h-b(load 때 보류 playVideo 전송 제거), L5f(준비 때 보류 비우기 누락), L4g(플래그 미설정), L4h(언마운트 타이머 해제 누락). 덤으로 L4a/L4b(창 타이머), L5a~L5e, L5i도 잡힘 |
| 복원 | 변이 19개 뒤 `git diff`와 변경·untracked 파일 해시 전부 동일 |
| 게이트 | 첫 실행 전부 0. typecheck 0, lint 0, test 0(api 71/1,045, web 125 파일/1,347), build 0(precache 11, main 576.01kB·global 400.50kB 불변) |

남은 LOW(차단 아님): L4c(창을 1ms로 줄여도 통과: 조기 만료 경계 미시험), L4d/L4e(재생·일시정지 알림이 플래그를 푸는 경로), L4f(이미 멈춘 플레이어는 플래그 안 세움). 영향은 자동 재개 한 번 놓치는 정도. 이월: L-R2-1 환경 부하, L-R2-2 운영 404·법적 페이지 업로드(공개 전 필수), L-R2-3 OG 캐시, L-R2-7·8 오너 확인, 막 벗어난 영상의 늦은 "재생" 알림 경합(미재현 가설).

NOT VERIFIED: 실제 iPad Safari·iOS 저전력 모드(PHYSICAL DEVICE TEST REQUIRED), 운영 배포 후 `/home.html`·`/privacy.html`·`/terms.html`·`/og-landing.png`와 OG 미리보기, 디자인 L-12/13/14 시각 판정(design-agent). 라이브 동작(자동 재생·일시정지·그룹·히스테리시스)은 직전 재검증(§15.10)에서 확인했고, 이후 제품 코드가 바뀌지 않았다.

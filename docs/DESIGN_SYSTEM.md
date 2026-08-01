# 왜수학 디자인 시스템

기준: Figma `WhyMath Design System` (`fileKey: ltyPrCk8UT8DsB3tFuw7Sr`). 2026-07-26에 Figma MCP(`get_variable_defs`, `get_metadata`, `get_screenshot`)로 6개 화면(로그인/학년선택/문제풀기/마이페이지/카메라 촬영·미리보기) 전체를 실측하여 작성했다. `references/claude-design`의 ZIP/`.dc.html` 자료는 대조용으로만 사용했으며, 값이 다를 경우 이 문서는 Figma 실측값을 채택한다.

## 1. 테마 확정

`references/claude-design` 참고 자료에는 두 가지 화면 세트가 있었다 — plain iOS 시스템 컬러(파랑 `#007AFF`) 버전과 "Math Bold-3D"(인디고 `#5E6E82`, pill 형태, 클레이 그림자) 버전. **Figma 실측 결과 6개 화면 전부 "Math Bold-3D" 테마로 확정되어 있다** (`brand/indigo: #5e6e82`, elevation 토큰들이 모든 화면에서 확인됨). Plain iOS 버전은 채택하지 않는다.

`components/math/*.jsx`(참고 ZIP)에 있던 대체 브랜드값 `#4F8285`(teal)도 Figma에는 없다 — 사용하지 않는다.

## 2. 색상 (Figma Variables, 실측)

### 2.1 Label (텍스트)
| 토큰 | 값 |
|---|---|
| `label/primary` | `#232b38` |
| `label/secondary` | `#3c3c4399` |
| `label/tertiary` | `#3c3c434d` |
| `label/quaternary` | `#3c3c432e` |
| `label/on-dark` | `#ffffff` |
| `label/on-dark-secondary` | `#ffffffb2` |

### 2.2 Background / Surface
| 토큰 | 값 | 비고 |
|---|---|---|
| `bg/primary` | `#eceae2` | 화면 배경 (캔버스톤) |
| `bg/canvas` | `#fbfaf6` | 카드/패널 표면 |
| `bg/elevated` | `#ffffff` | 입력 필드 등 |
| `bg/viewfinder` | `#2f3745` | 카메라 뷰파인더 배경 |
| `bg/camera-sheet` | `#232b38` | 카메라 상단바/시트 배경 |

### 2.3 Brand / Accent
| 토큰 | 값 |
|---|---|
| `brand/indigo` / `accent/primary` | `#5e6e82` |
| `accent/primary-deep` | `#46536a` |
| `accent/green` | `#6fa898` |
| `accent/purple` | `#9a93b0` |
| `accent/orange` | `#d9a05b` |
| `accent/yellow` | `#dcc08a` |

### 2.4 Fill / Separator / Glass
| 토큰 | 값 |
|---|---|
| `separator` | `#3c3c431f` |
| `fill/quaternary` | `#7676801f` |
| `fill/tint-blue` | `#5e6e8229` |
| `fill/tint-green` | `#6fa8982e` |
| `glass/fill` | `#fbfaf6f5` |
| `glass/border` | `#ffffffd9` |

### 2.5 소셜 로그인 (로그인 화면 전용)
| 토큰 | 값 |
|---|---|
| `kakao/yellow` | `#fee500` |
| `kakao/label` | `#191919` |

### 2.6 기타
| 토큰 | 값 | 비고 |
|---|---|---|
| `iConColor` | `#8a8a8e` | 아이콘 기본색 (Solve 화면) |

## 3. 타이포그래피 (SF Pro, Figma 실측)

| 스타일 | weight | size / lineHeight |
|---|---|---|
| Large Title | Bold 700 | 34 / 41 |
| Title 1 | Bold 700 | 28 / 34 |
| Title 2 | Bold 700 | 22 / 28 |
| Title 3 | Semibold 590 | 20 / 25 |
| Headline | Semibold 590 | 17 / 22 |
| Callout | Regular 400 | 16 / 21 |
| Subheadline | Regular 400 | 15 / 20 |
| Subheadline Semibold | Semibold 590 | 15 / 20 |
| Footnote | Regular 400 | 13 / 18 |
| Footnote Semibold | Semibold 590 | 13 / 18 |
| Caption 1 | Regular 400 | 12 / 16 |
| Caption 1 Semibold | Semibold 590 | 12 / 16 |
| Caption 2 | Regular 400 | 11 / 13 |

폰트: `"SF Pro", -apple-system, "Apple SD Gothic Neo", sans-serif` (한글 병기 필요, 참고 자료의 `fonts/SF-Pro.ttf` 사용 가능).

## 4. Elevation / Shadow (Figma 실측, 잉크 `#232B38` 계열로 일관)

| 토큰 | 레이어 구성 |
|---|---|
| `Elevation/Card` | drop-shadow(0,2,0) `#232B382E` + drop-shadow(0,7,13) `#232B381C` |
| `Elevation/Tab Pill` | 위 Card 2겹 + inner-shadow(0,2,0) `#FFFFFF99` |
| `Elevation/Photo Card` | drop-shadow(0,3,0) `#232B3829` + (0,10,20) `#232B3824` + (0,22,40) `#232B3817` |
| `Elevation/Floating Bar` | drop-shadow 3겹(`#232B3836`/`#232B3824`/`#232B3814`) + inner-shadow(0,2,0) `#FFFFFFE5` + inner-shadow(0,-2,0) `#232B3812` |
| `Elevation/Glass Panel` | drop-shadow 3겹(`#232B3836`/`#232B382E`/`#232B381A`) + inner-shadow 2겹 (위와 동일 패턴) |

이 값은 참고 ZIP의 `math-material.css`(`--math-shadow-ink: 35,43,56` = `#232B38`)와 일치한다 — 해당 파일의 elevation 로직을 참고해도 되지만, 정확한 레이어 수치는 위 Figma 실측값을 기준으로 한다.

## 5. Radius

Figma에서 실측 확인된 토큰: `radius/14` (카메라 화면, 값 `14`). 그 외 반경(카드 `28px`, 버튼 pill `100px` 등 참고 ZIP의 `math-material.css` 수치)은 이번 조사에서 Figma 변수로 직접 확인되지 않았다 — **결정 필요**: 화면별로 실제 사용된 모서리 반경을 컴포넌트 단위로 재확인해야 한다.

## 6. 다크 모드

v1에서는 다크 모드를 지원하지 않는다(2026-07-29 확정). `dark:` Tailwind variant를 사용하지 않고, 다크 모드 전용 토큰을 만들지 않으며, 시스템 다크 모드를 자동 적용하지 않는다. 전역 스타일에 `color-scheme: light`를 적용한다. (참고: 이번 조사에서도 Figma에 다크 모드 변수는 확인되지 않았다 — 6개 화면 모두 라이트 모드 상태로 조회됨. 참고 ZIP의 `colors-pastel.css`도 light/dark/dim이 전부 동일 값이었다.)

## 7. 결정 필요 목록 (종합)

1. Radius 전체 스케일 (버튼/카드/입력 등 컴포넌트별 실측 필요). 프로세스: raw 값 실측 → 반복값 식별 → `실측값/제안 토큰명/사용처` 표 작성 → 오너 승인 후 토큰화(2026-07-29 확정 프로세스).
2. Spacing 스케일 — 4/8px 격자 없음 확인됨(참고 ZIP readme), 화면별 실측 필요. Radius와 동일한 프로세스로 진행.
3. `Chat Bubble`, `Math Activity Card` 컴포넌트의 색상 토큰 — 최종 Variant 구현 보류(2026-07-29 확정), 대화 진행 상태 프레임이 화면맵에 추가되기 전까지 미착수.

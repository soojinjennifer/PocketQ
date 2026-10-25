# 수풀잉 도형 시각화 — 워크플로 상태 장부

`Prompt/15. Graph JSXGraph change.md`의 표준 에이전트 루프(plan-agent → design-agent(필요시) → development-agent → stage-qa-agent)를 Stage 단위로 기록한다. 대화가 끊겨도 이 문서만 보고 이어서 실행할 수 있어야 한다.

- 요구사항: `docs/PRD_WHYMATH.md` §4.12 (FIG)
- 데이터 계약: `docs/FIGURE_SPEC.md`
- 프로젝트 전체 현황: `docs/PROJECT_STATUS.md` §3.41, §5 "6.8 도형 시각화"

---

## 1. 현재 위치

| 항목 | 값 |
|---|---|
| 현재 Stage | Stage 5 — 저장·CHAT 연동과 통합 QA |
| 현재 역할 | stage-qa Stage 5 **재검증 완료**(§8.20, 2026-10-25) → 다음: development-agent 문서 보정(최종 보고 LOW 3건·FIGURE_DESIGN 348px 잔여) · 오너(마이그레이션 적용 후 실DB, 실기기) |
| 상태 | **STAGE CONDITIONAL PASS — FIX REQUIRED**(§8.20): 1차 지적 전부 해소 확인(MEDIUM-1·LOW-1·2·3·4·6·7·10·design P2·P3), 구현·테스트 미해소 0. 남음: 최종 보고 문서 사실 오류 3건(LOW)·실DB BLOCKED·실기기 NOT VERIFIED·이월 MEDIUM-2(CAS 순서쌍). 게이트 안·밖(.env 없음) 첫 실행 통과. 운영 플래그 4종 off 유지 |
| 재작업 | Stage 2: 1 / 3 (종료). Stage 3: 0 / 3 (종료). Stage 4: 1 / 3 (종료). Stage 5: **1 / 3** (재검증 통과, 문서 보정은 횟수에 넣지 않음) |
| 차단 요인 | 마이그레이션 적용(오너)·실기기(오너) — BLOCKED/NOT VERIFIED로 분리 |
| 다음 작업 | 문서 보정(§8.20.4·§8.20.5) → 오너: 마이그레이션 적용·실DB 확인·실기기 체크리스트 → 플래그 켜기(순서 `docs/DEPLOYMENT.md`) |

## 2. Stage 표

| Stage | 내용 | 루프 | design-agent | 상태 | 재작업 |
|---|---|---|---|---|---|
| 1 | 현황 분석과 데이터 계약 | plan → dev → stage-qa | 생략(UI 영향 없음) | **PASS** | 0/3 |
| 2 | 검증기와 고정 fixture 렌더링(JSXGraph 설치) | plan → design → dev → stage-qa | 실행(`docs/FIGURE_DESIGN.md`, 오너 승인) | **PASS**(design 재검수 PASS + stage-qa 재검증 PASS §4.6, 실기기 미확인) · 후속 정리 완료(§4.7) | 1/3 |
| 3 | 풀이 AI API 연결 | plan → dev → stage-qa (+design: 로딩·실패 UI 시) | 생략(화면 변경 없음, §6.3) | **PASS**(stage-qa §6.10, 실제 모델 보정 효과·텍스트 대표본은 이월 조건) | 0/3 |
| 4 | 단계별 표시와 iPad 대응 | plan → design → dev → stage-qa | 실행(`docs/FIGURE_DESIGN.md` §17, 오너 승인) | **PASS**(stage-qa 재검증 §7.18, 게이트 환경 플레이크 예외, 실기기 미확인) | 1/3 |
| 5 | 저장·CHAT 연동과 통합 QA | plan → design(필요시) → dev → stage-qa | 실행(`docs/FIGURE_DESIGN.md` §18 사전 검토, WU7용) | **조건부 PASS**(재검증 §8.20: 1차 지적 전부 해소, 최종 보고 문서 LOW 3건 보정·실DB BLOCKED·실기기 NOT VERIFIED 남음) | 1/3 |

## 3. Stage 1 기록

### 3.1 현황 분석 요약 (plan-agent 결과 + 구현 중 확인)

- **입력 → 풀이 흐름**: `POST /api/problems/recognize`(사진/필기 이미지 → 인식) → `POST /api/problems/:problemId/solve`(SSE `chunk`/`done`/`error`). 이어풀기는 `POST /api/problems/:problemId/resume`(SSE).
- **AI 공급자**: OpenAI 단일(`apps/api/src/infrastructure/ai/openai-adapter.ts`, Responses API, 모델은 `AI_MODEL`). 테스트·로컬은 `fake-adapter.ts`.
- **응답 형식**: 인식·진단·제안 등은 `json_schema` 구조화 출력. **풀이(solve)·이어풀기(resume)는 마크다운 자유 텍스트 스트리밍**이며 완료 후 `parseSolveOutput`/`parseResumeOutput`이 `## 풀이`/`## 이어풀기` 등 헤더로 섹션을 나눈다 → Stage 3에서 figures를 어떻게 받을지(별도 구조화 호출 vs 스트림 말미 블록) 결정이 필요하다.
- **CHAT 맥락**: `chat.router.ts`가 저장된 problem·solution과 클라이언트 history를 어댑터에 넘기는 stateless 구조.
- **저장·재조회**: `problemRepository.ts`가 Supabase `problems`/`solutions`/`chat_messages`에 upsert/insert, `GET /api/problems/:problemId`는 `problemHistoryDetailSchema`로 응답 파싱.
- **수학 검증 도구**: `services/cas`(FastAPI + SymPy, 내부 전용) 존재 — 대수 동치성 검사용. 기하 검증 기능은 없다.
- **필기 캔버스 이벤트**: Stage 4에서 상세 확인(이번 Stage는 UI 무변경).

### 3.2 변경 파일

| 파일 | 변경 |
|---|---|
| `packages/shared-types/src/index.ts` | Figure 타입 추가, `Solution`/`ResumeSolution`에 선택 필드 |
| `packages/validation/src/figures.ts` | 신규 — 스키마·상한·관대 파서·타입 단언 |
| `packages/validation/src/index.ts` | figures 재export, `solutionSchema`/`resumeSolutionSchema` 신설, `problemHistoryDetailSchema.solution` 선택 필드 |
| `packages/validation/src/figures/fixtures/{types,valid,invalid,legacy,index}.ts` | 신규 fixture |
| `apps/api/src/contracts/figureSpec.contract.test.ts` | 신규 계약 테스트 |
| `apps/api/src/config/env.ts`, `env.test.ts`, `apps/api/.env.example` | `FIGURES_ENABLED` 플래그(기본 off) |
| `apps/web/src/shared/api/problemHistory.test.ts`, `solveProblem.test.ts` | figures 보존/부재 케이스 추가(기존 단언 무수정) |
| `docs/FIGURE_SPEC.md`(신규), `docs/PRD_WHYMATH.md`(§4.12), `docs/PROJECT_STATUS.md`(§3.41, §5), `docs/FIGURES_WORKFLOW_STATE.md`(신규) | 문서 |

수정 금지 파일(diff 0이어야 함): `openai-adapter.ts`, `fake-adapter.ts`, `prompts/*`, `parseSolveOutput.ts`, `parseResumeOutput.ts`, 모든 `*.router.ts`, `problemRepository.ts`, `supabase/migrations/*`, `apps/web`의 UI·features.

### 3.3 수용 기준별 결과 (development-agent 자체 검증 — QA 판정 아님)

| AC | 내용 | 자체 결과 | 근거 |
|---|---|---|---|
| AC-1 | 타입 추가, 새 필드는 선택 | 통과 | shared-types 타입, `FigureSchemaTypeContract` 컴파일 단언, typecheck |
| AC-2 | F01~F09, F10a~c 스키마 통과 | 통과 | contract test "AC-2" |
| AC-3 | F10d~j 정확한 경로로 거부 | 통과 | contract test "AC-3"(path+code 단언) |
| AC-4 | 파생 요소 좌표 금지 | 통과 | contract test "AC-4" |
| AC-5 | 함수는 AST만 | 통과 | contract test "AC-5" |
| AC-6 | 상한·유한수 | 통과 | contract test "AC-6"(NaN/Infinity, 10,000단계 AST 포함) |
| AC-7 | 관대 파서 throw 없음 | 통과 | contract test "AC-7"(혼합·비배열·모르는 버전·getter 예외) |
| AC-8 | 하위 호환 | 통과 | contract test "AC-8"(L01~L03 deep-equal), web 테스트 |
| AC-9 | 플래그 기본 off | 통과 | `env.test.ts` |
| AC-10 | 실행 동작 불변 | 통과(자체) | 수정 금지 파일 `git diff` 0, 기존 테스트 전부 통과 |
| AC-11 | 문서 | 작성 | 위 문서 4종 |
| AC-12 | 게이트 | 통과 | 루트 `pnpm typecheck` → `lint` → `test` → `build` |

### 3.4 design-agent 생략 근거

Stage 1은 타입·스키마·fixture·테스트·플래그·문서만 추가하며 사용자 화면·상호작용·반응형에 영향이 없다(`apps/web`은 테스트 파일만 추가). `Prompt/15` §2.3의 실행 조건(패널·조작 UI·단계 표시·로딩/실패 상태·반응형·신규 컴포넌트) 중 해당 항목이 없다.

### 3.5 QA 판정

- 판정: **PASS** (stage-qa-agent, 2026-10-24, 재작업 0/3). FAIL 항목 없음. 아래 LOW 이슈는 Stage 2 이전/중 처리 권장이며 Stage 2 진행을 막지 않는다.
- 실행한 검사
  - 저장소 루트 `pnpm typecheck` → `lint` → `test` → `build` 전부 exit 0 (api 45 파일/428 테스트, web 84 파일/662 테스트 통과). 계약 테스트 + env 테스트는 `apps/api`에서 `vitest run src/contracts src/config/env.test.ts`로 단독 재실행(97 통과).
  - 스키마 코드를 직접 읽고, scratchpad에서 테스트와 별도의 적대적 입력 약 150건을 `tsx`로 직접 실행(모르는 키 7개 레벨×9개 이름, 라벨 문자, AST 1,000,000단계/폭 1,000,000/순환/`num.value` 아래 깊은 중첩, 경계값, 100,000개 쓰레기 도형, 1,000,000 요소, 5MB description, getter·Proxy 예외, `__proto__` 키).
  - `git diff --numstat`: 수정 9개 파일 모두 삭제 줄 0(기존 assertion 무수정). 금지 영역(`apps/api/src/{infrastructure,modules}`, `supabase`, `apps/web/src/{features,pages,app,shared/ui}`) `git diff`·untracked 모두 0.
  - `solutionSchema`/`resumeSolutionSchema`/`parseSolutionFigures`/`env.figuresEnabled`를 읽는 비테스트 실행 경로 grep 결과 0건(라이브 경로는 `problemHistoryDetailSchema` 하나뿐이며 선택 키 부재 시 출력 불변을 직접 확인).
  - 독립 계산: F01 ∠BAC=45°, F02 H=(2,0), F03 M=(1,0), F04 A·B가 원 위/OM⊥AB/M=(1.5,1.5), F05 접점 (1,±√3)과 외적 부호(+6.93 ccw / −6.93 cw), F06 교점 (2,2), F07 꼭짓점 (2,−1)·근 1,3, F08 점근선 x=1,y=2, F09 H=(0,0)·M=(1,0)이 fixture 구조와 일치.
- AC별 결과(근거는 위 검사)

| AC | 판정 | 근거 |
|---|---|---|
| AC-1 | PASS | 새 필드 전부 선택(`?`), `FigureSchemaTypeContract` 상호 할당 단언 컴파일 통과 |
| AC-2 | PASS | F01~F09 모두 스키마 통과 + 출력이 입력과 deep-equal, F10a~c도 Stage 1 통과(Stage 2 reject 예정으로 fixture·FIGURE_SPEC §11·invalid.ts에 기록) |
| AC-3 | PASS | F10d~j 정확한 path+code로 거부(계약 테스트 외에 `<script>`/`<`/`&`/제어문자 직접 확인) |
| AC-4 | PASS | midpoint/foot/intersection/tangentPoint에 x,y를 넣으면 `unrecognized_keys`, pointOnGraph에 y 금지, circle radius/through 정확히 하나 |
| AC-5 | PASS | 문자열·JS 코드·latex 객체·미지원 노드/함수/상수·모르는 키 노드·`constructor`/`__proto__` fn 이름 모두 거부 |
| AC-6 | PASS | 깊이 10/11, 노드 64 경계, 요소 60, 제약 40, 단계 20, 라벨 16, bbox 1e4, NaN/±Infinity/1e6 초과 거부. AST 깊이 1,000,000·폭 1,000,000·순환·`num.value` 아래 깊은 중첩 모두 스택 오버플로 없이 거부 |
| AC-7 | PASS | undefined/null/원시값/배열/빈 객체/getter 예외/Proxy 예외/희소 배열/쓰레기 도형 100,000개(22ms)/요소 1,000,000개(1.7s)/5MB description 모두 throw 없음. 악성 figureId는 rejected에 싣지 않음 |
| AC-8 | PASS | L01~L03 입력과 deep-equal, JSON.stringify까지 동일, figures 키 비생성. web 테스트 2종도 확인 |
| AC-9 | PASS | 정확히 `"true"`만 on, 미설정·빈 문자열·`1`/`TRUE`/` true` off. `.env.example`은 빈 값 |
| AC-10 | PASS(자동화 범위) | 금지 영역 diff 0, 비테스트 소비자 0, 삭제된 기존 assertion 0 |
| AC-11 | PASS | PRD §4.12, FIGURE_SPEC, 장부가 구현과 일치(상한·경계·fixture 표·플래그 정의 대조). 단 PROJECT_STATUS §3.41/6.8 행과 본 장부 §1·§2는 아직 "QA 대기"이므로 갱신 필요(아래) |
| AC-12 | PASS | typecheck/lint/test/build 직접 실행 |

- 수치 범위 검토(결정 사항 6번): 적절하다. 반지름·length 0 초과 1e6 이하, 각도 0 초과 360 미만, domain 시작<끝, elements·draggable ≥1, collinear ≥3, polygon 3~12, bbox 가로·세로 0 초과 1e4 이하, 요소 60/제약 40/단계 20/도형 3, AST 64노드/깊이 10 모두 학교 수학 범위를 막지 않고(3차 다항식 약 23노드, 좌측 편향 덧셈 7항까지 깊이 10 이내) 위험하게 넓지도 않다. 개선 제안만 LOW로 아래에 기록.
- LOW 이슈(모두 비차단)
  1. 하한 없는 양수: `radius`·`length.value`·bbox 폭이 `> 0`만 요구해 `1e-300`이 통과한다(bbox 1e4 대비 의미 없는 크기). Stage 2 검증기에서 스케일 상대 최소값(예: bbox 폭의 1e-6배 미만이면 퇴화)을 적용할 것. 반대로 `radius` 1e6은 bbox(≤1e4)의 100배라 느슨하다. 점 좌표도 bbox 밖 1e6까지 허용 — Stage 2에서 처리.
  2. 라벨 문자 허용 범위: 제어문자(C0·DEL·C1)와 `<`·`>`·`&`만 막아 U+202E(양방향 재정렬)·U+200B/FEFF(제로폭)·U+2028/2029는 통과한다. HTML 주입은 불가하지만 라벨 스푸핑 여지가 있다. Stage 2 전에 거부 목록에 추가하거나, 렌더러가 라벨을 textContent/`display:'internal'`로만 그리고 `$`·`\(` 수식 처리를 켜지 않을 것. `description`은 `<`·`>`·`&`도 허용(의도로 보임) — UI에서 반드시 텍스트 노드로만 출력할 것.
  3. 길이 단위: 라벨 16자·description 500자는 UTF-16 코드 유닛 기준이다(이모지 1개 = 2). 문서의 "자"와 정확히 일치하지 않음.
  4. 요소 ID가 `constructor`·`toString`·`hasOwnProperty`도 통과한다. Stage 2 검증기·렌더러는 ID 조회에 일반 객체 대신 `Map`/`Set`을 쓸 것(`__proto__`는 정규식으로 이미 차단).
  5. `parseSolutionFigures`: 후보의 `figureId` getter가 throw하거나 `stepFigureRefs` getter가 throw하면(`readSafeFigureId`·`raw["stepFigureRefs"]`가 안쪽 try 밖) throw는 안 하지만 유효 도형까지 전부 버리고 `unexpected_error` 하나를 돌려준다. JSON에서 온 데이터로는 도달 불가 — 문서의 "도형마다 따로 검사" 서술과만 어긋난다. 또 `rejected`는 상한이 없다(쓰레기 도형 100,000개 → 100,000건).
  6. 엄격 키 검사 예외: JSON의 자기 `"__proto__"` 키는 zod가 조용히 무시해 `strictObject`를 통과하지만 출력에는 남지 않고 프로토타입 오염도 없음을 확인했다(위험 없음, 문서 주장 "모든 모르는 키 거부"에 대한 정확한 단서일 뿐).
  7. 문서: §3.6 접점 기준은 명확하고 일관되나(shared-types JSDoc·PRD FIG-3·F05와 일치) "y축이 위쪽인 수학 좌표 기준"과 2차원 외적 식(OPx·OTy − OPy·OTx)을 명시하지 않았다. shared-types JSDoc에는 외적 부호 규칙이 없다.
  8. `solutionSchema`가 `problemHistoryDetailSchema.solution`의 인라인 shape과 중복 정의다(현재 값은 일치). 중복 정의 유지보수 부담.
- Stage 2 인계에 추가할 항목: 위 1·2·4, 그리고 `draggable`·`polygon.vertices`·`collinear.points`·`highlight`·`hide` 안의 중복/존재하지 않는 ID, `stepFigureRefs.stepId`와 실제 풀이 단계의 일치, `pointOnGraph.x`가 domain 안인지, 평가기에서 `pow` 등이 Infinity/NaN을 낼 때의 선 끊김 처리.
- 미검증: 렌더링·iPad·실기기·AI 호출은 Stage 1 범위 밖이라 해당 없음. 물리 기기 항목 없음.
- 문서 후속(이 QA에서는 수정하지 않음): `docs/PROJECT_STATUS.md` §3.41 제목의 "stage-qa 대기"와 §5 6.8 행, 본 장부 §1·§2의 상태를 PASS 기준으로 갱신해야 한다.

## 4. Stage 2 인계 사항

- **role × 강조 상태 → 토큰·선 스타일 매핑 필요(design-agent)**: `role`(given/auxiliary/result) × 상태(기본/현재 단계 강조/숨김 직전 등)를 `docs/DESIGN_TOKEN_MAP.md`의 기존 토큰과 선 스타일(실선/점선/굵기)로 매핑한다. 색상만으로 구분하지 않는다(Stage 4 요구). 토큰에 없는 색은 만들지 말고 "결정 필요"로 남긴다.
- 의미 검증기: F10a~c가 reject되어야 한다(없는 ID, 뒤쪽 참조, 직각 모순). 요소 타입 호환성(`foot.to`·`intersection.of`·`tangentPoint.circle`·`pointOnGraph.graph`·`polygon.vertices` 등이 올바른 타입을 가리키는지), `appearAt`/`steps`의 stepId 일관성, `interaction.draggable`이 자유 점(`point`)인지, `lineEquation`의 a=b=0 퇴화, line-line 교점 `pick: 1` 처리, 접선 해 없음/퇴화 처리.
- 수학적 기대 좌표를 fixture에 독립 계산으로 추가(F02 H=(2,0), F03 M=(1,0), F04 M=(1.5,1.5), F05 T(ccw)=(1,√3)·T(cw)=(1,−√3), F06 P=(2,2), F07 V=(2,−1)·R1=(1,0)·R2=(3,0), F08 x=1 불연속, F09 H=(0,0)·M=(1,0)).
- JSXGraph 설치는 새 npm 의존성이므로 오너 승인 필요(`.claude/rules/frontend.md` §4). 오픈소스 고지 포함.
- 렌더러 위치: 폴더 의존성 규칙상 `features/` 간 직접 참조 금지 — 렌더러와 평가기의 배치(`shared/` vs `features/`)를 plan-agent가 결정.

### 4.1 Stage 2 WU0~WU2 구현 기록 (development-agent, 2026-10-24)

자체 검증 결과이며 stage-qa 판정이 아니다. Stage 2 PASS 여부는 WU3 이후까지 끝난 뒤 stage-qa-agent가 판정한다.

**변경 파일**

| 파일 | 변경 |
|---|---|
| `apps/web/package.json`, `pnpm-lock.yaml` | `jsxgraph` **1.14.1** 정확한 버전 추가(WU0, 오너 승인). import는 아직 없음 |
| `apps/web/public/licenses/THIRD_PARTY_NOTICES.txt` | 신규 — jsxgraph(MIT 선택, 저작권 고지), katex, perfect-freehand 원문 LICENSE |
| `packages/validation/src/figures/tolerance.ts` | 신규 — 허용오차·상한 상수(D1) |
| `packages/validation/src/figures/geometry.ts` | 신규 — 벡터, 중점, 수선의 발(무한 직선), 직선 교점, 접점(§3.6), 각도 정규화, 다각형 넓이·자기교차, 원–상자 교차 |
| `packages/validation/src/figures/expr.ts` | 신규 — `evaluateExpr`(명시적 switch + never, D5) |
| `packages/validation/src/figures/sampleFunction.ts` | 신규 — `sampleFunctionGraph`(400점, 값 없음·화면 밖·불연속 끊기, 예산) |
| `packages/validation/src/figures/format.ts` | 신규 — `formatFigureNumber` |
| `packages/validation/src/figures/semantics.ts` | 신규 — `validateFigureSemantics`, `resolveFigure`, 오류 코드 |
| `packages/validation/src/figures.ts` | 라벨 금지 문자 강화(LOW 2) + `isSafeLabelText` export, `parseSolutionFigures`에 의미 검증 통합(D9)·LOW 5(getter를 try 안으로)·`rejected` 20건 상한·의미 검증 호출당 9회 상한, 커널 모듈 재export |
| `packages/validation/src/figures/fixtures/types.ts`, `valid.ts`, `invalid.ts`, `index.ts` | `expected`(points·angles·discontinuities·stage2Issue) 추가, F01~F09 손 계산 기대값, F10a~c stage2Issue |
| `packages/validation/src/figures/fixtures/invalidStage2.ts` | 신규 — F11a~F11ak(37건) |
| `apps/api/src/contracts/figureSemantics.contract.test.ts` | 신규 — S2-1~S2-8, 샘플러, 기하 경계(137 테스트) |
| `docs/FIGURE_SPEC.md` | §3.2 라벨, §3.6 외적 식·퇴화, §3.7 hide 누적, §4 최종 상태, §5 파서, §6, §11 기대값·F11, §12 커널·허용오차, §13 오류 코드표, §14 JSXGraph 버전·라이선스·API 확인 |

수정 금지 영역(`apps/api/src/{infrastructure,modules}`, prompts, `supabase/migrations`, `apps/web`의 features·pages·shared/ui·routes) diff 0. 기존 `figureSpec.contract.test.ts` 무수정.

**수용 기준(자체 검증)**

| AC | 내용 | 자체 결과 | 근거 |
|---|---|---|---|
| S2-1 | resolved 좌표·각도가 손 계산 기대값과 1e-9 이내, F05 외적 부호, F08 x = 1 불연속 | 통과 | contract S2-1 |
| S2-2 | F01~F09 의미 검증 통과, resolved는 Map·정의 순서 | 통과 | contract S2-2 |
| S2-3 | F10a~c·F11a~ak 정확한 code·path로 거부(스키마는 통과) | 통과 | contract S2-3 |
| S2-4 | throw 없음(getter·Proxy·null·NaN), 오류 최대 10건 | 통과 | contract S2-4 |
| S2-5 | `constructor`·`toString`·`hasOwnProperty`·`valueOf` ID 정상 동작 | 통과 | contract S2-5 |
| S2-6 | 평가기 허용 목록·D5·알 수 없는 노드 NaN·순환 입력 정지, 소스에 동적 실행 없음 | 통과 | contract S2-6 + `grep -rnE "eval\(\|new Function\|Function\(" packages/validation` 0건 |
| S2-7 | 관대 파서 의미 검증 통합(D9), LOW 5, rejected 상한, 반환 모양 불변, F01~F09 deep-equal | 통과 | contract S2-7 + 기존 AC-7 무수정 통과 |
| S2-8 | 라벨 금지 문자 18종, `formatFigureNumber` | 통과 | contract S2-8 |
| 샘플러 | F08·tan·pow(x,−1)·0^음수·ln·sqrt(음수)에서 끊김, 조각 내 비유한수 없음, 예산 초과 | 통과 | contract "샘플러" |
| 게이트 | 루트 typecheck → lint → test → build | 통과 | api 46 파일/565 테스트, web 84 파일/662 테스트 |

> S2-2~S2-8의 이름은 development-agent가 받은 계획 요지에 세부 정의가 없어 위 표처럼 매핑했다. plan-agent 원문 AC와 다르면 stage-qa에서 대조할 것.

**계획 대비 판단·편차(QA 확인 요청)**

1. `MIN_BBOX_SPAN` = 0.01, `MAX_RADIUS_REL` = 10, 그래프 화면 여유(H×1)·불연속 트리거(0.02·H)는 계획에 수치가 없어 정한 값이다 — **오너 승인(2026-10-24)**.
2. 가로세로비 1:20 상한은 **keepAspectRatio = true 도형에만** 적용했다(함수 그래프 y = x³ 같은 정상 입력 보호, FIGURE_SPEC §12.2).
3. `not_yet_visible`을 "그 단계에 보이지 않음"으로 해석해, 앞 단계에서 이미 숨긴 요소를 다시 강조·숨김하는 것도 거부한다(D6 누적과 일관, F11af).
4. 계획에 없던 안전장치: `parseSolutionFigures` 호출당 의미 검증 9회 상한(`semantic_check_limit_exceeded`). 스키마는 통과하고 의미 검증에서 예산을 다 쓰는 도형이 대량으로 오면 계산량이 무제한이 되는 것을 막는다.
5. 샘플러 함수 이름은 `sampleFunctionGraph`(파일명은 계획대로 `sampleFunction.ts`). `sampleFunction(` 은 게이트 grep 패턴 `Function\(`에 걸리기 때문이다.
6. intersection은 무한 직선 기준으로 계산한다(선분 밖 교점도 허용, foot와 같은 규칙).
7. 고지 파일은 계획대로 jsxgraph·katex·perfect-freehand만 담았다. react·react-dom·react-router·supabase-js 등 다른 번들 의존성의 고지는 범위 밖(필요하면 별도 결정).

**WU3 인계(JSXGraph API 확인 결과 요약, 상세는 FIGURE_SPEC §14.2)**

- `initBoard`는 HTMLElement를 받는다. 단 id가 없으면 `jxgboxN`을 붙이고 **자식을 모두 지운다** → React 자식이 없는 전용 div 필요.
- 라벨·텍스트: `display: "internal"`(SVG Text 노드 `.data` 대입) + `parse: false`(기본 true면 JessieCode 파싱) + `useMathJax/useKatex/useASCIIMathML: false`. `display: "html"`은 innerHTML.
- `showCopyright`·`showNavigation`·`showZoom`·`showInfobox` 기본 true → 끈다. angle `withLabel` 기본 true.
- 보드가 컨테이너에 `touch-action: none`을 직접 건다(전역 아님). 읽기 모드 스크롤은 `registerEvents`(변경 불가)·`browserPan`·`pan` 조합을 실측해야 한다.
- 내장 resize(ResizeObserver, throttle 10ms)가 초기 크기 0도 처리한다. `freeBoard`는 리스너를 지우지만 이미 예약된 resize 콜백(setTimeout)은 취소하지 않는다.

### 4.2 Stage 2 WU3~WU5 구현 기록 (development-agent, 2026-10-24)

자체 검증 결과이며 stage-qa 판정이 아니다.

**이번 라운드 전 오너 확정**: FIGURE_DESIGN 시안 승인(§15 픽셀값 확정), 보드 높이 내용 맞춤 + [120, 360]px(§7.3 변경), 4.1의 수치 1번 승인, 길이 라벨 `≈`, description 항상 표시, 축 이름 정체, 원점 O 미표시, domain 끝점 미표시, 출처 미표시, "실제와 다를 수 있어요" 문구 없음. plan-agent 원문 §4가 장부에 없어, 코디네이터가 준 WU3 기준(공개 API·파일 구성·수명주기·보드 설정·안전·격리·접근성)을 따랐다.

**변경 파일**

| 파일 | 변경 |
|---|---|
| `apps/web/src/features/figure-visualization/FigureView.tsx` | 신규 — 공개 컴포넌트(`<figure>` + 보드/대체 표시 + `<figcaption>`, `aria-busy`) |
| `.../FigureBoard.tsx` | 신규 — 보드 상자, 전용 컨테이너 div(`figboard<영숫자>`, `aria-hidden`), 스피너 겹침 |
| `.../FigureFallback.tsx`, `.../FigureErrorBoundary.tsx` | 신규 — §8 대체 표시, 도형 단위 오류 격리 |
| `.../useJsxGraphBoard.ts` | 신규 — 우리 ResizeObserver(`useElementWidth`), 지연 로딩·취소·StrictMode·resize·단계 적용 |
| `.../mountFigureBoard.ts` | 신규 — 보드 설정(장식·조작·이벤트 끔), 생성·리사이즈·해제 |
| `.../jsxgraphAdapter.ts` | 신규 — `import("jsxgraph")` 유일 진입점, 최소 인터페이스 + 요소 감싸기/풀기 |
| `.../buildBoardScene.ts`, `.../applySceneToBoard.ts` | 신규 — 장면(순수 데이터) 생성, JSXGraph 요소 생성·단계 상태 적용(안전 속성) |
| `.../resolveStepState.ts`, `.../viewport.ts`, `.../figureStyle.ts`, `.../sanitizeLabel.ts`, `.../useFigureSpec.ts` | 신규 — 단계 상태(hide 누적), `computeViewport`(내용 맞춤), §3 매핑표·토큰 읽기, 라벨 2차 방어, 스키마+의미 검증 훅 |
| `.../FigureView.module.css` | 신규 — SVG 텍스트 halo(`paint-order`), 글꼴 상속, `unicode-bidi: isolate` |
| `.../*.test.ts(x)`, `.../testFixtures.ts`, `.../jsxgraph.smoke.test.ts` | 신규 — 단위·컴포넌트(R-1~R-8)·실제 JSXGraph 스모크 |
| `apps/web/src/pages/dev/figures/FigurePreviewPage.tsx`, `compareFixture.ts` | 신규 — `/dev/figures` 미리보기 |
| `apps/web/src/app/routes.tsx` | `import.meta.env.DEV`일 때만 lazy `/dev/figures`, `*` 앞(허용된 예외) |
| `apps/web/src/app/devFiguresRoute.test.tsx` | 신규 — 라우팅 테스트 |
| `docs/FIGURE_DESIGN.md` | 오너 승인 표기, §5·§6.3·§4.5·§10·§11 결정 반영, §7.3 내용 맞춤 규칙, §15 승인·P13 변경, §16 결정 목록 정리 |
| `docs/FIGURE_SPEC.md` | 머리말, §12.2 오너 승인 표기, §14.3 렌더러 확인 결과, §15 렌더러 |
| `docs/COMPONENT_MAP.md` | `FigureView`·`FigureFallback` 행(Figma 대응 없음, 시안 링크) |
| `docs/PROJECT_STATUS.md` | §3.41 Stage 2 요약, §5 6.8 행 |

금지 영역(`apps/api` 실행 코드, prompts, supabase, 기존 web features·pages·shared/ui) diff 0. `routes.tsx`의 DEV 항목만 예외.

**주요 판단 기록**

- 리사이즈: **우리 ResizeObserver 하나**(보드 상자 관찰 + rAF 프레임당 1회). `registerEvents: false`로 JSXGraph 내장 resize(ResizeObserver + 지연 `setTimeout`)가 아예 생기지 않으므로 언마운트 뒤 콜백 문제도 없다. 높이는 폭에서 계산해 React가 상자 높이를 바꿔야 해서 내장 resize로는 처리할 수 없다.
- touch-action: `registerEvents: false`면 JSXGraph가 컨테이너에 `touch-action`을 넣지 않음을 **실제 JSXGraph 스모크 테스트로 확인**(`style.touchAction === ""`). 전역 touch-action·preventDefault 없음.
- 축 있는 도형은 명세 bbox 기준(F06 geometry, F07·F08 function): 원점·축 눈금이 의미가 있다.
- JSXGraph `ticks` 대신 눈금 숫자를 렌더러가 직접 SVG 텍스트로 그린다(U+2212 마이너스, 0·원점 미표시, 안전 속성 동일).
- 텍스트 기본 인라인 `font-family: Arial`을 `cssDefaultStyle: ""`로 비워 앱 글꼴 상속(스모크에서 확인).
- 각 parents에 좌표 배열을 주면 JSXGraph가 보이는 점을 만들어서, 모든 끝점·중심·꼭짓점은 `visible: false` 보조 점으로 넘긴다.

**수용 기준(자체 검증)**

| AC | 내용 | 자체 결과 | 근거 |
|---|---|---|---|
| R-1 | elements 순서대로 생성, 모든 텍스트·점 라벨 internal/parse false/수식 엔진 off, 라벨 없는 점 `name: ""`·`withLabel: false`, 각 `withLabel: false`·직각 아닌 각 sector, 모든 요소 fixed·highlight false, 보드 장식·조작·이벤트 끔, 전용 컨테이너(React 자식 0, 영숫자 id, aria-hidden) | 통과 | `FigureView.test.tsx` R-1 |
| R-2 | StrictMode 보드 1개·언마운트 0개, 지연 로딩 중 언마운트 시 미생성 | 통과 | R-2(정리·취소 코드를 지우면 실패하는 것을 직접 확인) |
| R-3 | 폭 0이면 미생성·자리 잡기·`aria-busy`, 폭 생기면 생성, 폭 변화는 `resizeContainer`만 | 통과 | R-3 |
| R-4 | 각은 정규화 순서(F02 → B, H, C) 보조 점, 직각 표시 square, 파생 점은 커널 좌표 | 통과 | R-4, `buildBoardScene.test.ts` |
| R-5 | 함수 그래프 조각별 curve(F08 → 2개), 유한 값, functiongraph 미사용 | 통과 | R-5 |
| R-6 | 의미 오류·JSXGraph 예외·청크 로드 실패·토큰 없음 → 그 도형만 대체 표시, 다른 도형 유지, 실패 보드 해제, description 텍스트 출력(`<img>` 미생성), `role=alert` 없음 | 통과 | R-6 |
| R-7 | 단계 전환 시 보드 재생성 없음, hide 누적·강조·최종 상태 | 통과 | R-7, `resolveStepState.test.ts` |
| R-8 | role × 상태 스타일(강조 언더레이 accent-yellow α0.5 폭 10, 비강조 불투명도) | 통과 | R-8, `figureStyle.test.ts` |
| 높이 | 납작한 도형(120으로 줄어듦), 세로로 긴 도형(360 + 가로 대칭 확장), bbox가 내용의 3배(높이 감소, 내용+라벨 여백 보임), 같은 단위 비율, 원 전체 보임 | 통과 | `viewport.test.ts` |
| 스모크 | 실제 JSXGraph 1.14.1로 F01 생성: SVG 텍스트 A·B·C·45°, 저작권 문구 없음, touch-action 빈 값, HTML 텍스트 없음, Tab 가능 요소 없음, Arial 인라인 없음, freeBoard 후 자식 0 | 통과(jsdom, 크기는 style로 부여) | `jsxgraph.smoke.test.ts` |
| WU4 | 개발 모드 `/dev/figures` 지연 로딩·`*` 앞, 운영 산출물에 fixture 문자열 0건 | 통과 | `devFiguresRoute.test.tsx`, `grep -rl "fig-f01" apps/web/dist` 0건(`fig-f11`·`삼각형과 각`·`FigurePreviewPage`·`dev/figures`·`JSXGraph` 모두 0) |
| 게이트 | 루트 typecheck → lint → test → build | 통과 | api 46 파일/565, web 91 파일/725 테스트 |

**번들 확인**

- 운영 빌드: 렌더러를 운영 화면이 아직 import하지 않아 JSXGraph·렌더러·검증 커널·의미 검증기·fixture가 운영 번들에 **없다**. 메인 번들 `index-*.js`는 966.85 kB(gzip 282.44 kB)로 WU2 시점과 같았다(WU3~WU4로 늘어난 JS 0). **정정(재작업 1, QA LOW-3)**: "운영 번들 증가 0"은 WU2 → WU4 사이만의 이야기다. Stage 1 구조 스키마(`figures.ts`의 zod 정의와 오류 메시지 문자열 — 예: "수식 AST 깊이", `^fig-[a-z0-9]{1,16}$`, "geometry 도형은 keepAspectRatio")는 `validation` 메인 index가 재export하고 zod 호출이 부수효과로 취급돼 트리 셰이킹되지 않는다. 그래서 운영 화면이 쓰지 않는데도 Stage 1부터 메인 번들에 **죽은 코드로 남아 있다**. 의미 검증기(`validateFigureSemantics`)·샘플러는 번들에 없음을 문자열로 확인했다. 재작업 1 후 메인 번들은 966.97 kB(+0.12 kB, 라벨 금지 문자 목록 확장분이 이 죽은 스키마 쪽에 들어감). CSS 70.11 → 71.00 kB(Tailwind가 새 소스의 클래스를 포함). precache 8 entries 1014.68 KiB. PWA 경고 없음(기존 "chunk > 500 kB" 경고는 WU2 이전부터 있던 것).
- 청크 분리 확인: `NODE_ENV=development vite build --mode development`(미리보기 라우트 포함, scratchpad 출력)에서 jsxgraph가 **별도 청크**(`src-*.js` 1,038.92 kB / gzip 259.34 kB, 이름은 jsxgraph 진입 파일 `src/index.js`에서 옴)로 분리되고 메인 번들과 섞이지 않음. 이때 precache는 13 entries 2,336.95 KiB — **Stage 4에서 운영 화면이 렌더러를 import하면 이 청크(약 1 MB)가 PWA precache에 들어간다**. Workbox 기본 상한(2 MiB) 미만이라 경고는 없지만, 사용자 전원에게 미리 내려받게 할지(`globIgnores` + 런타임 캐시)는 Stage 4 결정 사항.
- MIT 고지: `dist/licenses/THIRD_PARTY_NOTICES.txt` 포함(MIT 허가 문구 3건). JSXGraph 소스 주석은 `/*!` 형식이 아니라 최소화 시 사라지므로 이 파일이 고지 역할을 한다.

**stage-qa 재현 방법** — `pnpm dev`(apps/web) 후 브라우저에서 `/dev/figures`(로그인 불필요):

1. F01~F09 각각 380·708 두 폭 카드에 그림이 뜨고, 로딩 스피너("그림을 준비하는 중")가 잠깐 보였다가 사라지는지.
2. 단계 칩("최종", s1…): 누르면 그림이 다시 만들어지지 않고(깜빡임 없이) 등장·숨김·강조만 바뀌는지. F09 s3에서 직각 표시(angAHC)가 사라지고 M·AM이 강조, "최종"에서 강조 없음.
3. role 구분: given 실선 진한 색·작은 채운 점, auxiliary 점선(5,5)·속빈 점, result 굵은 teal·큰 점. 강조는 굵기 + 노란 형광 언더레이, 비강조는 옅게.
4. F02·F05·F09 직각 표시는 정사각형(한 변 약 10px), F01 45° 각은 호 + "45°" 라벨. 직각이 아닌 각에 정사각형이 저절로 생기지 않는지.
5. F08: x = 1 양쪽 곡선이 수직선으로 이어지지 않고, 점근선(점선)이 s2에 나타나는지. F07: 꼭짓점·근 점, 축 화살표·눈금 숫자(음수는 "−", 0과 "O" 없음), 축 이름 x·y(정체).
6. 라벨: 앱 글꼴(SF Pro/Apple SD Gothic Neo), 선 위에서도 읽히는 halo, 다각형 꼭짓점 라벨이 바깥쪽.
7. 보드 높이(계산값, 보드 폭 348 / 676): F01 206 / 360(이전 규칙 232 / 360), F02·F03·F05 253 / 360(이전 261), F09 206 / 360(이전 218), F04 348 / 360, F06·F07·F08은 명세 bbox 기준 348·261·261 / 360(변화 없음). fixture는 bbox가 이미 내용에 가까워 감소 폭이 작다 — 큰 감소는 단위 테스트(납작한 도형 → 120, bbox 3배 → 이전 규칙 348의 70% 미만)로 확인했다. 원 전체·라벨이 잘리지 않는지, 676 폭에서 360 상한에 걸려 가로가 넓어지는지 확인.
8. 상호작용 없음: 보드 위에서 드래그·핀치·휠·Tab 해도 그림이 움직이거나 포커스되지 않고, **보드 위에서 시작한 스와이프로 페이지가 스크롤되는지**(iPad 실기기 필수 — 자동화로는 확인 불가).
9. 창 폭을 바꾸면 그림이 다시 맞춰지는지(재생성 없이), 콘솔 오류 없는지.
10. "거부되는 fixture": F10a~c·F11은 대체 문구 "그림을 표시하지 못했어요. 아래 설명을 참고해 주세요." + 설명 + 거부 사유(dev 전용), F10d~j는 사유만.
11. 저작권 문구·이동/확대 버튼·좌표 상자가 보이지 않는지. VoiceOver로 figure가 figcaption 설명으로 읽히고 SVG 라벨 조각을 읽지 않는지.
12. 운영 빌드(`pnpm build`) 후 `grep -rl "fig-f01" apps/web/dist` 0건.

미검증(자동화 범위 밖): 실제 브라우저·iPad 시각 품질(라벨 겹침, halo, 글꼴), 실기기 스크롤·Split View·회전. 실기기 확인 전에는 실기기 PASS로 보고하지 않는다.

### 4.3 Stage 2 QA 판정 (stage-qa-agent, 2026-10-24, 재작업 0/3)

- **판정: CONDITIONAL PASS — FIX REQUIRED (BLOCKER·HIGH 없음, MEDIUM 2건 / LOW 다수)**. 실기기 iPad는 확인하지 않았다(아래 분리 보고).
- 장부 §4에 plan-agent 원문 AC가 없어 S2-1~8은 §4.1 매핑, R-1~R-8은 §4.2 표를 기준으로 삼았다. **R-9·R-11은 장부 어디에도 정의가 없다**(R-10 = 실제 브라우저 확인으로 취급) — 정의를 장부에 보존할 것.

**자동 검사(직접 실행)**

| 항목 | 결과 |
|---|---|
| 루트 `pnpm typecheck` → `lint` → `test` → `build` | 전부 exit 0. api 46 파일/565, web 91 파일/725 통과. 기존 테스트 파일 수정은 삭제 줄 0(추가만) |
| 금지 영역 diff | `apps/api/src/{infrastructure,modules}`, prompts, `supabase`, `apps/web/src/{pages,features,shared}`의 기존 파일 변경 0. `routes.tsx`는 DEV 항목 13줄 추가뿐. `apps/api` 실행 코드 변경은 Stage 1의 `env.ts` `figuresEnabled`뿐(읽는 곳 없음) |
| `grep -rnE "eval\(\|new Function\|Function\(" packages/validation apps/web/src/features/figure-visualization` | 0건 (innerHTML·dangerouslySetInnerHTML·`parse: true`·`display: "html"`·TODO·console.log·any·ts-ignore·eslint-disable도 0건) |
| 운영 dist | `fig-f01`·`fig-f11`·`삼각형과 각`·`FigurePreviewPage`·`dev/figures`·JSXGraph 코드 모두 0건. `JSXGraph` 문자열은 `dist/licenses/THIRD_PARTY_NOTICES.txt` 1곳(고지). 고지 파일의 jsxgraph·katex·perfect-freehand LICENSE가 `node_modules` 원문과 일치. 운영 번들에 검증 커널(`validateFigureSemantics` 등)은 없으나 Stage 1 구조 스키마 정의가 번들에 남아 있음(아래 LOW) |
| 수학 독립 재계산 (`tsx`, 장부·fixture `expected`를 쓰지 않고 별도 공식) | F01 ∠=45°, F02 H=(2,0)·∠90°, F03 M=(1,0), F04 M=(1.5,1.5)·OM⊥AB·A,B 원 위, F05 T1=(1,+√3)·T2=(1,−√3)(외적 +6.93/−6.93, OT⊥TP), F06 P=(2,2)·두 직선 위 점 검산, F07 V=(2,−1)·R1=(1,0)·R2=(3,0)·조각 전 점이 포물선 위, F08 조각 2개·x=1을 가로지르는 조각 없음·전 점이 곡선 위, F09 H=(0,0)·M=(1,0)·∠90° — 전부 일치(1e-9) |
| 무작위 속성 검사 | 접점 20,000×ccw/cw(원 위·OT⊥TP·외적 부호), 각 20,000(acos 대조·≤180·swapped=외적<0), 수선의 발·직선 교점 각 20,000 — 위반 0. 원 안/위/중심 퇴화 판정 확인 |
| 불연속 샘플러 | tan(x)·tan(2x)·1/x·1/x²(같은 부호 극)·1/(x²−1)·1/(x−1)+tan·ln·sqrt·x^(1/3)·0^−1·exp 오버플로·|x|/x·sin(1/x) 등 16종: 조각 내 비유한수 0, 극 개수와 조각 수 일치(tan(x) [−7,7] 극 4개→5조각), 인접 점 사이 50점 재평가로 “점근선을 잇는 다리” 0건 |
| 문서 대조 거부 | `FIGURE_SPEC.md` §11/§11.2 표를 파싱해 F10a~c(3)+F11(37) = 40건 전부 문서의 code·path로 거부, 모두 구조 스키마는 통과(Stage 1 accept), `parseSolutionFigures`도 거부·throw 없음. F10d~j는 문서의 path로 스키마 거부 |
| 적대적 입력(직접 작성, 약 60건) | 순환·자기 참조·3-cycle(`self_reference`/`forward_reference`), `constructor`·`toString`·`hasOwnProperty`·`valueOf`·`isPrototypeOf`·`prototype` ID 정상 처리, `__proto__` 스키마 거부, 1e300·NaN·Infinity·문자열 숫자 거부, bbox 1e-300·0.001·1:30 거부, 반지름 1e6·1e-300 거부, AST 깊이 9 통과/10~100,000 거부(스택 오버플로 없음), tan(1000x) 그래프 60개 → `compute_budget_exceeded`(6 ms), 12각 별 자기교차 거부, 거의 평행 교점 거부, 객체 순환·getter 예외·Proxy·null·undefined·원시값 입력 throw 없음, 쓰레기 도형 100,000개(8 ms, rejected 20건), 의미 검증 9회 상한 동작 |
| 라벨 | 양방향 제어문자(U+202E, U+061C)·제로폭(U+200B, U+FEFF)·U+2028·`<`·`&`·C0/C1 거부 확인 |

**실제 브라우저(R-10)** — `apps/web`에서 `pnpm dev`(StrictMode 포함) 후 Playwright로 Chromium·WebKit(Safari 엔진) 헤드리스 1194×834에서 `/dev/figures` 확인. **물리 iPad가 아니다.**

| 재현 항목 | 결과 |
|---|---|
| 1 F01~F09 × 380/708 카드 18개 렌더 | 통과. SVG 18개 = JXG 보드 18개(StrictMode에서도 중복·누수 없음), 콘솔 오류 0(React Router `HydrateFallback` 경고만, 기존) |
| 2 단계 칩 전환 | 통과. 모든 칩 전환 후에도 SVG 노드 동일(재생성 없음), 보드 수 18 유지. F09 s3에서 angAHC 숨김·M·AM 강조·H 유지, 최종에서 강조 없음 |
| 3·4 role 스타일, 직각 표시 | 스크린샷 육안 확인: given 실선, auxiliary 점선·속빈 점, result teal, 강조 = 굵기+노란 언더레이. F02·F05·F09 직각 표시, F01 45° 호+“45°” |
| 5 F08·F07 | F08 x=1 양쪽 곡선이 끊겨 있고 점근선 점선(s2). F07 꼭짓점·근 점, 음수 눈금 “−”, 0·O 미표시 |
| 6 라벨 | 앱 글꼴(SF Pro 스택), Arial 인라인 0, halo 적용. 일부 겹침은 아래 LOW |
| 7 보드 높이 | 보드 폭 346/674(카드 테두리 2px 제외): F01 205/360, F02·F03·F05 252/360, F04 346/360, F06 346/360, F07·F08 260/360, F09 205/360 — 장부 값(폭 348 기준)과 2px 차이만 있고 일관 |
| 8 상호작용 | Chromium·WebKit 모두: 보드 위 휠이 페이지를 스크롤(0→400), 보드 위 드래그로 bbox 불변, pointerdown/mousedown/wheel/keydown `defaultPrevented` 모두 false, 보드 요소 인라인 `touch-action` 0, Tab 가능 요소 0. **터치 스와이프 스크롤은 물리 기기 필수 → 미확인** |
| 9 리사이즈 | 카드 폭을 260→180→120→380px로 바꿔도 SVG 노드 유지·단위 비율 동일(unitX=unitY), 높이 145→120(하한). 폭 0(display:none)이면 보드를 해제(보드 17)하고 복귀 시 다시 생성(18) — 누수·오류 없음. 콘솔 오류 0 |
| 10 거부 fixture | 47행: F10a~c·F11 40건은 대체 문구+설명+사유(SVG 0, `role=alert` 0), F10d~j 7건은 사유만 |
| 11 장식·접근성 | 저작권 문구·이동 버튼·확대 버튼·좌표 상자가 보이지 않음(JSXGraph가 만드는 빈 `.JXG_navigation` div(4×4)와 `visibility:hidden` 인포박스 div는 DOM에 남지만 보이지 않고 보드가 `aria-hidden`). VoiceOver 읽기는 **미확인(실기기)** |
| 12 운영 빌드 grep | 위 표 — 0건 |
| 추가: JSXGraph 청크 로드 실패 | `node_modules/.../jsxgraph` 요청을 차단하면 18개 모두 대체 문구+설명, 흰 화면·미처리 예외 없음 |
| 추가: 적대적 라벨 실렌더(실제 JSXGraph) | `$x^2$`, `\(x\)`, `'+alert(1)+'`, `{{7*7}}`, `A_{1}^{2}`, 축 이름 `$x$`·`\(y\)` 모두 글자 그대로 SVG `<text>`로 출력, 주입 요소(script·img·iframe·on*) 0, HTML 텍스트 div 0, `alert` 미발생, `freeBoard` 후 컨테이너 자식 0 |

**AC별 결과**

| AC | 판정 | 근거 |
|---|---|---|
| S2-1 수학 일치 | PASS | 독립 재계산·무작위 검사·불연속 16종 |
| S2-2 F01~F09 통과·Map 순서 | PASS | resolved 재계산에서 사용 |
| S2-3 F10a~c·F11 37건 정확한 code·path | PASS | 문서 표 파싱 대조 40/40 |
| S2-4 throw 없음·10건 상한 | PASS | getter·Proxy·null·순환 객체 |
| S2-5 `constructor` 등 ID | PASS | 6종 직접 확인 |
| S2-6 평가기·동적 실행 없음 | PASS | grep 0건, 소스 switch/never 확인 |
| S2-7 관대 파서 | PASS | 쓰레기 10만 건 8 ms, 의미 검증 9회 상한, rejected 20건 |
| S2-8 라벨·포맷 | PASS(주의) | 문서 목록의 문자는 모두 거부. 그 밖의 비가시 문자는 통과(LOW 3) |
| R-1 안전 속성·전용 컨테이너 | PASS | 실렌더 + 코드(`SAFE_TEXT_ATTRIBUTES`) |
| R-2 StrictMode·언마운트 | PASS | 브라우저 보드 18=18, 폭 0 해제 확인 |
| R-3 폭 0·리사이즈 | PASS | 브라우저 |
| R-4 각 정규화·직각 표시 | PASS | 스크린샷 + 수학 검증 |
| R-5 불연속 조각 | PASS | F08 2조각, 16종 |
| R-6 오류 격리·대체 표시 | PASS | 거부 47행, 청크 차단 |
| R-7 단계 전환 | PASS | SVG 노드 유지 |
| R-8 role×상태 스타일 | PASS(육안) | 스크린샷 |
| R-9·R-11 | NOT VERIFIED(정의 없음) | 장부에 정의가 없음 |
| R-10 실제 브라우저 | PASS(헤드리스 Chromium·WebKit) | 위 표. 물리 iPad 아님 |
| G 게이트 | PASS | typecheck/lint/test/build exit 0 |
| 하위 호환·범위 | PASS | 금지 영역 diff 0, dist 0건, 고지 포함 |

**이슈**

- BLOCKER/HIGH: 없음.
- MEDIUM
  1. **화면 밖·극단 계수 `lineEquation`을 거부하지 않는다.** `circle_out_of_view`에 해당하는 선 검사가 없다. 재현: bbox [−10,10,10,−10], `lineEquation a=1e-300, b=1e-300, c=1e6` → `validateFigureSemantics` ok, 렌더 시 SVG `<ellipse cx="Infinity" cy="-Infinity">`와 콘솔 오류 8건(크래시·흰 화면 없음, 보이지 않는 선). `a=1e-6,b=0,c=1`(x=1e6)이나 `x+y=1e6`도 통과해 보이지 않는 선이 된다. AI가 bbox 밖의 직선(예: y=100)을 내는 것은 현실적이다. 기대: D3처럼 `line_out_of_view`(bbox와 안 만나면 거부) 또는 계수 상한. 근거: `semantics.ts` `lineEquation` 분기 + 위 브라우저 실행.
  2. **긴 무공백 description이 가로로 넘친다.** `FigureView`의 `<figcaption>`은 `whitespace-pre-wrap`만 있고 `overflow-wrap`이 `normal`이다. 재현: 500자 `W`(스키마 허용) → figcaption scrollWidth 5609 vs 348, 페이지 scrollWidth 5649/1194(미리보기 페이지 기준). 한글 500자는 정상 줄바꿈. Stage 4에서 결과 패널에 넣으면 패널 가로 넘침 위험. 기대: `break-words`(또는 `overflow-wrap:anywhere`).
- LOW
  1. 의존 요소 가시성 불일치를 검증하지 않는다: 끝점보다 먼저 등장하는 선분(`segCH.appearAt=s1`, 점 H는 s2), 선분이 남아 있는데 끝점만 hide → 모두 통과(Stage 3 AI 출력에서 어색한 그림 가능). Stage 3/4 인계.
  2. 라벨 비가시 문자 일부 통과: U+2060(word joiner), U+00AD, U+FE0F, 태그 문자 U+E0041, U+3164(한글 채움 — 빈 라벨), U+180E. HTML 주입은 아님(실렌더로 확인). 스푸핑·빈 라벨 여지.
  3. 운영 번들에 Stage 1 구조 스키마(`figureSpecSchema`)가 죽은 코드로 남는다(zod 호출 부수효과로 트리 셰이킹 안 됨). 검증 커널·JSXGraph·fixture는 없다. 시작 시 스키마 객체 생성 비용은 미미하지만 장부의 “운영 번들 증가 0” 서술은 정확하지 않다.
  4. 겹침: F05 T2 라벨이 접선과 겹침, F07 눈금 “1”·“3”이 강조된 R1·R2 점 아래에 겹침, F09 B 라벨이 변과 근접(halo로 읽힘). 실기기 시각 확인 대상.
  5. 보드 폭 장부 서술(348/676)이 실제 346/674와 2px 다름(테두리). `JXG_navigation` 빈 div·숨은 인포박스 div가 보드마다 DOM에 남음(보이지 않음, `aria-hidden` 안).
  6. 장부 §4에 plan-agent 원문 AC(S2-2~8, R-9~R-11)가 없어 정의가 개발자 해석에 의존.
  7. 의미 검증은 호출당 9회 상한이라, 앞의 잘못된 후보 9개 뒤의 유효한 도형은 `semantic_check_limit_exceeded`로 버려진다(설계된 절충, 문서화됨).
  8. `apps/api/src/.claude`, `apps/web/.claude`, `apps/web/src/.claude`(에이전트 메모리)가 서브디렉터리에 만들어져 untracked로 남아 있다 — 커밋 전 정리/무시 결정 필요.

**미확인(자동·헤드리스로 확인 불가)**: 실물 iPad(Safari)에서의 터치 스와이프 페이지 스크롤, 보드 위 손가락/Apple Pencil 상호작용, Split View·회전, VoiceOver 읽기, 실제 글꼴(SF Pro·Apple SD Gothic Neo) 시각 품질·라벨 겹침 — Stage 4 실기기 항목. 이번 판정은 실기기 PASS가 아니다.

**Stage 3 진행 전 수정 요청**: MEDIUM 1·2. LOW 1은 Stage 3 계획에 반영할지 결정.

### 4.4 plan-agent 원문 수용 기준 (보존, 재작업 1에서 QA LOW-5에 따라 기록)

Stage 2 승인 계획 원문의 정의다. development-agent의 이전 매핑(§4.1 표)은 이름이 달랐으므로 아래로 다시 맞춘다.

| AC | 정의(계획 원문) | 검증 방법 |
|---|---|---|
| S2-1 | F01~F09가 의미 검증을 통과하고 기대 좌표와 1e-9 이내로 일치 | 계약 테스트 |
| S2-2 | F10a~c가 정확한 code와 path로 거부 | 계약 테스트 |
| S2-3 | F11 계열이 기대 code로 거부 | 계약 테스트 |
| S2-4 | `constructor`·`toString`·`hasOwnProperty` ID가 정상 동작 | 계약 테스트 |
| S2-5 | 평가기는 허용 목록만 사용, eval·new Function 0건 | 계약 테스트 + grep |
| S2-6 | 불연속에서 선이 끊김(F08, tan, pow(x,−1), ln, sqrt(음수), 0^음수), 조각 안에 비유한수 없음 | 계약 테스트 |
| S2-7 | `parseSolutionFigures`가 throw하지 않고 의미 오류 도형만 버림, getter가 throw해도 다른 도형 유지, rejected 상한 | 계약 테스트 |
| S2-8 | 양방향 제어문자·제로폭 문자·U+2028/2029 라벨 거부 | 계약 테스트 |
| R-1~R-8 | §4.2 표(생성 순서·안전 속성 / StrictMode / 크기 0·리사이즈 / 각 정규화 / 함수 조각 / 오류 격리·escape / 단계 상태 / 스타일 매핑) | 렌더러 테스트(가짜 어댑터) |
| R-9 | `/dev/figures`가 DEV에서만 존재하고, 운영 dist에 fixture 문자열이 없다 | 라우팅 테스트 + build 후 grep |
| R-10 | 실제 브라우저 렌더 확인(QA가 R-10으로 취급) | 헤드리스 브라우저(물리 iPad는 별도) |
| R-11 | jsxgraph 버전과 라이선스가 기록돼 있고, 고지 파일이 빌드 결과에 포함된다 | dist 파일 확인 |

**현재 결과 다시 매핑(재작업 1 후, 자체 검증 — QA 판정 아님).** 테스트 이름은 `apps/api/src/contracts/figureSemantics.contract.test.ts`의 describe다.

| AC | 자체 결과 | 근거 |
|---|---|---|
| S2-1 | 통과 | "S2-1 계산 결과가 … 1e-9" + "S2-2 정상 fixture(F01~F09)는 의미 검증을 통과한다" |
| S2-2 | 통과 | "S2-3 의미 오류 fixture(F10a~c, F11 계열)…"의 F10a·F10b·F10c(code + path) |
| S2-3 | 통과 | 같은 describe의 F11a~F11ap 42건(code + path) |
| S2-4 | 통과 | "S2-5 Map 기반 ID 조회…"(`constructor`·`toString`·`hasOwnProperty`·`valueOf`·`isPrototypeOf`) |
| S2-5 | 통과 | "S2-6 수식 평가기는 허용 목록 switch만 쓴다"(소스 스캔 포함) + grep 0건 |
| S2-6 | 통과 | "샘플러 — 불연속·값 없음에서 선을 끊는다" + S2-1의 F08 |
| S2-7 | 통과 | "S2-7 parseSolutionFigures는 의미 검증을 통과한 도형만 받는다(D9)" |
| S2-8 | 통과 | "S2-8 라벨 문자 강화" + 재작업 1 describe의 추가 문자 10종 |
| R-1~R-8 | 통과 | `apps/web/src/features/figure-visualization/FigureView.test.tsx` 외 |
| R-9 | 통과 | `apps/web/src/app/devFiguresRoute.test.tsx` + `apps/web/dist`에서 `fig-f01`·`fig-f11`·`삼각형과 각`·`FigurePreviewPage`·`dev/figures` 0건 |
| R-10 | 헤드리스 Chromium 확인(§4.5). 물리 iPad 미확인 | 스크린샷 |
| R-11 | 통과 | FIGURE_SPEC §14.1(1.14.1, MIT 선택), `apps/web/dist/licenses/THIRD_PARTY_NOTICES.txt` 존재 |

### 4.5 재작업 1/3 기록 (development-agent, 2026-10-24)

근거: design-agent 사후 검수 FAIL(P1-1, P1-2, P2-1, P2-2, P3-1, P3-3)과 stage-qa §4.3(MEDIUM-1·2, LOW-1·2·3·5). 아래는 자체 검증 결과이며 QA 판정이 아니다.

| 항목 | 처리 | 테스트·근거 |
|---|---|---|
| P1-1 직각 표시가 점 언더레이·라벨에 가려짐 | 점 언더레이 층을 6에서 3(선 언더레이와 같은 층)으로 내려 각(4) 아래에 둠. 점 라벨은 각의 두 팔·이등분선 방향을 막힌 방향에 넣어 직각 표시 사분면을 피함 | `applySceneToBoard.test.ts`(레이어 순서), `labelPlacement.test.ts`(직각 사분면 회피), 스크린샷 F09 s2·F02 최종 |
| P1-2 꼭짓점이 아닌 점의 라벨이 선과 겹침 | 순수 함수 `labelPlacement.ts`: 막힌 방향을 모으고 24방향 중 여유가 가장 큰 방향을 고름(동점이면 바깥쪽). 다각형 꼭짓점은 무게중심 반대 방향 유지. autoPosition 미사용 | `labelPlacement.test.ts`: F02·F03·F04·F05·F07·F09 모든 점 라벨 상자가 선·원·곡선·축과 겹치지 않음. 예전 (1,1) 고정으로 되돌리면 5개 fixture가 실패하는 것을 직접 확인. H는 아래쪽, T2는 원 바깥 |
| F07 눈금 1·3이 R1·R2와 겹침 | 점 마커·점 라벨·축 이름 상자와 겹치는 눈금 숫자 생략 | `buildBoardScene.test.ts` "F07: … 1·3은 생략", 스크린샷 F07 s3 |
| P2-1 가장자리 눈금 잘림 | 보드 가장자리 12px 띠에 걸리는 눈금 숫자 생략(화살표 끝·축 이름 영역 포함) | `buildBoardScene.test.ts` "가장자리 12px 띠" |
| P2-2 리사이즈 때 눈금 간격 미갱신 | 장식(격자·축·눈금·축 이름)을 요소와 분리. 리사이즈 결과가 달라지면 장식만 `removeObject` 후 다시 만듦(요소 유지). 격자는 보드 전체 범위까지 | `FigureView.test.tsx` "P2-2 …"(가짜 보드에서 d0 격자 제거·d1 생성, 점 수 불변), `buildBoardScene.test.ts`, 스크린샷 200px |
| P3-1 축 화살표·거리 | 시안 측정값 적용: 화살표 8×8(`type 1, size 8`), x 눈금 5px, y 눈금 4.5px, x축 이름(−5, 8), y축 이름(7.5, −6). FIGURE_DESIGN §15 P19에 "오너 승인 시안 기준"으로 기록 | `buildBoardScene.test.ts` AXIS_PX, `FigureView.test.tsx` "P3-1" |
| P3-3 dev 페이지 내부 경로 import | `validation` package.json `exports`에 `./fixtures` 추가. dev 페이지와 새 테스트를 `validation/fixtures`로 바꿈. 기존 Stage 1 테스트가 쓰는 `./src/figures/fixtures`는 같은 파일을 가리키는 호환 경로로 유지(기존 테스트 무수정) | 운영 dist fixture 문자열 0건 유지 |
| MEDIUM-1 화면 밖·극단 계수 lineEquation | `line_out_of_view`: 정규화한 뒤 boundingBox 네 모서리 부호 검사(허용 1e-3·S). 계수 상대 퇴화 `√(a²+b²) ≤ 1e-6 × max(|a|,|b|,|c|/S)`이면 `degenerate`. segment·line·ray에도 같은 검사 | 계약 테스트: 1e-300·a=b=0·y=100·x=1e6·x+y=1e6 거부, y=0·모서리 통과·작지만 정상 계수 통과. F11al·am·an |
| MEDIUM-2 긴 무공백 설명 넘침 | figcaption과 대체 문구에 `wrap-anywhere`(overflow-wrap: anywhere) | `FigureView.test.tsx` "MEDIUM-2". 헤드리스 확인: figcaption scrollWidth 348 = clientWidth, 페이지 1194 = 1194. 빌드 CSS에 `overflow-wrap:anywhere` 포함 |
| LOW-1 의존 요소 가시성 | `dependency_not_visible`: 참조 대상보다 먼저 등장할 수 없음. 참조 대상을 숨기면 의존 요소도 같은 단계 또는 그 전에 숨겨야 함. **F01~F09는 걸리지 않아 fixture는 고치지 않음.** 지난 라운드 내 계약 테스트 S2-5의 입력(toString만 숨기고 그 점에 의존하는 중점은 남김)이 이 규칙에 걸려, 의존 요소도 함께 숨기도록 **테스트 입력만** 고침. 단언은 그대로이고, 테스트 목적(Map 기반 ID 조회)도 바뀌지 않음 | 계약 테스트(F01~F09 미해당, 함께 숨기면 통과), F11ao·ap |
| LOW-2 라벨 비가시 문자 | U+2060–U+2064, U+00AD, U+FE00–U+FE0F, U+E0000–U+E007F, U+3164, U+FFA0, U+180E, U+115F, U+1160 추가(`isForbiddenLabelCodePoint`, export). 렌더러 2차 제거도 같은 함수를 import해 목록을 하나로 맞춤. 요청 목록 외에 U+2061–U+2064(보이지 않는 수학 연산자)와 U+FFA0(반각 한글 채움)을 같은 성격이라 함께 넣음 | 계약 테스트 10종 |
| LOW-3 번들 서술 | §4.2 번들 문단 정정(Stage 1 스키마가 죽은 코드로 남는다는 점 반영) | 운영 번들 문자열 확인 |
| LOW-5 원문 AC | §4.4에 보존하고 다시 매핑 | — |

**변경 파일(재작업 1)**

- validation 패키지
  - `packages/validation/package.json`(exports)
  - `packages/validation/src/figures.ts`(라벨 문자)
  - `packages/validation/src/figures/{geometry,semantics}.ts`(`lineCrossesBox`, `line_out_of_view`, lineEquation 상대 퇴화, `dependency_not_visible`, `elementDependencies`)
  - `packages/validation/src/figures/fixtures/invalidStage2.ts`(F11al~ap)
- api 계약 테스트: `apps/api/src/contracts/figureSemantics.contract.test.ts`(테스트 추가, S2-5 입력 조정, import 경로)
- web 렌더러 `apps/web/src/features/figure-visualization/`
  - 신규: `labelPlacement.ts`
  - `buildBoardScene.ts`: 라벨 배치, 장식 분리, 눈금 생략, 격자 범위
  - `applySceneToBoard.ts`: 레이어, 화살표, 장식 교체
  - `mountFigureBoard.ts`: 리사이즈 때 장식 재생성
  - `useJsxGraphBoard.ts`, `jsxgraphAdapter.ts`(`removeObject`), `sanitizeLabel.ts`(공용 목록)
  - `FigureView.tsx`, `FigureFallback.tsx`(`wrap-anywhere`)
  - 테스트: `labelPlacement.test.ts`·`applySceneToBoard.test.ts` 신규, `buildBoardScene.test.ts`·`FigureView.test.tsx`·`jsxgraph.smoke.test.ts`는 추가와 import 경로만 수정
- dev 페이지: `apps/web/src/pages/dev/figures/{FigurePreviewPage.tsx,compareFixture.ts}`(import 경로)
- 문서: `docs/FIGURE_SPEC.md`(§3.2·§3.7·§11.2·§12.3·§13·§15.5·§15.6), `docs/FIGURE_DESIGN.md`(§4.2·§5·§6.3·§7.2·§8·§15 P19), 본 장부

**게이트**: 루트 typecheck → lint → test → build 모두 exit 0. api 46 파일/590 테스트, web 93 파일/746 테스트. 기존 테스트 삭제·완화 없음.

**헤드리스 브라우저 확인**: `pnpm dev`를 띄우고 Chromium 1194×834 @2x로 확인했다. 확인 후 서버는 종료했다. 물리 iPad가 아니다.

- 스크린샷 위치: `/private/tmp/claude-501/-Users-soojin-Library-CloudStorage-OneDrive----vibeStudy-WhyMath/7434daa8-697d-4475-bfe0-8acc05c1aed7/scratchpad/rework1/`
  - F02 최종·s2, F03, F04, F05, F06, F07 s3·최종, F08 s2, F09 s2·최종(각 380/708)
  - `v2_*`: 격자 수정 후 다시 찍은 것
  - `v2_F07_s3_narrow200.png`: 폭 200px 축소
- 콘솔 오류 0.
- 직각 표시가 강조 언더레이 위에 보인다(F09 s2).
- 점 라벨이 선과 겹치지 않는다(F02 A·H, F04 O·M, F05 O·T2, F09 B·H·M, F07 R1·R2).
- F07 x 눈금 1·3이 생략되고, 가장자리에 걸린 눈금이 없다.

**남은 관찰(자체, 결정 필요)**: F08 s2에서 y 눈금 "2"와 x 눈금 "1"이 강조된 점근선(y = 2, x = 1) 위에 놓인다. halo 덕분에 읽히지만 겹친다. 이번 지시 범위(점·라벨과 겹치는 눈금 생략)가 아니어서 그대로 두었다. 강조된 선과 겹치는 눈금도 생략할지는 design-agent 판단이 필요하다.

### 4.6 Stage 2 QA 재검증 (stage-qa-agent, 2026-10-24, 재작업 1/3 이후)

- **판정: PASS(자동 검사 + 헤드리스 브라우저 범위)** — BLOCKER·HIGH·MEDIUM 없음, LOW 아래. 물리 iPad는 확인하지 않았으며 실기기 PASS가 아니다. design-agent 사후 재검수는 이 판정 범위 밖이다.
- 재검증 범위: §4.3의 MEDIUM 2건·LOW 항목, 새 규칙의 오거부, 기존 테스트 완화 여부, 금지 영역 diff, 게이트 4종, 헤드리스 브라우저(Chromium+WebKit).

**자동 검사**

| 항목 | 결과 |
|---|---|
| 게이트(루트 직접 실행) | typecheck exit 0, lint exit 0, build exit 0. **test는 첫 실행에서 `jsxgraph.smoke.test.ts` 1건이 5000ms 타임아웃으로 실패(exit 1, web 745/746)했고, 같은 코드 그대로 격리 재실행 2회(`pnpm -F web test`, 전체 `pnpm test`)는 exit 0**: api 46 파일/590, web 93 파일/746. 스모크 단독 실행은 1.16초 → 부하 때 실제 JSXGraph 1MB 모듈 로딩이 5초 한도를 넘는 플레이크(LOW 1) |
| 금지 영역 diff | `apps/api/src/{infrastructure,modules}`, prompts, `supabase`, `apps/web/src/{pages,features,shared}`의 기존 파일 0. `git diff --numstat`의 기존 수정 파일은 전부 삭제 0, `env.test`/`problemHistory`/`solveProblem` 추가 줄 수가 1차 QA와 동일(41/31/50). 새로 수정된 추적 파일은 `packages/validation/package.json`(exports 6줄 추가)뿐 |
| 기존 테스트 삭제·완화 | `.skip/.todo/.only/xit/test.fails/testTimeout` 0건. Stage 1 `figureSpec.contract.test.ts` mtime 20:46 그대로(무수정). 테스트 수 api 565→590, web 725→746(감소 없음). `jsxgraph.smoke.test.ts`는 import 경로·시그니처만 변경 |
| S2-5(Map 기반 ID) 입력 조정 | 완화 아님으로 판정. 입력만 `hide: ["toString","valueOf","isPrototypeOf"]`로 바뀌고 단언(`issues` 빈 배열, 중점 valueOf=(2,0))은 그대로. 이유 규칙이 실제로 존재함을 직접 확인(아래 `hide M but keep dependent seg` 재현에서 같은 입력이 `dependency_not_visible`) — 이 테스트의 목적(Object.prototype 이름 ID가 일반 ID처럼 동작)은 그대로 검증된다 |
| `validation` exports | `.`, `./fixtures`, `./src/figures/fixtures`, `./package.json`. 호환 경로가 남아 Stage 1 테스트 3개 수정 없이 통과(typecheck·build·test 확인). 레포 안 `validation/` 깊은 import는 전부 위 경로뿐 |
| grep `eval\(\|new Function\|Function\(` | `packages/validation`, `features/figure-visualization` 0건 |
| 운영 dist(재빌드) | `fig-f01`·`fig-f11`·`삼각형과 각`·`FigurePreviewPage`·`dev/figures`·`initBoard`·`freeBoard`·`JXG` 0건. 검증 커널 문자열(`forward_reference`·`dependency_not_visible`·`line_out_of_view`)도 0건. `JSXGraph`는 `dist/licenses/THIRD_PARTY_NOTICES.txt`만. 메인 번들 966,973 B(이전 966,852 B), precache 8 entries 1014.68 KiB. 빌드 CSS에 `overflow-wrap:anywhere` 포함 |
| 이전 재현 스크립트 재실행 | 수학 독립 재계산(F01~F09) 전부 일치. 무작위 접점·각·수선의 발·교점 위반 0. 샘플러 16종 조각 내 비유한수 0·다리 0. 문서 §11·§11.2 파싱 대조 **45/45**(F10a~c + F11a~ap 42) 정확한 code·path 거부. 적대적 입력 약 60건·getter/Proxy/null 입력 throw 0 |

**이전 이슈 해소 확인**

| 이슈 | 결과 | 재현 |
|---|---|---|
| MEDIUM-1 화면 밖·극단 `lineEquation` | **해소** | `a=b=1e-300,c=1e6`→`degenerate`, `a=1e-6,c=1`(x=1e6)·`x+y=1e6`·`y=100`·`x=5.5`(bbox ±5)→`line_out_of_view`, a=b=0→`degenerate`. 같은 입력의 렌더에서 나던 `cx=Infinity` 콘솔 오류는 입력이 거부돼 더 이상 나오지 않음 |
| MEDIUM-2 긴 무공백 description | **해소** | 500자 `W`: figcaption 348/348, 페이지 scrollWidth 1194/1194(이전 5609/5649). computed `overflow-wrap: anywhere`. 한글은 그대로 정상 |
| LOW-1 의존 가시성 | **해소(아래 LOW 2·3 잔여)** | 끝점보다 먼저 등장하는 선분→`dependency_not_visible at elements.7.appearAt`, 끝점만 hide→`... at steps.1.hide.0` |
| LOW-2 라벨 비가시 문자 | **해소** | U+2060·U+00AD·U+FE0F·U+E0041·U+3164·U+180E 전부 스키마 거부(`$x^2$`·`\(x\)`·`'+alert(1)+'`·`{{7*7}}`·`A_{1}^{2}`는 계속 허용, 실제 JSXGraph에서 글자 그대로 SVG text, 주입 요소 0, alert 없음). 렌더러 sanitize는 같은 함수 사용 |
| LOW-3 번들 서술 | 정정됨(§4.2). 실제 dist: 구조 스키마만 남고 커널 없음 |
| LOW-5 원문 AC | §4.4에 보존됨. R-9(dev 전용·dist 0건)·R-11(버전·라이선스·dist 고지) 직접 확인 PASS |

**새 규칙 오거부 점검**

- F01~F09 전부 `parseSolutionFigures` 통과. 추가 정상 사례도 통과: `y=0`, `x=0`, 모서리를 지나는 `x+y=10`(bbox ±5), 가장자리 `x=5`, 허용오차 내 `x=5.004`, 작지만 정상인 계수(`1e-7·x=0`, `1e-4·x=1e-4`), `a=b=1000`, 기울기 0.001, bbox [90,110]의 `x=100`, bbox 0.02의 `y=0.015`, bbox ±5000의 `y=5000`, 모서리 선분·직선·반직선, 보조 선분+점을 함께 hide, 의존 선분만 hide(점은 유지).
- 오거부 없음. 경계 관찰은 LOW 2·3.

**헤드리스 브라우저(R-10) 재확인** — Chromium·WebKit 1194×834, 물리 iPad 아님

- `/dev/figures`: 도형 카드 18개 = SVG 18 = JXG 보드 18(StrictMode), 콘솔 오류 0, 저작권·이동 버튼·좌표 상자 없음, 인라인 touch-action 0, Tab 가능 요소 0, Arial 0.
- 단계 칩 전환: 모든 칩에서 SVG 노드 유지(재생성 0), 보드 18 유지. 리사이즈(260→180→120→380px): 노드 유지·단위 비율 동일·높이 120 하한, 폭 0 해제/복귀 정상, 오류 0.
- 거부 fixture 52행(F10 10 + F11 42): 대체 문구 45(F10a~c + F11 42), 사유만 7(F10d~j), SVG 0, `role=alert` 0. JSXGraph 청크 차단 시 18개 모두 대체 문구+설명.
- 보드 위 휠 스크롤 0→400, 드래그로 bbox 불변, `defaultPrevented` 모두 false(두 엔진).
- 육안(스크린샷): F09 s2 직각 표시가 H 옆에 보이고(강조 언더레이 위), 점 라벨이 선과 겹치지 않음(A·B·C·H). F07 s3 눈금 1·3이 R1·R2 점 때문에 생략돼 겹침 없음, 화살표·축 이름 정상. F08 s2도 불연속 유지(`browser3` 가시 요소 수 변동은 장식 분리 때문).

**잔여(LOW, 비차단)**

1. `jsxgraph.smoke.test.ts` 기본 5000ms 타임아웃 플레이크: 게이트 첫 실행 1회 실패(재실행 2회 통과). 해결 제안: 이 테스트에 명시 타임아웃(예: 15s) — 단언 변경 없음. 실패 상태로 게이트를 통과로 표시하지 말고, 재현되면 다시 보고할 것.
2. 의존 규칙 구멍: 숨긴 요소에 의존하는 요소가 **이후 단계에 등장**하는 경우(`dependent appears after dependency was hidden`)는 통과한다.
3. 의존 규칙 설계 판단: F06에서 두 직선(l1, l2)을 숨기고 교점 P만 남기는 구성은 `dependency_not_visible`로 거부된다(P는 계산 좌표만 필요). 교육적으로 가능한 패턴이라 Stage 3 프롬프트에서 “의존 요소도 같이 숨긴다” 규칙을 AI에 알리거나 이 규칙을 완화할지 오너 판단이 필요.
4. F07(380 폭) y 눈금 “4”가 포물선과 겹침, F08 s2 눈금이 강조된 점근선 위에 놓임(개발 기록 §4.5 “남은 관찰”과 동일) — 실기기 시각 확인 대상.
5. Stage 3 인계: 의존 규칙·`line_out_of_view`가 AI 출력에서 얼마나 거부를 만드는지 측정할 것.

**미확인(물리 iPad 필요, Stage 4)**: 터치 스와이프 페이지 스크롤, 손가락·Apple Pencil 상호작용, Split View·회전, VoiceOver, 실제 글꼴·라벨 겹침의 시각 품질. design-agent 사후 재검수 결과도 본 판정에 포함되지 않는다.

### 4.7 Stage 2 후속 정리 (development-agent, 2026-10-24 — 재작업 횟수에 넣지 않음)

Stage 2 PASS 이후 design 재검수(P2-A, P3-B)와 stage-qa 재검증 LOW 항목 정리. 자체 검증 결과다.

| 항목 | 처리 | 테스트·근거 |
|---|---|---|
| design P2-A 직각 표시 실선 | `rightAngleMark`의 square 각은 role과 관계없이 dash 0. 색·굵기는 role. FIGURE_DESIGN §4.2에 "직각 표시는 항상 실선" 추가 | `FigureView.test.tsx` "후속 정리 — 직각 표시는 항상 실선": auxiliary 직각은 dash 0·brand·1.5, 직각 아닌 auxiliary 호는 dash 2 |
| design P3-B 문서 | FIGURE_DESIGN §6.3 점 라벨 행은 재작업 1에서 이미 `labelPlacement` 규칙으로 바뀌어 "autoPosition: true" 문구가 남아 있지 않음을 확인(두 문서 모두 "autoPosition은 쓰지 않는다"만 남음). **P19 기록**: 축 화살표 8×8px, x 눈금 숫자 축 아래 5px, y 눈금 숫자 축 왼쪽 4.5px, x축 이름 오른쪽 끝 5px·축 위 8px, y축 이름 축 오른쪽 7.5px·위 끝 6px — **오너 승인 시안(Function.dc.html)에서 측정**(FIGURE_DESIGN §15 P19, §5) | — |
| QA LOW 1 스모크 플레이크 | `jsxgraph.smoke.test.ts`에 명시 타임아웃 15,000ms. 단언 무수정 | 루트 `pnpm test` 1회 통과 |
| QA LOW 2 의존 규칙의 구멍 | 이미 숨긴 요소에 의존하는 요소가 그 뒤(또는 같은) 단계에 등장하면 `dependency_not_visible`(path `elements.<i>.appearAt`) | F11aq, 계약 테스트 |
| QA LOW 3 점류 완화(오너 결정) | 점류(midpoint·foot·intersection·tangentPoint·pointOnGraph)는 부모가 숨겨져도 보일 수 있음 — "함께 숨김"(②)·"숨긴 뒤 등장"(③) 규칙에서 제외. "부모보다 먼저 등장"(①)은 점류에도 그대로. 선분·직선·반직선·원·다각형·각은 기존 규칙 유지. FIGURE_SPEC §3.7·§13 갱신 | 계약 테스트: F06 l1·l2 숨기고 P만 남김 통과, F07 그래프 숨기고 점 남김 통과, F06 P가 직선보다 먼저 등장하면 거부 |
| QA LOW 4 F07(380) y 눈금 "4"와 포물선 겹침 | **결정(design-agent 의견)**: 선·곡선과 겹치는 눈금 숫자는 halo로 처리하고 생략하지 않는다. 생략은 점 마커·점 라벨·축 이름·가장자리 12px 띠와 겹칠 때만(§4.5). 코드 변경 없음 | — |

**변경 파일**: `apps/web/src/features/figure-visualization/applySceneToBoard.ts`, `.../jsxgraph.smoke.test.ts`, `.../FigureView.test.tsx`, `packages/validation/src/figures/semantics.ts`, `packages/validation/src/figures/fixtures/invalidStage2.ts`(F11aq), `apps/api/src/contracts/figureSemantics.contract.test.ts`, `docs/FIGURE_DESIGN.md`(§4.2), `docs/FIGURE_SPEC.md`(§3.7·§11.2·§13·§15.6), `docs/PROJECT_STATUS.md`(§3.41·§5), 본 장부.

**QA 검증(§4.7, stage-qa-agent, 2026-10-24): PASS** — 게이트 4종 루트 직접 실행 모두 첫 실행 exit 0(api 595·web 748), 지난 LOW 2 재현(선분이 숨긴 끝점 뒤 등장)은 거부되고(점류인 midpoint가 뒤에 등장하는 입력은 오너 예외라 통과) LOW 3(F06 l1·l2 숨기고 P 유지)은 통과, 점류 예외 사슬(P를 숨기면 의존 선분 거부, P가 보이면 의존 선분 통과, 부모 선 숨김 뒤 선분 등장 거부)에 의도 밖 구멍 없음, 삭제 줄 0·skip/only 0·smoke 단언 불변(타임아웃 15s만), 브라우저에서 auxiliary 직각 표시 dash 없음(실선), 콘솔 오류 0, dist fixture·커널 0건 — 실기기 미확인.

## 5. 남은 결정 사항

1. Stage 3: 풀이가 자유 텍스트 스트리밍이므로 figures를 별도 구조화 출력 호출로 받을지, 스트림 말미 JSON 블록으로 받을지(지연·비용·불완전 JSON 처리).
2. `problemHistoryDetailSchema.solution.figures`는 `z.array(z.unknown())`라 비배열 값이 저장돼 있으면 상세 조회 전체가 실패한다. 서버가 검증된 배열만 저장하는 한 문제없지만, Stage 5 저장 설계 시 재확인.
3. `FIGURES_ENABLED`를 `render.yaml`/`docs/DEPLOYMENT.md`에 추가하는 시점(Stage 3 이후 권장).
4. `docs/API_SPEC.md`의 solve/resume/history 응답 계약 갱신은 실제로 figures를 반환하는 Stage 3에서 반영.

> Stage 3 처리(2026-10-24): 1번은 D1(done 뒤 별도 구조화 호출 + `event: figures`)로 결정·구현. 3번은 `docs/DEPLOYMENT.md`에 설명만 추가하고 `render.yaml`은 바꾸지 않음(운영 off, D9). 4번은 solve·resume만 `docs/API_SPEC.md`에 작성(D7) — history 응답은 Stage 5 저장과 함께. 2번은 Stage 5에서 재확인.

## 6. Stage 3 — 풀이 AI API 연결

- 승인된 계획: `.omc/plans/figures-stage3.md`(plan-agent 계획 + resume 보완 + 오너 결정 D1~D10)
- 루프: plan-agent(완료) → development-agent(완료, 2026-10-24) → stage-qa-agent(대기)

### 6.1 WU 진행 상태 (development-agent, 2026-10-24)

| WU | 내용 | 상태 |
|---|---|---|
| 기준값 | off 상태 바이트 기준값을 **변경 전 코드**에서 캡처: `apps/api/src/contracts/__baseline__/figuresOff.baseline.json`(solve SSE 4조합, resume SSE own·alternative, `buildSystemPrompt` 6학년, `buildResumePrompt` 6×2, OpenAI solve/resume 요청 본문·이벤트) | 완료 |
| WU0 | 스키마 probe·문서 확인 | 완료 — 공식 문서 확인(§6.2), 실제 호출 4회, 결과 `.omc/research/figures-stage3-probe.json` |
| WU1 | `packages/validation/src/figures/{steps,candidate}.ts` + 계약 테스트 `figureCandidate.contract.test.ts`(S3-7·8·9) | 구현·자체 테스트 통과 |
| WU2 | `prompts/system.ts` stepMarkers 옵션, `prompts/figures.ts`(생성·보정 프롬프트, priorWork 빌더) | 구현·자체 테스트 통과(`prompts/figures.test.ts`) |
| WU3 | `adapter.ts` 인터페이스, `figuresJsonSchema.ts`(+S3-12 테스트 통과), `openai-adapter.ts`, `fake-adapter.ts` 시나리오 | 구현·자체 테스트 통과(`openai-adapter.figures.test.ts`, `fake-adapter.figures.test.ts`, `figuresJsonSchema.test.ts`) |
| WU4 | `modules/figures/generateSolutionFigures.ts` | 구현·자체 테스트 통과(`generateSolutionFigures.test.ts`) |
| WU5·5b | `solutions.router.ts`·`resume.router.ts` + `modules/figures/streamFigures.ts`. off 바이트 동일 테스트 `figuresOff.baseline.test.ts` 통과 | 구현·자체 테스트 통과(`solutions.router.figures.test.ts`, `resume.router.figures.test.ts`). api 697 테스트 통과 |
| WU6 | 웹 `shared/api/{solveProblem,resumeProblem,parseFiguresEvent}.ts`, `features/ai-solution/{useSolveStream,useResumeStream}.ts`, 테스트 추가(기존 단언 삭제 0) | 구현·자체 테스트 통과(web 758), build grep S3-14 확인 |
| WU7 | 문서 | 완료(§6.4 변경 파일) |
| WU8 | 실제 모델 평가 1회 + 텍스트 회귀 확인 | 완료(§6.6). 평가에서 on 전용 텍스트 문제 1건 발견 → on 전용 프롬프트 수정 → 표적 재확인(§6.6.3) |
| 게이트 | 루트 typecheck → lint → test → build | 통과(§6.7) |

### 6.2 WU0 확인 결과

- OpenAI 공식 문서 **확인함**: https://developers.openai.com/api/docs/guides/structured-outputs (`platform.openai.com/docs/guides/structured-outputs`에서 리다이렉트, 2026-10-24 조회). 요약은 `docs/FIGURE_SPEC.md` §16.5.
- SDK: `openai@7.4.0` 설치본 `internal/request-options.d.ts`에서 요청별 `maxRetries`·`timeout`·`signal` 확인, `ResponseOutputRefusal { type: "refusal" }`, `ResponseStatus`에 `incomplete` 포함.
- probe(실제 호출 4회, 모델 `gpt-5.6-terra`): 최소 재귀 스키마 수락 / **전체 봉투 스키마 strict 수락**(5.1초, 입력 2,170·출력 566토큰) / `max_output_tokens: 16` → `status: "incomplete"`, `reason: "max_output_tokens"`, `output_text` 빈 문자열 / 요청별 signal 취소 → `APIUserAbortError`. 거부(refusal)는 재현 못 함(문서·타입 기준 처리). 원본 `.omc/research/figures-stage3-probe.json`(키 없음).
- probe에서 나온 도형은 `boundingBox`의 top/bottom을 뒤집어 zod에서 거부됐다 → 생성 프롬프트에 순서 규칙(`top > bottom`)을 명시했다.

### 6.3 design-agent 생략 근거와 Stage 4 design 인계

- **생략 근거**: Stage 3은 서버 API·검증·웹 데이터 계층(SSE 클라이언트·훅)만 바꿨고 `pages/*`·`shared/ui/*`·`features/figure-visualization/*`·`ResultCard`·`ResumeResultCard`는 diff 0이다. 새 로딩·실패 UI를 만들지 않았고 도형을 화면에 그리지 않는다(`Prompt/15` §2.3 실행 조건 해당 없음). 운영 플래그도 off다.
- **Stage 4 design-agent 인계(필수)**:
  1. done 이후 "도형 준비 중" 구간(텍스트는 끝났는데 figures가 아직 안 옴)과 "도형 없음"으로 끝나는 경우의 표시 방식. figures 이벤트는 받아들인 도형이 있을 때만 오므로, 클라이언트는 스트림 종료로 "도형 없음"을 안다(현재 훅은 스트림 종료 상태를 따로 노출하지 않음 — Stage 4 계획에서 결정).
  2. `docs/FIGURE_DESIGN.md` §9 전제 변경(figures가 done과 함께 온다는 서술은 더 이상 사실이 아님, 정정 주석 추가함).
  3. `**N단계**` 표지의 표시·제거 방식 — `ResultCard`·`ResumeResultCard`는 `renderMathText`(KaTeX만)라 플래그 on이면 별표가 그대로 보인다. 운영 off라 현재 문제 없음.
  4. 이어풀기 결과 카드(`ResumeResultCard`)의 도형 배치.

### 6.4 변경 파일

| 구분 | 파일 | 내용 |
|---|---|---|
| validation | `packages/validation/src/figures/steps.ts`(신규) | `splitSolutionSteps`, `checkFigureStepRange`, `stepNumber` |
| validation | `packages/validation/src/figures/candidate.ts`(신규) | `validateFigureCandidate`, `toRepairErrors`, `checkMeasureConstraints`(`measure_without_constraint`), `readCandidateFigureId` |
| validation | `packages/validation/src/figures.ts` | 위 두 파일 재export 2줄만 |
| api | `apps/api/src/infrastructure/ai/adapter.ts` | `SolveRequest.stepMarkers?`·`ResumeRequest.stepMarkers?`, `FigureCallContext`·`GenerateFiguresRequest`·`RepairFigureRequest`·`FigureCallResult`, `generateFigures`·`repairFigure` |
| api | `apps/api/src/infrastructure/ai/figuresJsonSchema.ts`(신규) | 봉투·보정 strict JSON Schema(`$defs.figure`·`$defs.expr`) |
| api | `apps/api/src/infrastructure/ai/openai-adapter.ts` | solve/resume에 stepMarkers 전달, 도형 호출 2종(stream false·strict·maxRetries 0·timeout·signal·incomplete/refusal/비JSON throw) |
| api | `apps/api/src/infrastructure/ai/fake-adapter.ts` | `figureScenario` 7종, stepMarkers on일 때만 3단계 청크(F07 s1~s3). off 경로 바이트 동일 |
| api | `apps/api/src/infrastructure/ai/prompts/system.ts` | `buildSystemPrompt(grade, { stepMarkers })`, `buildResumePrompt(grade, mode, { stepMarkers })` — off 문자열 불변 |
| api | `apps/api/src/infrastructure/ai/prompts/figures.ts`(신규) | 생성·보정 프롬프트, 고정 힌트, `buildPriorWork` |
| api | `apps/api/src/modules/figures/generateSolutionFigures.ts`(신규) | 오케스트레이터(throw 없음) |
| api | `apps/api/src/modules/figures/streamFigures.ts`(신규) | done 뒤 keep-alive·figures 이벤트, 연결 끊김 abort |
| api | `apps/api/src/modules/solutions/solutions.router.ts`, `apps/api/src/modules/resume/resume.router.ts` | `{ figuresEnabled = env.figuresEnabled, keepAliveMs, figuresTotalBudgetMs }` 주입, done 뒤 도형 단계 |
| api | `apps/api/src/config/env.ts`(주석만), `apps/api/.env.example`(주석) | 플래그 설명 |
| api | `apps/api/scripts/evalFigures.ts`(신규, 게이트 밖) | 실제 모델 평가(`EVAL_DRY_RUN=1`이면 Fake로 비용 0) |
| api 테스트 | `contracts/figuresOff.baseline.test.ts` + `contracts/__baseline__/figuresOff.baseline.json`(변경 전 캡처), `contracts/figureCandidate.contract.test.ts`, `infrastructure/ai/{figuresJsonSchema,openai-adapter.figures,fake-adapter.figures}.test.ts`, `infrastructure/ai/prompts/figures.test.ts`, `modules/figures/generateSolutionFigures.test.ts`, `modules/{solutions/solutions,resume/resume}.router.figures.test.ts` | 모두 신규 파일 |
| web | `apps/web/src/shared/api/parseFiguresEvent.ts`(신규), `solveProblem.ts`, `resumeProblem.ts` | `{ type: "figures" }`, 깨진 이벤트 무시, 검증기 import 없음 |
| web | `apps/web/src/features/ai-solution/useSolveStream.ts`, `useResumeStream.ts` | done에서 resolve, 백그라운드 소비, figures 병합, done 후 오류 삼킴, 요청 세대 가드 |
| web 테스트 | `useSolveStream.test.tsx`, `useResumeStream.test.tsx`, `ProblemInputProvider.test.tsx`, `solveProblem.test.ts`, `resumeProblem.test.ts` | **추가만**(`git diff --numstat` 삭제 줄 0) |
| 문서 | `docs/API_SPEC.md`(0바이트 → solve·resume), `docs/FIGURE_SPEC.md`(머리말·§2·§4·§9·§13·§16), `docs/PRD_WHYMATH.md`(FIG-11), `docs/FIGURE_DESIGN.md`(§9 사실 정정 주석), `docs/DEPLOYMENT.md`(플래그 행), `docs/PROJECT_STATUS.md`(§3.41·§5), 본 장부 | |
| 연구 기록 | `.omc/research/figures-stage3-probe.json`, `figures-stage3-eval.json`, `figures-stage3-textcheck.json` | 키 값 없음(grep 확인) |

변경 금지 파일 diff 0 확인: `parseSolveOutput.ts`·`parseResumeOutput.ts`·`resolveSolutionContext.ts`·`inMemoryProblemStore.ts`·`infrastructure/cas/*`·`problemRepository.ts`·`supabase/migrations/*`·웹 `pages/*`·`shared/ui/*`·`features/figure-visualization/*`·`ResultCard.tsx`·`ResumeResultCard.tsx`·`render.yaml`. 새 npm 의존성 없음.

### 6.5 수용 기준별 자체 결과 (development-agent 자체 검증 — QA 판정 아님)

| AC | 자체 결과 | 근거 |
|---|---|---|
| S3-1 | 자체 테스트 통과 | `figuresOff.baseline.test.ts`: solve SSE 4조합이 **변경 전 캡처 기준값과 바이트 동일**, generateFigures·repairFigure 0회, done에 figures 키 없음, `saveSolution`이 done payload 그대로로 1회, `buildSystemPrompt(grade)` 6학년 불변, OpenAI 요청 본문·이벤트 불변(요청별 옵션 인자도 없음) |
| S3-2 | 자체 테스트 통과 | `solutions.router.figures.test.ts`: chunk*→done→figures→종료, done 키 집합이 off와 같고 어댑터 결과와 deep-equal, figures 재파싱 deep-equal·rejected 0·페이로드 키 `{figures, stepFigureRefs}`만, refs는 수용 도형만 |
| S3-3 | 자체 테스트 통과 | 오케스트레이터·라우터: 2개 중 1개 무효 → 그 도형만 보정 1회, 생성 1회, 순서 유지 |
| S3-4 | 자체 테스트 통과 | 보정 실패·throw·null → 그 도형만 제외, 나머지·refs·텍스트 유지, error 0 |
| S3-5 | 자체 테스트 통과 | 어댑터: incomplete·failed·refusal·비JSON·SDK 오류 → throw(호출 1회). 라우터: throw·hang(타임아웃) → figures 0·error 0·정상 종료 |
| S3-6 | 자체 테스트 통과 | null·문자열·배열·`figures` 비배열·빈 객체 → `malformed`, 보정 0 |
| S3-7 | 자체 테스트 통과 | `splitSolutionSteps` 경계(표지 없음·건너뜀·중복·역순·0·줄 중간·들여쓰기·s99·100), s(N+1) → `step_out_of_range` → 보정 대상, 분할 실패 → refs `[]`·도형 유지 |
| S3-8 | 자체 테스트 통과 | `toRepairErrors`(모르는 code → invalid, path 조각 정제, 10건), 보정 user JSON의 errors에 인젝션 문자열 0, 시스템 메시지에 문제·풀이·학생 텍스트 0, user는 JSON 하나 |
| S3-9 | 자체 테스트 통과 | `verified`·스타일 키 → `unrecognized_keys`로 거부·보정도 같으면 제외, 결과 직렬화에 추가 키 0, 수용 도형은 입력과 다른 zod 출력 객체 |
| S3-10 | 자체 테스트 통과 | 실제 HTTP 서버에서 done 수신 후 소켓 종료 → 도형 호출 signal aborted, close 후 write 0(쓰기 감시 미들웨어). 변이 확인: abort를 지우면 테스트 실패 |
| S3-11 | 자체 테스트 통과 | 요청별 `{ maxRetries: 0, timeout: 30000, signal }`, create 1회, 라우터 요청당 생성 1회 |
| S3-12 | 자체 테스트 통과 | `figuresJsonSchema.test.ts`: 루트 object, 모든 객체 additionalProperties false·required = 전 키, `$ref`는 figure·expr만, expr 재귀, 미지원 키워드 0, 요소 12·제약 7·interaction 2·expr 6 변형의 판별자·키 집합이 zod shape와 일치. WU0 probe에서 실제 strict 수락 |
| S3-13 | 자체 테스트 통과 | figures 병합, 깨진 이벤트 무시, done에서 resolve(Provider 테스트: 스트림이 열린 채로 추천 질문 요청 — 옛 훅으로 되돌리면 실패하는 것 확인), done 후 error·네트워크 오류에 status 유지, 새 요청·reset 뒤 이전 figures 무시. 기존 화면 테스트 무수정 |
| S3-14 | 자체 확인 | `vite build` 산출물 JS에 `dependency_not_visible`·`line_out_of_view`·`measure_without_constraint`·`step_out_of_range` 0건. 메인 번들 966,973 → 967,760바이트(+787B, +0.08%). 비교 기준은 작업 시작 전 있던 dist(2026-10-24 22:53 빌드) |
| S3-15 | 작성 | §6.4 문서 |
| S3-R1 | 자체 테스트 통과 | resume SSE own·alternative 기준값과 바이트 동일, generateFigures 0, `buildResumePrompt` 12조합 불변 |
| S3-R2 | 자체 테스트 통과 | own·alternative: chunk*→done(CAS verified)→figures→종료, done 키 집합 off와 같음, CAS 호출 인자 불변 |
| S3-R3 | 자체 테스트 통과 | hang에서도 done이 keep-alive보다 먼저, `setResumeSolution` 1회·인자 = done payload, 도형 호출은 저장 뒤 시작 |
| S3-R4 | 자체 테스트 통과 | throw·malformed·invalid-twice·incomplete(어댑터 throw) → figures 0(또는 유효 도형만)·error 0, 연결 끊김 → aborted |
| S3-R5 | 자체 테스트 통과 | 이어풀기 refs s1~s3, own에서도 s1 = 이어 쓴 첫 단계(lastValidLine 2여도) |
| S3-R6 | 자체 테스트 통과 | own: lineNo ≤ lastValidLine·stallLine 미만만, 무효 줄 0, alternative null, 30줄·300자 상한, 인젝션 줄은 user JSON에만·시스템 메시지 0 |
| S3-R7 | 자체 테스트 통과 | Fake 표지 on: `## 최종 답` = `-1`(순수 LaTeX), `parseResumeOutput` 섹션 분리 정확 |
| S3-R8 | 자체 테스트 통과 | 병합, done에서 resolve·추천 질문 직후, 깨진 이벤트 무시, 모드 재요청 시 이전 figures 무시 |
| S3-INT | 평가 실행·지표 기록(§6.6). 필수 조건: 미검증 도형 전달 **0**. 텍스트 경로: on 전용 문제 1건(개념 분류 JSON 위치) 발견 → on 전용 프롬프트 수정 → 표적 재확인 0/6 | 판정은 stage-qa |
| G | §6.7 | |

### 6.6 실제 모델 평가 (WU8, 모델 `gpt-5.6-terra`, 2026-10-24, 1회 실행)

- 스크립트 `apps/api/scripts/evalFigures.ts`, 원본 `.omc/research/figures-stage3-eval.json`. 사례 22건(solve 18 = 도형 필요 10 + 불필요 6 + 적대 2, resume 4). 사례마다 실제 흐름(표지 on 풀이 스트리밍 → `generateSolutionFigures`). 기대 좌표는 손 계산.

#### 6.6.1 지표

| 지표 | solve | resume | 전체 |
|---|---|---|---|
| 생성률(도형 필요 사례 중 수용 ≥1) | 12/12 (적대 2 포함) | 4/4 | 16/16 |
| 오생성률(불필요 사례 중 수용 ≥1) | 0/6 | — | 0/6 |
| 후보 수 | 12 | 4 | 16 |
| 1차 통과율 | 12/12 | 4/4 | 16/16 |
| 보정 시도 / 성공 | 0 / 0 | 0 / 0 | 0 / 0 (실제 모델에서 보정 경로는 한 번도 실행되지 않음 — 단위 테스트로만 검증) |
| 최종 수용률 | 12/12 | 4/4 | 16/16 |
| 거부 코드 분포(1차·최종) | 없음 | 없음 | 없음(`line_out_of_view` 0, `dependency_not_visible` 0) |
| 단계 표지 준수율(`splitSolutionSteps` 성공) | 17/17 | 4/4 | 21/21 (X4는 `## 풀이` 섹션 자체가 없어 분모 제외 — `empty`) |
| `step_out_of_range` | 0 | 0 | 0 |
| 핵심 좌표 vs 독립 기대값(1e-6) | 11/11 | 2/2 | 13/13 |
| bbox 대비 내용 넓이 비(측정만) | p50 0.50, 최소 0(A1: 점 3개가 한 직선 위라 넓이 0 — 측정 방식의 한계), 최대 1(함수 그래프) | p50 0.50, 0.44~0.52 | p50 0.50 |
| done 이후 추가 시간(도형 단계) p50 / p95 / 최대 | 5,636 / 16,126 / 16,126 ms | 8,822 / 14,260 / 14,260 ms | 6,383 / 14,260 / 16,126 ms |
| 도형 호출 수 | 18 | 4 | 22 (생성만, 보정 0) |
| 도형 호출 토큰(입력 / 출력) | 65,661 / 10,891 | 14,787 / 4,704 | 80,448 / 15,595 |
| 미검증 도형 전달 | 0 | 0 | **0** |
| 불필요 사례 omitReason | not_helpful 3(계산·인수분해·확률), insufficient_info 2(그림 정보 없음·수치 불명확), unsupported 1(정육면체) | — | |
| 적대 검사 | A1 인젝션: verified 없음·AB=100 조건 0 / A2 "보이는 5": AB 길이 조건은 4(derived)뿐, 5를 조건으로 둔 것 0 | R4 무효 줄 함정: `equalLength(AB, AC)` 0건 | 3/3 통과 |

- 비용: `gpt-5.6-terra`가 공식 가격표(https://developers.openai.com/api/docs/pricing, 2026-10-24 조회)에 없어 **계산하지 않음**(추정 금지).
- 품질 관찰(검증기 밖): N5(T1·T2)·N6(P)·N10(G)은 결과 점을 파생 요소가 아닌 자유 `point` 좌표로 두었다. N5는 `pointOnCircle`·`tangent` 제약이 있어 검증되지만, N6·N10은 관계 제약이 없어 좌표의 수학적 정확성은 검증기가 보장하지 않는다(이번 평가에서는 손 계산 기대값과 일치). Stage 4·5에서 "결과 점은 파생 요소(intersection·midpoint 등)로" 프롬프트 강화 검토 권장.
- 시간: 도형 단계 p95 약 14~16초. 호출별 타임아웃 30초·전체 상한 60초 안이며 타임아웃 0건.

#### 6.6.2 텍스트 경로 검사

평가 스크립트의 엄격 검사가 3건을 표시했다: N7·A2 `no_concept_tags`(개념 분류 JSON이 `## 최종 답` 제목 바로 아래로 와서 `parseSolveOutput`이 태그를 잃고 답에 JSON이 섞임), X4 `no_solution_header`·`empty_answer`(그림 정보 없는 문제).

#### 6.6.3 재실행 사유와 결과(표적 확인 12회, 도형 호출 없음) — `.omc/research/figures-stage3-textcheck.json`

- **사유**: 위 3건이 단계 표지(on) 때문인지 가리기 위해 같은 3문제의 풀이 텍스트만 off/on 1회씩 다시 호출(6회).
- 결과: off 3회 모두 태그 위치 정상, on 3회 중 1회(X4) 다시 태그가 `## 최종 답` 바로 아래 → on 전체로 보면 25회 중 3회 재현, off 0/3. X4의 `## 풀이` 없음은 **off에서도 재현**(그림 없는 문제라 풀이 섹션을 생략) → 회귀 아님. X4 평가 실행의 빈 답은 off·on 재확인에서 재현되지 않았다(평가 실행의 원문은 저장하지 않아 원인 미확정).
- **조치**: on 전용으로 `buildSystemPrompt`에 "개념 분류 JSON 줄은 `## 최종 답` 제목 바로 아래에 쓰지 않는다. 최종 답 문장을 모두 쓴 뒤 응답의 가장 마지막 줄에 한 번만 쓴다." 한 줄 추가(off 문자열 불변 — 기준값 테스트 통과). `parseSolveOutput`은 변경 금지라 건드리지 않았다.
- **수정 확인**: 같은 3문제 on 2회씩(6회) → 태그 위치 문제 0/6, 모두 태그 파싱 성공. 전체 평가(22건)는 비용 원칙에 따라 다시 돌리지 않았다 — 위 도형 지표는 수정 전 프롬프트 기준이다(수정은 답·태그 순서만 바꾼다).

### 6.7 게이트

저장소 루트에서 `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build` 순서로 실행, **모두 첫 실행 exit 0**(2026-10-24, 프롬프트 수정 이후). test: api 55 파일/697 테스트, web 93 파일/758 테스트. 기존 테스트 삭제·완화 0(수정된 기존 테스트 파일 5개 모두 삭제 줄 0). 평가 스크립트(`apps/api/scripts/`)는 게이트 밖이라 임시 tsconfig로 따로 타입 검사(오류 0)했다.

### 6.8 stage-qa 재현 방법

1. 저장소 루트: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
2. Stage 3 테스트만: `pnpm -F api exec vitest run src/contracts/figuresOff.baseline.test.ts src/contracts/figureCandidate.contract.test.ts src/infrastructure/ai src/modules/figures src/modules/solutions src/modules/resume`, `pnpm -F web exec vitest run src/features/ai-solution src/shared/api src/features/problem-input`.
3. off 바이트 동일: 기준값 `apps/api/src/contracts/__baseline__/figuresOff.baseline.json`은 Stage 3 코드 변경 **전**에 캡처했다. 독립 확인하려면 `git stash`(또는 커밋 2679651 체크아웃 워크트리)에서 같은 절차를 돌려 비교할 수 있다(캡처 절차는 `figuresOff.baseline.test.ts`와 같다).
4. 로컬 수동 확인(Fake, 비용 0): `apps/api/.env`에서 `AI_PROVIDER`를 비우고 `FIGURES_ENABLED=true`로 서버 실행 → 풀이 요청 SSE에서 done 뒤 `event: figures`(F07) 확인. `FIGURES_ENABLED`를 지우고 재시작하면 figures·keep-alive 0.
5. 평가 재현: `EVAL_DRY_RUN=1 pnpm -F api exec tsx scripts/evalFigures.ts`(Fake, 비용 0, `.omc/research/figures-stage3-eval.dryrun.json`). 실제 모델은 `pnpm -F api exec tsx scripts/evalFigures.ts`(약 44회 호출, 오너 승인 필요).
6. 번들: `pnpm -F web build` 후 `grep -l -e dependency_not_visible -e line_out_of_view apps/web/dist/assets/*.js` → 0건.
7. 변경 금지 파일: `git diff --stat -- apps/api/src/infrastructure/ai/parseSolveOutput.ts apps/api/src/infrastructure/ai/parseResumeOutput.ts apps/api/src/infrastructure/store apps/api/src/infrastructure/cas apps/api/src/infrastructure/persistence/problemRepository.ts supabase/migrations apps/web/src/pages apps/web/src/shared/ui apps/web/src/features/figure-visualization apps/web/src/features/ai-solution/ResultCard.tsx apps/web/src/features/ai-solution/ResumeResultCard.tsx render.yaml` → 출력 없음.

### 6.9 임시값(결정 필요)

| 항목 | 값 | 이유 / 확정 근거 |
|---|---|---|
| 생성 `max_output_tokens` | 8,000 | probe 1건 566토큰, 평가 평균 출력 약 700토큰(22회 15,595). 도형 3개·요소 60개 상한 여유. incomplete 0건 |
| 보정 `max_output_tokens` | 4,000 | 도형 1개만. 실제 보정 호출 0건이라 실측 없음 |
| 도형 단계 전체 상한 | 60초 | 호출별 30초 × 2(생성 + 보정). 평가 p95 14~16초 |
| keep-alive 간격 | 15초 | 프록시 유휴 타임아웃(흔히 30~60초)보다 짧게. 평가 p95가 이보다 길어 대부분 1회 이하 |
| priorWork 줄 수·길이 | 30줄·300자 | 한 장 풀이 20줄 안팎 가정 |
| 보정 대상 도형 JSON 길이 | 30,000자 | 요소 60개 도형 직렬화 약 10,000자 가정 |
| 호출별 타임아웃 | 30초 | 기존 `OPENAI_REQUEST_TIMEOUT_MS` 재사용(D10, 확정) |


### 6.10 Stage 3 QA 판정 (stage-qa-agent, 2026-10-24~25, 재작업 0/3)

**판정: PASS** (`Prompt/15` §2.5 기준 PASS — 단, 아래 "운영 플래그 on 전 조건" 2건을 Stage 4 진입 조건으로 이월). 실제 OpenAI는 새로 호출하지 않았다(비용). 실기기·브라우저 화면 검증은 해당 없음(Stage 3은 화면 변경 없음).

#### 6.10.1 독립 검증 방법

- **off 바이트 동일(S3-1·R1)**: 커밋 2679651을 `git worktree`로 scratchpad에 체크아웃(변경 전), 현재 작업 트리를 scratchpad에 복사해 각각 `pnpm install --offline`. 같은 캡처 스크립트(별도 작성, Express+supertest, Fake 어댑터, CAS 스텁)를 양쪽에서 실행해 JSON 40,880바이트를 `cmp`로 비교 → **완전히 동일**. 범위: solve SSE 4옵션 조합, resume SSE own·alternative × CAS 통과/불통과, resume 저장소 내용, `saveSolution` 호출 인자, `buildSystemPrompt` 6학년, `buildResumePrompt` 6학년×2모드, OpenAI solve/resume 요청 본문·이벤트. `FIGURES_ENABLED`를 `false`/`1`/`TRUE`/` true`/빈 값으로 바꿔도 동일, `true`로 두면 **달라짐**(비교가 공허하지 않음). 워크트리는 정리함(`git worktree list` = main만).
- **on 동작**: 별도 작성한 supertest/실제 HTTP 하니스에서 solve·resume-own·resume-alternative × Fake 시나리오 7종(valid, none, invalid-then-repaired, invalid-twice, throw, malformed, hang) = 21건 + 연결 끊김 2건 + priorWork/stepMarkers 확인 + done 뒤 예외·error 이벤트 + done 전 오류 + concept-only.
- **실제 SDK 재시도**: 로컬 가짜 HTTP 서버(500/429/무응답)에 실제 `openai` SDK를 붙여 `generateFigures`·`repairFigure` 서버 적중 수를 셈.
- **변이 시험**: 개발 테스트가 공허하지 않은지 11개 변이를 넣고 실패 여부 확인(아래; M5 "off 문자열 변조"는 패턴 불일치로 미실행 — off 바이트 비교의 민감도는 on/off 출력이 다르게 나오는 것으로 대신 확인).
- **게이트**: 저장소 루트에서 직접 실행.

#### 6.10.2 AC별 결과

| AC | 결과 | 근거 |
|---|---|---|
| S3-1 | PASS | 위 off 바이트 비교. generateFigures·repairFigure 0회, done에 figures 키 없음, `saveSolution`이 done payload 그대로 1회 |
| S3-2 | PASS | 21건 모두 이벤트 순서 `chunk*→done→(figures)`. done 1회, done 뒤 chunk·error 0, figures는 마지막. done 키 집합이 off와 같고 어댑터 결과·저장 인자와 같음. figures 페이로드 키 `{figures, stepFigureRefs}`만, 재파싱 `rejected` 0·deep-equal |
| S3-3 | PASS | invalid-then-repaired: 생성 1·보정 1, 도형 2개 유지 / 실제 SDK 하니스: 2개 무효+1개 유효 → 총 호출 3(생성 1+보정 2), figureId를 바꿔 돌려준 보정은 거부 |
| S3-4 | PASS | invalid-twice: 그 도형만 제외, 나머지·refs 유지, error 0. 보정이 throw해도 나머지 유지 |
| S3-5 | PASS | throw·malformed·hang → figures 0, error 0, 정상 종료. OpenAI 모의: incomplete·failed·refusal·비JSON·빈 출력·네트워크 오류 모두 `generate_failed` |
| S3-6 | PASS | malformed(`figures` 비배열) → 보정 0, 호출 1 |
| S3-7 | PASS | `splitSolutionSteps` 22개 경계(표지 없음·건너뜀·시작 2·중복·역순·0·01·줄 중간·들여쓰기·목록 기호·s99 성공·s100 실패·CRLF·빈 값·null·전각 숫자·코드펜스 안 표지 등) 모두 기대대로. F09에 단계 수 3 → 통과, 2 → `step_out_of_range` 3건 → 보정 1회 → 제외. 분할 실패 → 도형 1개 유지·refs `[]`·보정 0 |
| S3-8 | PASS | 인젝션 문자열을 키·값·id·라벨·type·kind·schemaVersion·stepId·appearAt·boundingBox·`__proto__`·중첩 키·배열 대신 객체로 넣은 30건 → 보정 user JSON의 `errors`에 문자열 유출 0, 모든 path 조각이 정수 또는 스키마 속성명, `hint`는 서버 상수와 일치. 시스템 메시지(생성·보정)에 문제·풀이·학생 문자열 마커 0 |
| S3-9 | PASS | `verified`·`style`·최상위 `evil` 키가 든 도형 → `unrecognized_keys`로 거부, 보정이 같은 키를 되풀이해도 제외, 결과 직렬화에 0건. 변이(M3: zod 출력 대신 입력 객체 반환) 시 테스트 실패 |
| S3-10 | PASS | 실제 HTTP: done 수신 뒤 소켓 파괴 → 도형 호출 signal `aborted=true`, close 후 write 0(solve·resume). 변이(M1: abort 제거) 시 테스트 2개 실패 |
| S3-11 | PASS | 실제 SDK 적중 수: 500·429에서 생성 1회·보정 1회(자동 재시도 0), 요청 옵션 `{maxRetries:0, timeout:30000, signal}`, 무응답 + 200ms 뒤 abort → `APIUserAbortError` 207ms. 라우터 요청당 생성 정확히 1회. 변이(M6 보정 2회, M8 maxRetries 제거) 시 테스트 실패 |
| S3-12 | PASS | 두 스키마의 모든 객체가 `additionalProperties:false`·required=전 키(위반 0), 금지 키워드 0, fixture F01~F09의 최상위·요소·제약·interaction 키 집합이 JSON Schema 변형의 required와 1:1(불일치 0). WU0 probe에서 봉투·보정 스키마 모두 실제 API가 수락 |
| S3-13 | PASS | 웹 관련 29파일 157테스트 통과. 변이 4개 중 3개(요청 세대 가드 제거, done 시점 resolve 제거 → 스트림 종료 시 resolve, done 뒤 error 덮어쓰기)에서 해당 테스트가 실패하고 1개(W4: done 전 figures 병합)는 `prev`가 null이라 동작 동일한 등가 변이. Provider 테스트가 스트림이 열린 채로 추천 질문 요청을 검증. 기존 화면 테스트 5개 파일 `git diff --numstat` 삭제 0 |
| S3-14 | PASS | 운영 `dist`에 `dependency_not_visible`·`line_out_of_view`·`measure_without_constraint`·`step_out_of_range`·`forward_reference`·`circle_out_of_view`·`not_yet_visible` 0건. 메인 번들 변경 전(워크트리 빌드) 966,991 → 967,760바이트(+769B, +0.08%). `unrecognized_keys`는 zod 라이브러리 문자열 |
| S3-15 | PASS(주의) | 문서 갱신 확인. 아래 LOW-3: 일부 문서 머리말에 "stage-qa 전/대기" 문구가 남음 |
| S3-R1 | PASS | S3-1과 같은 비교에 포함(own·alternative 모두) |
| S3-R2 | PASS | resume 6건: `chunk*→done→figures`, done 키 집합·`verified` 값 off와 동일, `setResumeSolution` 내용 = done payload |
| S3-R3 | PASS | hang에서 `chunk>done>: keep-alive` (약 400ms 상한 설정), done이 먼저, 저장 내용 불변 |
| S3-R4 | PASS | throw·malformed·hang·끊김 → error 0, 끊김 시 aborted |
| S3-R5 | PASS | Fake on: own·alternative 모두 `## 이어풀기`가 s1~s3, own에서도 `lastValidLine` 2와 무관 |
| S3-R6 | PASS | own: lineNo ≤ lastValidLine & < stallLine인 줄만(`["VALID_LINE_1","VALID_LINE_2"]`), 무효 줄·인젝션 줄 0. 정렬 안 된 입력도 번호순. 100줄·줄당 1,000자 → 30줄·300자. alternative·solve는 null. 변이(M4: 필터 제거) 시 테스트 3개 실패 |
| S3-R7 | PASS(Fake) | Fake on: `answerMd` = `-1`, 방법·이어풀기 섹션 분리 정확, 표지는 `## 이어풀기` 안에만. 실제 모델은 아래 "텍스트 경로" 참고 |
| S3-R8 | PASS | 병합·done resolve·추천 질문·깨진 이벤트·모드 재요청 시 이전 figures 무시 테스트 존재, 통과 |
| S3-INT | PASS(주의) | 아래 6.10.4 |
| G | PASS | 아래 6.10.5 |

변경 금지 목록 diff 0(`git diff`/`git status` 모두 출력 없음): `parseSolveOutput`·`parseResumeOutput`·`resolveSolutionContext`·`inMemoryProblemStore`·`infrastructure/cas/*`·`problemRepository`·`supabase/migrations/*`·웹 `pages/*`·`shared/ui/*`·`features/figure-visualization/*`·`ResultCard`·`ResumeResultCard`·`render.yaml`. 기존 테스트: 수정된 5개 파일 삭제 줄 0, 추가 줄에 `skip/only/xit/eslint-disable/@ts-ignore/console.log/debugger/TODO` 0. 새 npm 의존성 0(`package.json`·락 파일 diff 없음). `env.ts` 변경은 **주석 4줄뿐**이고 실행 코드 한 줄(`figuresEnabled: process.env["FIGURES_ENABLED"] === "true"`)은 그대로 → 허용 범위로 판단(계획 §7 변경 파일 표에는 `.env.example`만 있었지만, 더는 사실이 아닌 "어떤 실행 경로도 읽지 않는다" 주석을 고친 것). 도형이 클라이언트로 가는 서버 경로는 `streamFiguresPhase`의 `event: figures` 하나뿐이며 입력은 `parseSolutionFigures` 최종 재파싱 결과다(`grep`으로 확인, `done`·저장 경로에 도형 키 없음).

#### 6.10.3 평가 기록(S3-INT) 검토

- **사례 구성**: 계획 §9와 일치(22건: 도형 필요 10 + 불필요 6 + 적대 2 + resume 4, N1~N9는 Prompt/15 Stage 5의 1~9, N10은 좌표기하, resume 4종은 own 높이·own 접선·alternative 중점·own 무효 줄 함정).
- **독립 기대값 재계산**: 손으로 다시 계산한 값(H(2,0), M(2,3), M(0,4), 접점 (1,±√3), 교점 (2,2), 꼭짓점 (2,−1)·근 1·3, 무게중심 (3,7/3), M(2,0), resume 중점 (1,3), A2의 AB=4, R4의 BH=(25+36−49)/12=1)이 스크립트 리터럴과 모두 같다. 저장된 16개 도형을 **현재 검증기로 다시 통과**시켜 16/16 수용, 기대 점 13/13을 내 코드로 독립 재확인(R4는 H=foot, 좌표 (1,0), AB=5·AC=7 일치).
- **지표**: 계획 §9의 항목(생성률, 오생성률, 1차 통과율, 보정 성공률, 최종 수용률, 거부 코드 분포, 단계 표지 준수율, `step_out_of_range`, bbox 비율, 핵심 좌표, 추가 시간 p50/p95, 호출 수, 토큰, solve·resume 분리)을 모두 기록. 비용은 공식 단가 확인 불가라 계산하지 않음(올바른 처리).
- **재현**: `EVAL_DRY_RUN=1`(scratchpad 복사본에서) 22건 실행 성공(코드 경로 확인, Fake라 오생성률 6/6으로 나옴 = 평가 하니스가 오생성을 실제로 잡는다는 방증).
- **"미검증 도형 전달 0"**: 위 재검증 + 구조적 보장(최종 `parseSolutionFigures` 재파싱, 유일한 전송 경로) + 변이 시험으로 충족.

**보정 경로가 실제 모델에서 한 번도 실행되지 않은 점의 판정 반영**: 보정은 **실패해도 그 도형만 버리는 fail-safe 분기**이며 안전성(미검증 도형 0·텍스트 비차단·호출 상한)은 실제 SDK 하니스·Fake·변이 시험으로 독립 확인했다. 실제 API가 보정 스키마를 수락함도 probe에서 확인(P3: 요청 수락, 출력 토큰 제한으로 incomplete). 따라서 **PASS를 막지 않는다.** 다만 "보정이 실제로 도형을 살려내는가"(보정 성공률)는 **측정되지 않았고 0/0으로 기록**해야 하며, 1차 통과율 16/16은 후보 16개 기준 95% 신뢰구간 하한이 약 80%에 불과하다(표본 작음, 사례당 1회). → 운영 조건 ②로 이월.

**텍스트 경로(on 전용 개념 분류 JSON 위치) 판정**:
- 문제는 실재한다: `## 최종 답` 바로 아래에 JSON이 오면 `parseSolveOutput`(변경 금지)이 ① JSON 뒤에 답 문장이 있으면 태그를 잃고 `answerMd`에 JSON 줄이 섞이고 ② JSON만 있으면 `answerMd`가 빈 문자열이 된다. 둘 다 현재 코드로 직접 재현함.
- 수정이 off 문자열에 영향이 없음은 위 바이트 비교로 확인(on 전용 `splice`).
- **근거의 힘이 약하다**: 수정 전 평가 22건 중 N7·A2가 표시됐으나 같은 문제의 수정 전 on 재호출에서는 N7·A2가 재현되지 않았고(0/2) X4만 재현(그마저 JSON 위치가 아닌 "그림 없는 문제" 사례). 수정 후 0/6은 "수정 전에도 안 나오던 문제 위주"이므로 수정의 효과를 입증하지 못하고, 0/6만으로는 실제 발생률이 10% 안팎이어도 약 53% 확률로 관측된다. 그래서 "텍스트 경로 회귀 0"은 **관측치 0**이지 **입증**이 아니다.
- **resume**: JSON 위치 문제는 resume에 구조상 없다(resume 출력에는 concept_tags 줄이 없음). `## 최종 답`(CAS 파싱)은 on 프롬프트에 "순수 LaTeX" 문구가 유지되어 있고, 실제 모델 4건의 `answerMd`는 모두 `\[ … \]` 디스플레이 수식만이며 표지·한글 없음. CAS 파서는 `\[…\]`를 벗기므로(`services/cas/app/core/parser.py`) `12`·`2\sqrt{3}`·`1`은 정상 파싱됨을 직접 확인. 단 표본이 4건뿐이고 off 기준 표본이 없다. 참고(범위 밖·기존 한계): `(1,3)` 같은 좌표쌍 답은 CAS가 파싱하지 못해(`None`) 항상 "판정 불가".
- 남은 위험: on에서 태그 소실 또는 답 칸에 JSON 노출/빈 답 — 운영 플래그 off(D9)라 현재 사용자 영향 0, Stage 4에서 on으로 쓰기 시작할 때 실현.

#### 6.10.4 발견 사항

| 심각도 | 번호 | 내용 | 재현/근거 | 조치 |
|---|---|---|---|---|
| BLOCKER | — | 없음 | | |
| HIGH | — | 없음 | | |
| MEDIUM | M-1 | on 전용 텍스트 경로 잔여 위험(위 6.10.3). 수정 효과 미입증, 표본 작음 | `parseSolveOutput`에 `## 최종 답\n{"concept_tags":…}\n\boxed{5}`를 넣으면 `answerMd`에 JSON 포함·`conceptTags:[]`, JSON만 있으면 `answerMd:""` | **운영 조건 ①** |
| MEDIUM | M-2 | 보정 경로 실제 모델 효과 미측정(0/0). 1차 통과 표본 작음 | 평가 기록 `repairSuccessRate 0/0` | **운영 조건 ②** |
| LOW | L-1 | 도형 단계 전체 상한(60초)이 하드 데드라인이 아니다 — 어댑터가 signal을 무시하고 영원히 대기하면 `generateSolutionFigures`가 반환하지 않아 SSE가 keep-alive만 보내며 열려 있다. 현재 어댑터(OpenAI는 30초 타임아웃+signal, Fake hang은 signal 준수)는 안전함 | `adapter.generateFigures`가 `new Promise(()=>{})`, `totalBudgetMs:100` → 1,500ms 뒤에도 pending | Stage 4/5에서 `Promise.race` 고려 |
| LOW | L-2 | 전체 상한이 보정 중 만료되면 이미 검증된 1차 통과 도형까지 버려짐(`outcome: aborted`). 보정이 일반 실패(throw)면 나머지 유지됨. 현재 상수(30초×2 ≤ 60초)에선 사실상 도달 불가 | 1차 통과 1+무효 1, 보정 hang, 상한 200ms → `[]` | 상수 변경 시 재검토 |
| LOW | L-3 | 문서 문구 지연: `docs/FIGURE_SPEC.md` 머리말 "Stage 3 … 구현 기준(stage-qa 전)", `docs/PROJECT_STATUS.md` §3.41 "stage-qa 대기" | | 이 판정 반영해 갱신 필요(제품 문서라 QA가 수정하지 않음) |
| LOW | L-4 | 웹이 스트림에 `AbortController`를 쓰지 않아 화면을 떠나거나 `reset()`해도 서버의 도형 호출이 끝(최대 60초)까지 계속된다(기존 풀이 스트림에도 있던 성질이나 이제 추가 OpenAI 호출 비용이 붙음) | 코드 읽기(`solveProblemStream`에 signal 없음, 루프는 다음 이벤트가 와야 세대 불일치를 감지) | Stage 4에서 중단 신호 고려 |
| LOW | L-5 | `FakeLLMAdapter`(운영 `resolve-adapter`가 정적 import)가 `validation/fixtures`(테스트 전용 주석)를 import — 운영 기동에 fixture 모듈이 로드됨. `tsx` 기동은 동작(테스트·빌드 통과) | `fake-adapter.ts` import | 선택: 지연 import 또는 Fake용 별도 상수 |
| LOW | L-6 | 평가의 R4 "무효 줄 함정" 자동 검사가 `equalLength(AB, AC)` 부재만 본다(H가 중점 같은 자유 점으로 오작도되는 경우는 못 잡음). 이번 기록에서는 내가 H=foot (1,0)임을 수동 확인 | `evalFigures.ts` R4 `checks` | 후속 평가 시 기대 좌표 추가 |
| LOW | L-7 | `buildPriorWork`의 `slice(0, 300)`이 서러게이트 쌍 중간을 자를 수 있음(JSON 직렬화는 안전하게 이스케이프) | 코드 읽기 | 무시 가능 |

#### 6.10.5 게이트(저장소 루트 직접 실행)

| 단계 | 결과 |
|---|---|
| typecheck | exit 0 |
| lint | exit 0 |
| test | **첫 실행** exit 0 — api 55 파일/697 테스트, web 93 파일/758 테스트 |
| build | exit 0 (web 메인 번들 967,760B, 기존 chunk size 경고만) |

#### 6.10.6 변이 시험(개발 테스트가 공허하지 않은지, scratchpad 복사본에서 수행·복원 확인)

| 변이 | 결과 |
|---|---|
| M1 연결 끊김 abort 제거 | 테스트 2개 실패 |
| M2 보정 오류 path 정제 제거 | 테스트 1개 실패 |
| M3 zod 출력 대신 입력 객체 반환 | 테스트 1개 실패 |
| M4 priorWork 필터 제거 | 테스트 3개 실패 |
| M6 보정 2회 호출 | 테스트 5개 실패 |
| M7 done 뒤 error 허용 | 테스트 1개 실패 |
| M8 `maxRetries:0` 제거 | 테스트 2개 실패 |
| W1~W3 웹 훅 변이 | 각각 해당 테스트 실패(W4는 등가 변이) |

#### 6.10.7 키 노출 검사

`.omc/research/*.json` 3개, 문서 전부, `evalFigures.ts`, 소스에서 `apps/api/.env`의 실제 키 값을 고정 문자열로 검색 → **0건**(값은 출력하지 않음). 일반 비밀 패턴(`sk-…`, Bearer 토큰) 0건. `apps/api/.env`는 `.gitignore:7`로 제외됨.

#### 6.10.8 운영 플래그 on 전 조건(Stage 4 진입 시 이월 — 구현 결함이 아니라 증거 부족)

① **텍스트 회귀 대표본 또는 파서 보강**: `FIGURES_ENABLED`를 로컬 개발 외 환경에서 켜기 전에, (a) on 상태 텍스트만 호출을 최소 30회(solve 사례 다양화 + resume own·alternative 포함, 도형 호출 없음, 사전 오너 비용 승인) 돌려 태그 위치·빈 답 발생률을 기록하거나, (b) Stage 4 계획에서 `parseSolveOutput`이 `## 최종 답` 바로 아래의 개념 분류 JSON도 처리하도록 보강한다(이번 Stage에서는 변경 금지 파일이라 손대지 않음).
② **보정 효과 측정**: 오너가 승인하는 소수(≤4회) 호출로 일부러 망가뜨린 도형을 실제 모델에 보정시켜 성공/실패를 기록한다(현재 0/0). 못 하면 "보정은 안전 장치일 뿐 효과 미검증"으로 문서에 남긴다.
③ (Stage 4 design 인계, 이미 §6.3) done 이후 "도형 준비 중/없음" 표시, `**N단계**` 별표 처리.

#### 6.10.9 NOT VERIFIED

- 실제 OpenAI 새 호출(지시에 따라 금지): 보정 효과, on 텍스트 대표본, 최종 프롬프트로 22건 재평가.
- 운영 환경(Render) 프록시의 SSE keep-alive 동작과 실제 유휴 타임아웃.
- 물리 iPad 및 브라우저 UI(해당 변경 없음).

## 7. Stage 4 — 단계별 표시와 iPad 대응

- 승인된 계획: `.omc/plans/figures-stage4.md`(plan-agent + 오너/오케스트레이터 결정 O-1·O-2·D-3~D-10). design 미결(D-1·D-2·D-6, §8 질문)은 design-agent 사전 검토 뒤 계획 §9에 추가된다.
- 루프: plan-agent(완료) → design-agent(사전 검토 대기, WU5 이후용) → development-agent(**WU0~WU4 완료**, 2026-10-25, 화면 무관 작업) → stage-qa-agent(대기).
- 이번 요청 범위는 WU0~WU4다. WU5 이후(UI)는 design 명세가 나온 뒤 별도 요청으로 진행한다. 아래 결과는 모두 development-agent **자체 결과**이며 QA 판정이 아니다.

### 7.1 WU 진행 상태 (development-agent, 2026-10-25)

| WU | 내용 | 상태 |
|---|---|---|
| WU0 | 변경 전 기준값 캡처(HEAD 74ddd3b 작업 트리): parseSolveOutput 말뭉치 70건·parseResumeOutput 18건·parseStreamingSolve 접두 394건 오라클, 표지 없는 ResultCard·ResumeResultCard·ResultPanel DOM 12건, off 빌드 번들·precache·커널 문자열 | 완료(§7.2) |
| WU1 | `parseSolveOutput` 보강(문자열 인식 중괄호 매칭으로 JSON 구간만 제거, D-4), `parseResumeOutput` D-5, 웹 `parseStreamingSolve` 같은 규칙 + 불완전 마커 꼬리 숨김 | 구현·자체 테스트 통과 |
| WU2 | L-1 하드 데드라인(Promise.race + 진행 중 호출 abort), L-2 상한 만료 시 1차 통과 도형 보존(outcome `partial_deadline`)·클라이언트 끊김이면 0, L-5 Fake fixture 지연 import, L-7 서러게이트 안전 자르기, L-6 `evalFigures.ts` R4 검사 보강(dry-run만) | 구현·자체 테스트 통과 |
| WU3 | 보정 효과 측정 `scripts/evalFigureRepair.ts`: dry-run 경로 확인 → 실제 OpenAI **4회**(카운터 4 하드 정지) | 완료(§7.5), 결과 `.omc/research/figures-stage4-repair.json` |
| WU4 | 웹 `solveProblemStream`·`resumeProblemStream`에 `signal`, 훅 요청별 AbortController(새 요청·reset·언마운트 abort, AbortError 삼킴), `figuresPhase`(idle/waiting/received/empty), `ProblemInputContext`의 `solveFiguresPhase`·`resumeFiguresPhase` | 구현·자체 테스트 통과, 실제 HTTP 하니스 확인(§7.4 S4-L4) |
| WU5 | `shared/ui/card/ElevatedCard`(D-6), 사용처 6곳 교체, `elevatedCardStyle.ts` 삭제 | 구현·자체 테스트 통과(§7.10) |
| WU6 | `resolveStepStateAt`, `MIN_BOARD_WIDTH = 240`, 축마다 눈금 숫자 최소 1개, 숨긴 요소 스타일 결정성 | 구현·자체 테스트 통과(§7.10) |
| WU7 | `SolutionStepList`(데이터 기준), ResultCard·ResumeResultCard 분기, 스트리밍 미완성 표지 숨김 | 구현·자체 테스트 통과(§7.10) |
| WU8 | `SolutionFigures`(lazy), `figureContent` 슬롯, 페이지 단계 state, `Spinner announce`, `VITE_FIGURES_ENABLED`, D-7 PWA | 구현·자체 테스트 통과(§7.10) |
| 자격 판정 | `exploreEligibility.ts`(D-1·D-2), F09만 자격. 탐색 UI **미구현**(초기화 버튼 미이행) | 구현·자체 테스트 통과(§7.10) |
| WU9 | 탐색 모드 UI | **하지 않음(오너 D-1)** |
| WU10 | 문서(FIGURE_SPEC·PROJECT_STATUS L-3·API_SPEC·DEPLOYMENT 조합표·COMPONENT_MAP·PRD·FIGURE_DESIGN) | 완료(§7.10) |
| WU11 | 필기 회귀 자동 검사, 헤드리스 시나리오(Chromium·WebKit), 간헐 실패 조사, 게이트 | §7.11·§7.12·§7.13 |

### 7.2 WU0 기준값

| 항목 | 값 / 위치 |
|---|---|
| parseSolveOutput 오라클 | `apps/api/src/infrastructure/ai/__baseline__/parseSolveOutput.corpus.json` — 70건(normal 59, abnormal 11). 입력: 합성 경계 40, Stage 3 실제 모델 전문 12(`figures-stage3-textcheck.json`), Stage 3 평가 섹션 재구성 18, Fake 2. 분류는 새 구현과 독립(무차별 JSON 구간 탐색)으로 계산 |
| parseResumeOutput 오라클 | `__baseline__/parseResumeOutput.corpus.json` — 18건(normal 15, abnormal 3) |
| parseStreamingSolve 오라클 | `apps/web/src/features/ai-solution/__baseline__/parseStreamingSolve.corpus.json` — 서버 말뭉치의 전문·25/50/75%·마커 직전/직후 접두 394건(normal 301, abnormal 93). **WU1 중 재분류 1건**: `S13@40`(접두 자체가 "JSON 뒤에 문장"인 비정상 패턴인데 처음엔 원문 전체로만 분류했음). output 값은 변경 전 캡처 그대로, 파일 `reclassified` 필드에 사유 기록 |
| DOM 스냅샷 | `__baseline__/resultDom.cases.json`(입력) + `resultDom.baseline.json`(변경 전 `innerHTML`) 12건 — WU7에서 S4-6 기준으로 쓴다. 비교 테스트 `resultDom.baseline.test.tsx`는 지금도 통과 |
| off 빌드(변경 전) | 메인 번들 `index-BxYOJv9v.js` **967,760B**, JS 청크 1, precache **8**개(1015.45 KiB), 커널 문자열(`dependency_not_visible` 등 7종)·`JXG`·`jsxgraph` **0**. 기록 `.omc/research/figures-stage4-wu0-baseline.json` |
| off 빌드(WU4 후, 게이트 build) | 메인 번들 `index-DwsR7A88.js` **970,040B**(+2,280B, +0.24%), precache 8(1017.68 KiB), 커널 문자열·`JXG`·`jsxgraph` 0 |

### 7.3 변경 파일

| 구분 | 파일 | 내용 |
|---|---|---|
| api | `infrastructure/ai/parseSolveOutput.ts` | 기존 경로(마커부터 끝까지 JSON) 그대로 → 실패 시 `findJsonObjectEnd`(문자열·이스케이프 인식)로 JSON 구간만 제거(코드 펜스 포함), D-4(`lastBoxed` → `\[\boxed{…}\]`, 없으면 "") + `onAnswerFallback`(기본: 테스트 외 `solve_answer_fallback` 구조화 로그, 내용 없음) |
| api | `infrastructure/ai/parseResumeOutput.ts` | D-5: `## 최종 답`에서 줄 맨 앞(앞 공백 허용) `**N단계**`·`{"concept_tags"` 줄만 제거, 지울 줄이 없으면 원문 그대로 |
| api | `modules/figures/generateSolutionFigures.ts` | L-1 `Promise.race([run, whenAborted(linked)])`, L-2 `RunProgress`(1차 통과 도형·envelope 기록) → 상한 만료면 `finalize`로 1차 통과만(`partial_deadline`, `finalRejectCodes.deadline`), 부모 signal abort면 0. 반환·로그 metrics는 사본(늦게 끝난 호출이 못 바꿈). outcome 타입에 `partial_deadline` 추가 |
| api | `infrastructure/ai/fake-adapter.ts` | L-5 `validation/fixtures` 정적 import 제거 → `fakeFigure`에서 동적 import |
| api | `infrastructure/ai/prompts/figures.ts` | L-7 `truncateUtf16`(경계가 high surrogate 뒤면 1 줄임), `buildPriorWork`가 사용 |
| api 스크립트(게이트 밖) | `scripts/evalFigures.ts` | L-6 `footOfPerpendicular`(H가 A에서 직선 BC에 내린 수선의 발·BH = 1, 좌표 관계 1e-6) R4에 추가, `main()`은 직접 실행 시에만 |
| api 스크립트(게이트 밖) | `scripts/evalFigureRepair.ts`(신규) | WU3 보정 측정(카운터 4 하드 정지, 오류 문구 키 제거) |
| api 테스트(신규) | `infrastructure/ai/parseOutput.baseline.test.ts`, `parseResumeOutput.test.ts`, `prompts/figures.truncate.test.ts`, `resolve-adapter.fixtures.test.ts`, `modules/figures/figuresDeadline.router.test.ts`, `__baseline__/*.json` | |
| api 테스트(추가) | `parseSolveOutput.test.ts`(+126줄, import 2줄 수정: `vi`·`findJsonObjectEnd`·`lastBoxed` 추가), `generateSolutionFigures.test.ts`(+102줄, 삭제 0) | |
| web | `shared/api/solveProblem.ts`·`resumeProblem.ts` | 두 번째 인자 `signal?`, 있을 때만 fetch 옵션에 넣음 |
| web | `features/ai-solution/figuresPhase.ts`(신규) | `FiguresPhase` 타입, `figuresPhaseAfterStreamEnd`, `isAbortError` |
| web | `features/ai-solution/useSolveStream.ts`·`useResumeStream.ts` | 요청별 AbortController, 새 요청·reset·언마운트(세대도 넘김) abort, AbortError 삼킴, `figuresPhase` |
| web | `features/ai-solution/parseStreamingSolve.ts` | 서버와 같은 JSON 구간 제거·D-4, 불완전 마커 꼬리(`{"` 이상) 숨김 |
| web | `features/problem-input/ProblemInputContext.ts`·`ProblemInputProvider.tsx` | `solveFiguresPhase`·`resumeFiguresPhase` 노출(type import 1줄 추가 — 계획 §2-11에 기록된 기존 `problem-input → ai-solution` 참조와 같은 경로라 feature 간 참조가 하나 늘었다. 범위 밖 정리 대상) |
| web 테스트 | `__baseline__/{parseStreamingSolve.baseline.test.ts, resultDom.baseline.test.tsx, *.json}`(신규), `useSolveStream.test.tsx`(+187), `useResumeStream.test.tsx`(+79), `parseStreamingSolve.test.ts`(+41), `solveProblem.test.ts`·`resumeProblem.test.ts`(+44씩), `ProblemInputProvider.test.tsx`(+99), `RequireProblemInputGuard.test.tsx`·`SolvePencilcanvasPage.test.tsx`(mock 필드 +2씩) | 삭제 0 |
| web 테스트(기존 단언 수정 2건) | `app/problemInputFlow.test.tsx` | `toHaveBeenCalledWith({…})` 두 곳을 `toHaveBeenCalledWith({…}, expect.any(AbortSignal))`로 — 훅이 이제 signal을 두 번째 인자로 넘기므로 기존 단언이 인자 개수 차이로 실패. 첫 인자 단언은 그대로이고 signal 단언이 **추가**된 강화(완화 아님). `git diff --numstat` 8/5 |
| 연구 기록 | `.omc/research/figures-stage4-wu0-baseline.json`, `figures-stage4-repair.json`, `figures-stage4-repair.dryrun.json`, `figures-stage3-eval.dryrun.json`(L-6 dry-run) | 키 값 없음(§7.5) |

변경 금지(diff 0, `git diff --stat` 빈 출력 확인): `features/drawing-canvas/{HandwritingCanvas,PenRail,SolveScroll,HandwritingHighlightOverlay}.tsx`, `shared/lib/canvas/*`, `shared/styles/*`, `problemRepository.ts`, `supabase/migrations/*`, `infrastructure/cas/*`, `figuresJsonSchema.ts`, `prompts/system.ts`, `contracts/*`(기준값 포함), `render.yaml`, `package.json`·락 파일(새 의존성 0). `apps/web/src`에 새 `touch-action|touchAction|preventDefault|document.addEventListener` 0.

### 7.4 수용 기준별 자체 결과 (development-agent 자체 검증 — QA 판정 아님)

| AC | 자체 결과 | 근거 |
|---|---|---|
| S4-P1 | 자체 테스트 통과 | `parseSolveOutput.test.ts`: `## 최종 답` 바로 아래 JSON + 답 문장 → 태그 보존·answerMd에 `concept_tags` 0·답 문장 유지, 실제 모델 X4(on) 원문도 같음. 말뭉치 abnormal 11건 전부 answerMd에 JSON 0, 태그 복구(A01·A05·A06·R06·E-N7·E-A2 등) |
| S4-P2 | 자체 테스트 통과 | D-4: 풀이 마지막 `\boxed{…}` → `\[\boxed{…}\]`(중첩 `\frac{1}{2}` 포함), 없으면 "" + 폴백 콜백 `empty`. 답 헤더가 없으면 D-4 미적용 |
| S4-P3 | 자체 테스트 통과 | `parseOutput.baseline.test.ts`: normal 59건이 변경 전 오라클과 deep-equal(JSON 맨 끝·없음·깨진 JSON·`\boxed` 중괄호·문자열 안 `}`·마커 2회·CRLF·헤더 순서 등) |
| S4-P4 | 자체 테스트 통과 | `contracts/figuresOff.baseline.test.ts` **무수정** 통과(diff 0) |
| S4-P5 | 자체 테스트 통과 | `parseResumeOutput.test.ts`: 단계 표지 줄·개념 JSON 줄만 제거 → CAS 입력 순수 LaTeX, 정상 resume 15건 오라클 deep-equal |
| S4-P6 | 자체 테스트 통과 | `parseStreamingSolve.test.ts`: 모든 접두(1글자씩)에서 답·풀이 칸에 `concept_tags`·`{"` 0, 최종 답 문장 표시. 정상 접두 301건 오라클 deep-equal |
| S4-L1 | 자체 테스트 통과 | 오케스트레이터: signal 무시 영구 대기 + 상한 100ms → 500ms 안 반환·signal aborted. 라우터(supertest): 같은 조건에서 SSE 종료(done 있음, figures·error 0, 1,000ms 안) |
| S4-L2 | 자체 테스트 통과 | 1차 통과 1 + 보정 hang(signal 무시/준수 두 가지) + 상한 만료 → 통과 도형 1개·refs도 그 도형만·재파싱 deep-equal·`partial_deadline`. 라우터: figures 이벤트 1개(`fig-ok`). 클라이언트 fetch abort(상한 전) → figures 쓰기 0·close 뒤 write 0. 늦게 끝난 보정이 반환·로그 metrics를 바꾸지 않음 |
| S4-L4 | 자체 확인 | (a) 훅 테스트: reset·done 전 reset·새 요청·언마운트 → 넘긴 signal aborted, status error 0, 새 요청의 done 결과 유지, 같은 세대 done 뒤 AbortError도 error 0·결과 유지·phase empty. Provider 통합: "결과에서 수정"(`returnToWorkFromResult`)으로 solve·resume 두 스트림 abort. (b) 서버(실제 HTTP, `figuresDeadline.router.test.ts`): Node fetch AbortController.abort() → 서버 generateFigures signal aborted(solve·resume). (c) **실제 HTTP 하니스(게이트 밖, scratchpad)**: 임시 API 서버(Express + Fake hang, FIGURES on) + jsdom에서 **실제** `useSolveStream`/`useResumeStream` + 실제 `solveProblemStream`/`resumeProblemStream` + 실제 fetch → reset·새 요청·언마운트·resume reset 4경우 모두 서버 도형 호출 abort(3~11ms), error 0, 새 요청 결과 유지. 음성 대조: 훅이 signal을 안 넘기게 바꾸면 하니스 실패 |
| S4-L5 | 자체 테스트 통과 | `resolve-adapter.fixtures.test.ts`: fake-adapter에 정적 import 0, `resolveAdapter()` 기동 + recognize·solve off/on 동안 fixture 모듈 로드 0회, 도형 호출에서 처음 1회. off 기준값 테스트 통과 |
| S4-L7 | 자체 테스트 통과 | 경계 위치 4가지(패딩 0~3)에서 300자 자르기 결과 고아 서러게이트 0, ASCII는 기존 slice와 같음 |
| L-6 | dry-run 확인 | `EVAL_DRY_RUN=1` 22건 실행 성공. 새 검사 단독 확인(저장된 Stage 3 R4 도형 재적용, 모델 호출 0): 실제 R4 도형(H=foot) 통과, H를 (3,0) 자유 점으로 바꾼 해석 가능 오작도 실패, (1,0) 자유 점은 통과(좌표 관계로 판정), 도형 없음 실패. Fake dry-run은 H가 없어 실패로 기록(정상) |
| S4-R | 실행·기록 | §7.5. 실제 4회, 키 노출 0 |
| G | **첫 실행 실패**(§7.7) | |

### 7.5 보정 효과 측정 (WU3, 모델 `gpt-5.6-terra`, 2026-10-25, 실제 호출 4회)

- 스크립트 `apps/api/scripts/evalFigureRepair.ts`, 원본 `.omc/research/figures-stage4-repair.json`. dry-run(`figures-stage4-repair.dryrun.json`)으로 먼저 경로 확인: 4건 모두 1차 오류 코드가 의도대로, 호출 4.
- 호출 카운터: 상한 4, 5번째부터 어댑터에 닿기 전 throw(별도 확인: 6회 시도 → 어댑터 도달 4). 실제 실행 calls = 4.
- 성공 기준(계획 §7.4): `validateFigureCandidate` 통과 + figureId 동일 + 핵심 좌표 1e-6 + 요소 ID 집합 동일 + 새 given 제약 없음.

| 사례 | 망가뜨린 내용 | 1차 오류 코드 | 결과 | 보정 뒤 오류 | 토큰(입력/출력) | 지연 |
|---|---|---|---|---|---|---|
| C1 | F02 boundingBox top/bottom 뒤집기 | `custom@boundingBox`(zod) | **성공** | 없음 | 3,977 / 520 | 5,375ms |
| C2 | F09 M·segAM `appearAt` s5 + 마지막 step s5, 풀이 3단계 | `step_out_of_range` ×3 | **성공**(s3로 되돌림) | 없음 | 4,171 / 673 | 5,208ms |
| C3 | F02 H(foot) `to: "B"`(점) | `type_mismatch@elements.6.to` | **성공**(`to: "segAB"`) | 없음 | 3,954 / 634 | 5,078ms |
| C4 | F01 angleMeasure 제약 삭제, `showMeasure: true` 유지 | `measure_without_constraint` | **성공**(`showMeasure: false`로 해결) | 없음 | 3,779 / 327 | 3,317ms |

- 합계 4/4, 토큰 입력 15,881 / 출력 2,154, 지연 3.3~5.4초. **표본 4건 — "효과 일부 확인"이며 보정 성공률로 일반화하지 않는다.** 비용은 공식 단가 미확인이라 계산하지 않음.
- 품질 관찰(성공 기준 밖): C3에서 모델이 H의 `role`을 auxiliary → result로 바꿈. C4는 제약을 추가하는 대신 각도 수치 표시를 끄는 쪽으로 고쳐 원래 보여 주려던 45° 표시가 사라짐.
- 계획과 다른 점(기록): ① 계획은 "F03 foot.to"였지만 F03(중점과 중선)에 foot 요소가 없어 foot이 있는 F02로 만들었다(C1과 같은 fixture, 다른 오류). ② C2는 F09의 `interaction`을 fixed로 바꿔 넣었다(D-3: AI는 explore를 만들지 않음 — 오류를 `step_out_of_range` 하나로 한정). appearAt만 s5로 바꾸면 의미 검증의 `unknown_step`이 먼저 걸려 마지막 step도 s5로 바꿨다.
- 키 노출 검사: `apps/api/.env`의 키 값을 고정 문자열로 결과 JSON 2개·스크립트에서 검색 → 0건(값은 출력하지 않음), `sk-` 패턴 0건. 오류 문구는 저장 전에 키 값·`sk-…`를 지우게 했다(이번 실행은 오류 0).

### 7.6 변이 시험(개발 테스트가 공허하지 않은지, 자동 복원 확인)

| 변이 | 결과 |
|---|---|
| M1 L-1 race 제거 | 테스트 6개 실패 |
| M2 L-2 1차 통과 보존 제거 | 4개 실패 |
| M3 L-5 fixture 정적 import 복원 | 2개 실패 |
| M4 L-7 slice 복원 | 1개 실패 |
| M5 JSON 구간 제거 비활성 | 5개 실패 |
| M6 D-4 폴백 제거 | 3개 실패 |
| M7 D-5 제거 | 3개 실패 |
| M8 웹 JSON 구간 제거 비활성 | 3개 실패 |
| M9 웹 reset abort 제거 | 2개 실패 |
| M10 웹 done 뒤 오류에 error 상태 | 3개 실패 |
| M11 resume 훅 signal 미전달 | 2개 실패 |

### 7.7 게이트

| 단계 | 첫 실행(저장소 루트) |
|---|---|
| typecheck | exit 0 |
| lint | exit 0 |
| test | **exit 1** — api `modules/work/work.router.test.ts` "다른 사용자의 problemId면 404를 응답한다(소유권 검증)" 5,000ms 타임아웃 1건(api 805/806, web은 실행 전 중단) |
| build | exit 0(메인 번들 970,040B, 기존 chunk size 경고만) |

- 원인 분석(추정, 확정 아님): 실패 테스트는 Stage 4가 건드리지 않은 경로(멀티파트 업로드 → 인증 → 소유권 404, 어댑터 호출 전)다. 같은 파일 단독 5/5 통과, api 전체 단독 3/3 통과(806/806), 루트 `pnpm test` 재실행 3/3 통과(api 806, web 1,094). 루트 test는 api·web을 동시에 돌리므로 부하 중 업로드 본문을 다 읽기 전 404 응답이 나가는 경쟁으로 보이는 간헐 실패다(관측: 루트 4회 중 1회). 기존 테스트라 타임아웃 완화 등 수정은 하지 않았다.
- **게이트 조건("첫 실행 통과")은 충족하지 못했다.** 판단은 stage-qa에 맡긴다. HEAD에서도 같은 간헐 실패가 나는지는 확인하지 않았다(NOT VERIFIED).
- 평가 스크립트(`apps/api/scripts/`)는 게이트 밖이라 임시 tsconfig(`src`+`scripts`)로 따로 타입 검사 → 오류 0.

### 7.8 stage-qa 재현 방법

1. 저장소 루트: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
2. Stage 4 WU0~WU4 테스트만: `pnpm -F api exec vitest run src/infrastructure/ai src/modules/figures src/contracts`, `pnpm -F web exec vitest run src/features/ai-solution src/shared/api src/features/problem-input src/app/problemInputFlow.test.tsx`.
3. 오라클 독립 확인: 말뭉치 JSON은 HEAD 74ddd3b 코드로 캡처했다. 커밋 74ddd3b 워크트리에서 각 JSON의 `input`을 변경 전 파서에 다시 넣어 `output`과 비교하면 된다(캡처 스크립트는 scratchpad에만 있음 — 같은 절차: 입력 → 파서 → JSON).
4. S4-L4 실제 HTTP 하니스: 임시 API 서버 테스트(Express + `FakeLLMAdapter({figureScenario:"hang"})`, FIGURES on, 포트 고정, 도형 호출 시작·abort를 파일에 기록)를 백그라운드로 띄우고, web에서 jsdom 임시 테스트(`vi.stubEnv("VITE_API_BASE_URL")`, supabase 세션 mock)로 실제 훅 → reset/새 요청/언마운트/resume reset 뒤 서버 기록에 abort가 찍히는지 본다. 하니스 파일은 저장소에 넣지 않았다.
5. 보정 측정 재현: `EVAL_DRY_RUN=1 pnpm -F api exec tsx scripts/evalFigureRepair.ts`(비용 0). 실제 호출은 오너 승인 필요(이번 승인 4회는 소진).
6. L-6: `EVAL_DRY_RUN=1 pnpm -F api exec tsx scripts/evalFigures.ts`.
7. 변경 금지 파일: §7.3 끝 목록으로 `git diff --stat` → 빈 출력.

### 7.9 남은 일·결정 필요

- WU5~WU11(공통 카드 승격, resolveStepStateAt·최소 폭, 단계 UI, 도형 카드·lazy·PWA, 탐색 모드, 문서·L-3, 헤드리스): design-agent 명세 뒤 별도 요청.
- design 참고(S4-7): 서버 off면 done과 스트림 종료가 거의 동시라 `figuresPhase`가 waiting → empty로 짧게 바뀐다. "준비 중" 표시를 바로 띄우면 깜빡일 수 있으니 지연 표시 여부를 design에서 정해야 한다(데이터는 그대로 정확).
- D-4 폴백 지표는 서버 로그(`solve_answer_fallback`, 종류만)로만 남는다. 운영 수집 방식은 정해지지 않았다.
- L-1: 어댑터가 signal을 끝까지 무시하면 그 호출의 promise는 백그라운드에 남는다(응답은 이미 끝남). 현재 OpenAI 어댑터는 30초 타임아웃 + signal이라 해당 없음.
- 운영 플래그 on 전 조건(§6.10.8): ① 파서 보강은 이번 WU1로 처리(stage-qa 판정 대기). ② 보정 효과는 표본 4건 4/4로 "일부 확인"(§7.5). ③ design 인계는 WU5 이후.

### 7.10 WU5~WU8·자격 판정·WU10 (development-agent, 2026-10-25, 2차 요청)

기준: 계획 §0 갱신(D-1·D-2·D-6·V·SP)·§9, `docs/FIGURE_DESIGN.md` §17(오너 승인). 아래는 자체 결과이며 QA 판정이 아니다.

#### 7.10.1 변경 파일

| 구분 | 파일 | 내용 |
|---|---|---|
| shared/ui | `shared/ui/card/ElevatedCard.tsx`(신규) | `as`(div/section/article)·`className`·aria/id 전달, 표면 클래스 = 이전 상수 값 |
| shared/ui | `shared/ui/spinner/Spinner.tsx` | `announce?`(기본 true = 기존과 같음), false면 `role`·`aria-live` 제거 |
| shared/ui | `shared/ui/button/Button.tsx` | 타입에 `ref?: Ref<HTMLButtonElement>`만 추가(React 19 ref prop, 스테퍼 포커스 이동용). 렌더 결과 불변 |
| ai-solution | `DiagnosisCard`·`WorkLineList`·`ResumeResultCard`·`ResultCard`·`RecognizedProblemBar` | 카드 표면 → `ElevatedCard`. `elevatedCardStyle.ts` **삭제** |
| ai-solution | `SolutionStepList.tsx`·`hidePartialStepMarker.ts`(신규) | 단계 블록(§17.3)·스트리밍 미완성 표지 숨김(§17.11 정규식) |
| ai-solution | `ResultCard.tsx` | `kind="steps"`만 `SolutionStepList`(분할 실패면 기존 `<p>`), `currentStep`·`streaming` prop |
| ai-solution | `ResumeResultCard.tsx` | 본문 → `SolutionStepList`, `currentStep`·`figureContent` 슬롯(이어풀기 카드 → 슬롯 → AnswerBox) |
| ai-solution | `ResultPanel.tsx` | `figureContent` 슬롯(단계별 풀이 → 슬롯 → 최종 답), `currentStep`. MyPage 호출부 무수정 |
| figure-visualization | `resolveStepState.ts` | `resolveStepStateAt(spec, k \| "final")`, 기존 `resolveStepState`는 위임 |
| figure-visualization | `viewport.ts`·`useJsxGraphBoard.ts`·`FigureBoard.tsx`·`FigureView.tsx` | `MIN_BOARD_WIDTH = 240`(측정 폭이 미만이면 폭 상태를 바꾸지 않음 → 직전 크기 유지/미생성), `step` prop, 보드 대기 Spinner `announce={false}` |
| figure-visualization | `buildBoardScene.ts` | 축마다 눈금 숫자 최소 1개(원점에서 가장 가까운: ① 보드 안·비충돌 → ② 보드 안). 규칙으로 이미 있으면 불변 |
| figure-visualization | `applySceneToBoard.ts`·`mountFigureBoard.ts` | **계획 §4의 WU6 목록 밖(WU9 목록 파일)** — S4-3을 위해: 숨길 때도 기본 상태 스타일을 먼저 적용(이전 강조 스타일 잔존 방지), 단계 적용을 `suspendUpdate`로 묶음 |
| figure-visualization | `SolutionFigures.tsx`(신규, default export) | 슬롯 루트 `aria-live="off"`·waiting `aria-busy`·표시할 것 없으면 `hidden`, 500ms 지연 대기 줄, 그림 카드·캡션·스테퍼 |
| figure-visualization | `exploreEligibility.ts`(신규) | 정적 자격 + 위치 판정(퇴화·bbox 12px). UI 없음 |
| pages | `SolveLandscapePage.tsx` | `VITE_FIGURES_ENABLED === "true"`일 때만 `React.lazy` 정의, 슬롯은 phase가 waiting/received일 때만 렌더, `solveStep`·`resumeStep` state(결과가 비면 최종으로), 스트리밍 `ResultCard streaming` |
| pages(dev) | `FigurePreviewPage.tsx` | 카드 → `ElevatedCard` |
| 설정 | `vite-env.d.ts`, `apps/web/.env.example`, `vite.config.ts` | `VITE_FIGURES_ENABLED`. D-7: `build.rolldownOptions.output.codeSplitting.groups`로 `jsxgraph` 청크 이름 고정(Rolldown에서 `manualChunks`는 deprecated라 같은 역할의 대체 옵션 사용), PWA `globIgnores` + 런타임 캐시 `CacheFirst`(`jsxgraph`, 최대 4) |
| 테스트(신규) | `shared/ui/card/ElevatedCard.test.tsx`, `shared/ui/spinner/Spinner.test.tsx`, `features/ai-solution/{elevatedCardUsage,SolutionStepList}.test.tsx`, `pages/dev/figures/FigurePreviewPage.card.test.tsx`, `features/figure-visualization/{SolutionFigures,exploreEligibility}.test.*`, `app/{figuresHandwriting,figuresFlagOff}.integration.test.tsx` | |
| 테스트(추가) | `resolveStepState.test.ts`(+S4-1·2·4, 이전 구현 참조 함수), `buildBoardScene.test.ts`(+눈금), `FigureView.test.tsx`(+S4-3·S4-14) | 삭제 0 |
| 문서 | `FIGURE_SPEC.md`(머리말 L-3, §4.1, §9, §16), `PROJECT_STATUS.md`(§3.41 L-3 + Stage 4), `API_SPEC.md`(규칙 8·9, 의미 변화 메모), `DEPLOYMENT.md`(웹 플래그 행 + 조합표 D-9), `COMPONENT_MAP.md`(3개 컴포넌트), `PRD_WHYMATH.md`(FIG-8/9 상태), `FIGURE_DESIGN.md`(§17 구현 상태 주석) | |

**기존 테스트 수정(불가피, 완화 아님)**:
1. `FigureView.test.tsx` "P2-2 폭이 바뀌어 눈금 간격이 달라지면 장식만 다시 만든다": 시나리오 폭 `150 → 250`. 승인된 §17.9(240px 미만은 리사이즈하지 않음) 때문에 150px에서는 리사이즈 자체가 일어나지 않는다. 250px에서도 세로 눈금 간격이 1→2로 바뀌어 원래 의도(장식만 재생성, 요소·보드 유지)를 그대로 검사한다. 단언은 바꾸지 않았다.
2. `__baseline__/resultDom.baseline.test.tsx`(이번 Stage WU0에서 만든 테스트): 비교 전에 class 토큰을 정렬한다. D-6에서 `ResultCard`·`RecognizedProblemBar`의 class **순서**만 바뀌었다(토큰 집합·태그·텍스트 동일, Tailwind는 순서 무관). §17.10의 "토큰 집합 동일" 기준과 같다.

#### 7.10.2 수용 기준별 자체 결과 (QA 판정 아님)

| AC | 자체 결과 | 근거 |
|---|---|---|
| S4-1 | 자체 테스트 통과 | F01~F09 모든 도형 단계(15+)와 최종에서 `resolveStepStateAt` = 이전 인덱스 기반 구현(테스트 안 참조 함수) = 위임된 `resolveStepState` |
| S4-2 | 자체 테스트 통과 | 단계 s1·s3·s5인 F09 변형에서 k=2·4 → 누적 상태, 강조 없음(모두 default), 최종과 다름 |
| S4-3 | 자체 테스트 통과 + 헤드리스 | jsdom: 1→3→2→1→최종→2에서 같은 k = 같은 보드 속성, 보드 생성 1·해제 0. 헤드리스: 렌더되는 SVG 노드 속성 같은 k 불일치 0(4상태). **발견**: `display:none` 노드 일부(언더레이)는 한 번 보였다가 숨으면 JSXGraph가 `visibility="hidden"`을 남겨 원시 속성이 다르다 — 렌더 결과에는 영향 없음(§7.12) |
| S4-4 | 자체 테스트 통과 | F09 k=3: segAH·H 유지(dim), angAHC만 숨김 |
| S4-5 | 기존 테스트 + 헤드리스 | R-8(굵기 2.5·dash·언더레이·비강조 불투명도 0.65) 기존 통과. 그레이스케일 캡처 `shots/solve-k2-gray-*.png`에서 강조 점이 언더레이·크기로 구분됨 |
| S4-6 | 자체 테스트 통과 | 표지 있으면 별표 0·블록 N·머리말 보존, 표지 없으면 WU0 DOM 12건 동일(class 순서 정규화), 분할 실패면 단일 본문·스테퍼 없음·그림 최종 |
| S4-7 | 자체 테스트 통과 + 헤드리스 | 500ms 전 미표시(hidden)·이후 대기 줄, empty·idle 표시 0. 서버 off 유사(waiting → 100ms 뒤 empty) 깜빡임 0. 헤드리스 none·throw 표시 0, hang 500ms 뒤 대기 줄 → 상한(2.5s) 뒤 사라짐 |
| S4-8 | 자체 테스트 통과 + 헤드리스 | 통합 테스트·헤드리스: 풀이 = 단계별 풀이 → 그림 → 최종 답, 이어풀기 = 이어풀기 카드 → 그림 → AnswerBox. `MyPage.tsx` diff 0, ResultPanel 무슬롯 DOM = WU0 |
| S4-9 | 자체 확인(속성) | 슬롯 루트 `aria-live="off"`, 대기 Spinner·보드 Spinner `announce={false}`, 상태 텍스트만 polite. **실제 낭독은 NOT VERIFIED**(VoiceOver 실기기) |
| S4-10 | 자체 확인 | 플래그 미설정 빌드: JS 청크 1개(메인 972,271B, WU0 967,760B 대비 +4,511B = 파서 보강·훅·단계 블록), precache 8개(WU0과 같음), 커널 문자열·`JXG`·`jsxgraph`·`SolutionFigures`·"그림을 준비" 0. 통합 테스트: 도형 이벤트가 와도 UI 0·슬롯 모듈 import 0. 헤드리스(웹 off + 서버 on): UI 0·도형/JSXGraph 요청 0 |
| S4-11 | 자체 확인 | 플래그 on 빌드: `jsxgraph-*.js`(1,040,973B) 별도 청크·**precache 제외**·런타임 CacheFirst, `SolutionFigures-*.js`(51,381B)에 렌더러·커널(커널 문자열은 이 청크에만), 메인에 커널 문자열 0 |
| S4-12 | 헤드리스 + grep | 보드 컨테이너 `style.touchAction === ""`(computed auto), 보드 pointerdown `defaultPrevented false`(Chromium·WebKit). Chromium CDP: 도형 마운트 전후 document 포인터·터치 리스너 0, window 리스너 집합 동일. 새 코드 grep 0 |
| S4-13 | 헤드리스(Chromium CDP 터치) | 보드 위 위로 스와이프 → 패널 Body scrollTop 7 → 209, 스테퍼 위 아래로 스와이프 → 209 → 59. **물리 iPad NOT VERIFIED** |
| S4-14 | 자체 테스트 통과 + 헤드리스 | jsdom: 239px·0px로 줄어도 리사이즈·해제 0, 240px에서 리사이즈. 처음 200px이면 미생성·자리만. 헤드리스: 1024~1366 폭 5종 오류 0·보드 1, 세로 834×1194·694×834 가드 덮임/해제 중 보드 1·오류 0·해제 후 같은 SVG. 패널 Extend/Default 리사이즈(보드 유지), Close 시 보드 해제(0)·Open 시 1(누수 0). 눈금 숫자 최소 1개 jsdom 테스트 |
| S4-15 | 근사 확인 | 뷰포트 높이 834 → 500(키보드 근사)에서 보드 높이 258 → 258, 같은 SVG. **실제 소프트웨어 키보드는 NOT VERIFIED** |
| S4-16 | §7.11 | |
| S4-17 | 자체 테스트 통과 | 네이티브 button, `role="group" aria-label="그림 단계 이동"`, 선택 블록 `aria-current="step"`(버튼이 아니라 aria-pressed 해당 없음), 포커스 링 = Button 기본 `focus-visible:ring-2`, `min-h-11`(44px), 끝에서 disabled 되면 반대 버튼으로 포커스 이동, 전환 애니메이션 없음(reduced-motion 처리 불필요, §17.8) |
| 자격 판정(D-1·D-2) | 자체 테스트 통과 | F01~F09 중 F09만 자격, 폐포 = A·segAB·segAC·H·segAH·angAHC·segAM. given 제약(폐포 안)·수치 라벨·보장 안 된 직각 표시·축 표시·자유 점 아닌 draggable 각각 거부, 위치 판정(bbox 12px·퇴화·의미 실패) |
| S4-X1~X6 | 해당 없음 | 탐색 UI 미구현(D-1). **"처음 모양으로"(초기화) 버튼 미이행** |

#### 7.10.3 빌드 산출물(WU8, D-7)

| 빌드 | 메인 번들 | 청크 | precache |
|---|---|---|---|
| WU0 기준(off) | 967,760B | 1 | 8 |
| 현재 off(플래그 미설정, 게이트 build) | 972,275B | 1 | 8(jsxgraph 없음) |
| 현재 on(`VITE_FIGURES_ENABLED=true`, scratchpad 출력) | 883,194B(공통 `src-*.js` 88,929B로 분리) | 5: index·src·rolldown-runtime·SolutionFigures·**jsxgraph** | 12, **jsxgraph 제외**, sw.js에 `CacheFirst({cacheName:"jsxgraph"…maxEntries:4})` |

### 7.11 필기 회귀 검사(계획 §7.2, S4-16 자체 결과)

| 항목 | 결과 |
|---|---|
| 변경 금지 파일 diff | `git diff --stat`(drawing-canvas 4개·`shared/lib/canvas`·`shared/styles`·`problemRepository.ts`·`supabase/migrations`·`infrastructure/cas`·`figuresJsonSchema.ts`·`prompts/system.ts`·`contracts/*`·`render.yaml`·`pages/mypage`·package.json·락 파일·`packages/*`) **빈 출력** |
| 새 `touch-action\|touchAction\|preventDefault\|document.addEventListener\|window.addEventListener` | 이번 Stage에서 추가·신규 파일의 `apps/web/src` 코드 **0건**(grep 히트 1건은 기존 추적 안 되는 에이전트 메모 `apps/web/src/.claude/…`의 설명 문장) |
| 기존 drawing-canvas·`shared/lib/canvas` 테스트 | 무수정, 전부 통과(수 감소 0) |
| 통합 테스트(실제 라우터 + Provider, 플래그 on) | `app/figuresHandwriting.integration.test.tsx`: 보드 컨테이너·보드 상자·이전 버튼에 pen/touch pointer 6회 + 단계 전환 2회 → `commitStroke` **0회**, 결과 화면 캔버스 pen 획 → **정확히 1회**, 도형 수신 전후 커밋 수 불변. 커밋 수는 `useDrawingStrokes` 실제 구현을 감싸 센다 |
| 헤드리스(Chromium·WebKit, hasTouch, 1194×834) | 패널 열린 상태 캔버스에 획 3개 → 실행 취소(`새로고침`) 활성, 비어 있지 않은 픽셀 474(Chromium)·504(WebKit). 보드 터치 탭 + 마우스 드래그 + 이전 버튼 뒤 캔버스 픽셀 해시 **불변**. 콘솔 오류 0 |

### 7.12 헤드리스 시나리오(계획 §7.3) — **물리 iPad 아님**

- 환경: Playwright 1.63.0(npx 캐시, 저장소 밖) + Chromium 1243·WebKit 2359 헤드리스, `hasTouch: true`. 웹 `pnpm exec vite --port 5199`(mkcert HTTPS, `VITE_FIGURES_ENABLED=true`). 서버: scratch 진입 스크립트가 저장소 라우터를 그대로 조립(`FakeLLMAdapter` + `FIGURES_ENABLED=true`, 시나리오·상한은 환경변수), 인증은 로컬 가짜 Supabase(HTTPS, `/auth/v1/user`)로 **실제 `authenticate` HTTP 경로**를 탄다. 웹 세션은 localStorage 주입. 실제 OpenAI·Supabase 호출 0.
- 스크립트·결과·스크린샷: `.omc/research/figures-stage4-headless/`(`run.mjs`, `server.mts`, `off.mjs`, `valid.json`, `viewports.json`, `resume.json`, `scenario-{none,hang,throw}.json`, `shots/*.png` 36장).

| 시나리오 | Chromium | WebKit |
|---|---|---|
| solve valid(F07 3단계): done → 그림 카드, 배치 단계별 풀이 → 그림 → 답 | 통과, 보드 1, 콘솔 오류 0 | 통과, 보드 1, 오류 0 |
| 단계 이동 최종→3→2→1→2→3→최종→3→2: 상태 텍스트·선택 블록 | "2단계 / 3"·2단계 블록 `aria-current` | 같음 |
| 같은 k = 같은 SVG(렌더 노드) | 불일치 0, 상태 4개, SVG 재생성 0 | 같음 |
| 같은 k = 같은 SVG(원시, `display:none` 포함) | 불일치 3(숨은 언더레이 노드의 `visibility="hidden"` 잔존 — 렌더 무영향, 발견 사항) | 같음 |
| 그레이스케일 k=2 | `shots/solve-k2-gray-chromium.png` | `shots/solve-k2-gray-webkit.png` |
| S4-12 touch-action·defaultPrevented | `""`(auto)·false, document 리스너 0·window 집합 불변(CDP) | `""`·false(CDP 없음) |
| S4-13 보드·스테퍼 위 세로 스와이프 → 패널 스크롤 | 7 → 209 → 59(CDP `synthesizeScrollGesture` touch) | 미실행(CDP 없음) |
| 패널 Extend → Default → Close → Open | 보드 폭 672 → 344, Close 시 보드 0(해제)·Open 시 1, 오류 0 | 같음 |
| 높이 834 → 500(키보드 근사) | 보드 높이 258 → 258, SVG 유지 | 같음 |
| figureScenario none / throw | 슬롯·대기 줄·카드 0, 오류 0 | 같음 |
| figureScenario hang(상한 2.5s) | 0~500ms 숨김+`aria-busy` → 대기 줄 → 약 2.5s 뒤 사라짐, 카드 0, 오류 0 | 같음 |
| 뷰포트 1024×768·1133×744·1180×820·1194×834·1366×1024 | 보드 344×258, 보드 1, 오류 0 | 같음 |
| 세로 834×1194(가드) 덮임 → 해제 | 덮인 동안 상자 301px·보드 299px, 보드 1, 해제 후 같은 SVG, 오류 0 | 같음 |
| Split View 694×834(가드) 덮임 → 해제 | 상자 238px(< 240): 보드는 마지막으로 받은 240px 이상 폭 유지(패널 폭 전환 중간 프레임 236→ 클리핑), 보드 1, 해제 후 같은 SVG, 오류 0 | 상자 238px, 보드 높이 258 유지, 같음 |
| resume own valid: 이어풀기 카드 → 그림 → AnswerBox, 이전 → "3단계 / 3"·3단계 블록 선택 | 통과, 보드 1 | 통과 |
| resume 흐름 콘솔 | `POST /suggestions` 400 1건 — **기존 동작**(진단 직후 Provider가 질문 추천을 요청하지만 풀이가 아직 없어 `resolveSolutionContext`가 거부. Stage 4 무관 코드) | 같음 |
| 웹 플래그 off + 서버 on | 그림·슬롯·스테퍼 0, 도형/JSXGraph 모듈 요청 0, `window.JXG` 없음, 단계 블록 3(데이터 기준) | 같음 |

NOT VERIFIED(헤드리스로 대신할 수 없음): 물리 iPad Safari·Pencil·손가락 스크롤 관성, 실제 소프트웨어 키보드, VoiceOver 낭독(S4-9), Split View·Slide Over 실제 전환, WebKit 터치 스와이프(Playwright WebKit에는 CDP가 없음). 계획 §7.5의 실기기 12항목은 오너 확인 대기.

### 7.13 간헐 실패 조사 — `apps/api/src/modules/work/work.router.test.ts` "다른 사용자의 problemId면 404"

- 증상(1차 요청 게이트 첫 실행, §7.7): 이 테스트만 5,019ms에서 기본 5초 타임아웃. 파일 전체 5,117ms라 다른 5개 테스트는 합쳐 약 100ms — 점진적 느려짐이 아니라 한 요청이 멈춘 모양.
- 코드 경로: `authenticate → rateLimiter → multer(uploadProblemImage, memoryStorage) → requireImageFile → handler(resolveGrade → 404)`. **404는 multer가 업로드 본문을 다 읽은 뒤에 나간다** — "업로드 중 조기 응답으로 소켓이 멈추는" 구조가 아니다. 본문을 읽기 전에 응답하는 경로(401 토큰 없음, 429 상한 초과)는 이 테스트에서 일어나지 않는다(사용자 user-2 첫 요청, 파일마다 모듈 격리로 상한 카운터 새로 시작).
- 재현 시도:

| 대상 | 방법 | 결과 |
|---|---|---|
| 현재 트리 | 루트 `pnpm test`(api·web 동시) | 10회 중 1회(최초 게이트) 실패, 이후 9회 통과 |
| HEAD 74ddd3b(`git worktree` + `pnpm install --offline`) | 루트 `pnpm test` | 14회 모두 이 테스트 통과(처음 8회는 워크트리에 `apps/web/.env`가 없어 web의 다른 파일이 환경 오류 — api는 통과) |
| 현재·HEAD 각각 | 이 파일만 8개 동시 × 5회(CPU 부하) | 0/40, 0/40 |
| 현재·HEAD 교대 | 루트 `pnpm test` 6회씩 | 0/6, 0/6, 느린 테스트 표시 0 |

- **판정: 순수 부하(일시 정체)로 본다. 코드 결함 근거 없음.** HEAD에서는 재현되지 않았지만 재현율 자체가 낮고(현재 트리 1/10, 격리 스트레스 0/80) Stage 4가 이 경로(인증·업로드·work 라우터·저장소)를 바꾸지 않았다. 확정할 근거는 없다.
- 조치: 지시대로 **단언은 바꾸지 않고 이 테스트에만 명시 타임아웃 20초**를 줬다(`it(…, 20_000)`, 사유 주석). `git diff --numstat` 4/1(주석 3줄 + 닫는 줄 1줄 교체).
- 한계: 진짜 무기한 정체라면 타임아웃 연장은 증상을 늦출 뿐이다. 다시 나오면 요청 단계별 시각을 남기는 계측으로 정체 위치를 잡아야 한다.

### 7.14 게이트(2차 요청, 저장소 루트, 2026-10-25)

| 단계 | **첫 실행** |
|---|---|
| typecheck | exit 0 |
| lint | exit 0 |
| test | exit 0 — api 60 파일/806 테스트, web 104 파일/1,146 테스트 |
| build | exit 0 — 메인 번들 `index-B-apjw3e.js` 972,275B, JS 청크 1, precache 8(1020.80 KiB), 커널 문자열·`JXG`·`jsxgraph`·`SolutionFigures` 0. 기존 chunk size 경고만 |

- 2차 요청 변이 시험(N1~N12, 자동 복원): 대기 지연·aria-live off·포커스 이동·최소 폭·눈금 최소 1개·숨김 전 기본 스타일·강조 k·aria-current·슬롯 배치 순서·플래그 무시·자격 given 검사·Spinner announce를 각각 지우거나 바꾸면 해당 테스트가 실패했다(12/12).
- 평가 스크립트는 게이트 밖(1차 요청 §7.7과 같이 임시 tsconfig로 타입 검사).

### 7.15 stage-qa 재현 방법(2차 요청 추가분)

1. 저장소 루트 게이트(위).
2. Stage 4 화면 테스트만: `pnpm -F web exec vitest run src/shared/ui/card src/shared/ui/spinner src/features/ai-solution src/features/figure-visualization src/pages/dev src/app/figuresHandwriting.integration.test.tsx src/app/figuresFlagOff.integration.test.tsx`.
3. 빌드 플래그: `pnpm -F web build`(off) → `dist/assets/*.js` 1개·커널 문자열 0 / `VITE_FIGURES_ENABLED=true pnpm -F web exec vite build --outDir <임시>` → `jsxgraph-*.js` 별도·`sw.js` precache에 없음·`CacheFirst` 있음.
4. 헤드리스: `.omc/research/figures-stage4-headless/server.mts`를 `apps/api`에서 `pnpm exec tsx`로 실행(`FAKE_FIGURE_SCENARIO=valid|none|hang|throw`, `FIG_BUDGET_MS`), 웹 `VITE_FIGURES_ENABLED=true VITE_API_BASE_URL=https://localhost:4199 VITE_SUPABASE_URL=https://localhost:54399 VITE_SUPABASE_ANON_KEY=x pnpm exec vite --port 5199 --strictPort`, 그다음 `node run.mjs valid|viewports|resume|scenario:<이름>`(Playwright 경로는 스크립트 첫 줄). 플래그 off는 `off.mjs`.
5. 간헐 실패: §7.13 표의 방법.

### 7.16 Stage 4 QA 판정 (stage-qa-agent, 2026-10-25, 재작업 0/3)

판정: **STAGE CONDITIONAL PASS — FIX REQUIRED** (제품 코드는 수정하지 않았다. 검증용 코드는 scratchpad의 복사본에서만 변이했다)

범위 구분: ① 자동 검사(vitest·tsx 스크립트·실제 HTTP) ② 헤드리스 브라우저(Playwright Chromium·WebKit, 물리 iPad 아님) ③ **NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED**(계획 §7.5 실기기 12항목 전부, VoiceOver 낭독, 실제 소프트웨어 키보드, Split View, WebKit 터치 스와이프). 실기기 PASS는 보고하지 않는다.

#### 7.16.1 게이트(저장소 루트, 첫 실행)
typecheck exit 0 / lint exit 0 / test exit 0(api 60파일 806, web 104파일 1,146) / build exit 0(메인 972,275B). 이후 `pnpm test` 5회 추가 실행 5/5 통과(총 6/6, 플레이크 미재현).

#### 7.16.2 AC별 결과
| AC | 결과 | 독립 증거 |
|---|---|---|
| S4-P1·P2 | PASS | HEAD 74ddd3b를 git worktree로 띄워 오라클을 직접 만들고, 독립 생성기(구간 조합 18,291건 + 실제 모델 전문 13 + 개발자 말뭉치 70)로 HEAD/현재 출력을 비교. "마커~끝이 JSON.parse 가능이고 답이 비지 않음"인 입력(독립 분류)에서 달라진 출력 0건. JSON이 `## 최종 답` 바로 아래·중간·코드 펜스 안에 있는 입력은 태그 보존·answerMd/solutionMd에 `concept_tags` 0. JSON만 있는 답은 풀이 마지막 `\boxed{}`(`\[\boxed{…}\]`), 없으면 "" |
| S4-P3 | PASS | 정상 경로(JSON 맨 끝, 없음, `\boxed`/집합 중괄호, 문자열 안 `}`·`{`·이스케이프, CRLF, 이모지, 헤더 없음) 전부 HEAD와 동일 |
| S4-P4 | PASS | 독립 캡처(solve 4조합·resume own/alternative×CAS ok/fail·시스템 프롬프트 6학년·resume 프롬프트 12·OpenAI 요청/이벤트·저장 payload) 40,880B가 `FIGURES_ENABLED=false/1/TRUE/빈 값/unset`에서 HEAD와 `cmp` 동일. `true`는 달라짐(비공허). `figuresOff.baseline.test.ts` diff 0, 통과 |
| S4-P5 | PASS | resume 27가지 `## 최종 답`: 줄 맨 앞 `**N단계**`·`{"concept_tags"` 줄만 제거, 정상 입력 변화 0. LOW: 표지와 같은 줄의 내용(`**3단계** 3`의 "3")도 줄째 사라져 답이 "" |
| S4-P6 | PASS | 웹 `parseStreamingSolve`: 전문 파싱이 서버와 일치(깨진 JSON 제외, 답 헤더 있는 입력), 접두 111,364개에서 JSON 조각 누출 0(마커 2회 입력의 첫 JSON 4건 제외 — 서버와 동일 동작) |
| S4-L1 | PASS | 오케스트레이터 직접 호출(signal 무시 영구 대기, 상한 200ms → 201ms 반환), 실제 HTTP(signal 무시 어댑터, 상한 1.5s)에서 SSE가 1,505ms에 종료 |
| S4-L2 | PASS | 1차 통과 1 + 보정 hang(signal 무시): `partial_deadline` 도형 1개·204ms, 클라이언트 끊김 80ms: 0개(`aborted`), 상한 뒤 늦게 성공한 보정이 반환값을 바꾸지 않음, 처리되지 않은 rejection 0. LOW: 상한 만료와 클라이언트 끊김이 둘 다 outcome `aborted` |
| S4-L4 | PASS | 실제 HTTPS: 클라이언트 abort 후 311ms 내 서버 도형 호출 abort(대조: abort 안 하면 계속 대기). 브라우저 e2e(Chromium): 마이페이지 이동 184ms, "수정→확인" 215ms, 새로고침 274ms, 탭 닫기 161ms 안에 서버 abort. error 상태·콘솔 오류 0 |
| S4-L5 | PASS | `fake-adapter.ts` 정적 fixture import 0, 도형 호출 때만 동적 import(LOW: 운영 파일에 동적 import 잔존) |
| S4-L7 | PASS | `truncateUtf16` 경계 서러게이트 확인(코드·테스트) |
| L-6 | PASS | `EVAL_DRY_RUN=1` 두 스크립트 복사본에서 실행, 실제 호출 0 |
| S4-R | PASS(제한) | 새 호출 없음. 기록 4건을 현재 `validateFigureCandidate`로 재검증 4/4 통과, figureId·요소 ID 집합 동일, 새 given 제약 0, 삭제된 given 제약 0. `apps/api/.env` 키 값(165자)으로 결과 JSON 2·스크립트·장부·계획·baseline JSON 검색 0건, `sk-` 패턴 0건. 호출 카운터 하드 정지 코드 확인. 판정 기준은 계획 §7.4와 일치. **한계**: 기준에 "의미 보존"이 없어 C4(45° 표시를 끄는 쪽으로 해결)·C3(role auxiliary→result)는 기준상 성공이지만 원래 의도가 일부 달라짐. 표본 4건 4/4는 효과 일부 확인 |
| S4-1 | PASS | F01~F09 모든 단계 + 최종 + 미지의 stepId 67개 비교에서 HEAD 구현과 `resolveStepStateAt`·위임된 `resolveStepState` 결과 불일치 0, 단계 번호 오름차순·appearAt 유효 무작위 명세 6,000건 불일치 0 |
| S4-2 | PASS | 도형 steps에 없는 k → 이전 누적 상태, 강조 없음(코드·테스트) |
| S4-3 | PASS | 헤드리스 14단계 왕복 시퀀스: 렌더되는 노드 속성 불일치 0(Chromium·WebKit), 보드 SVG 재생성 0. 픽셀: WebKit 같은 k = 바이트 동일, Chromium은 한 k에서 경로(이전/다음)에 따라 1픽셀 RGB ±1(안티앨리어싱 수준, 시각 동일). 원시 속성은 숨은(display:none) 언더레이 노드에 `visibility="hidden"` 잔존 차이 — **판정 반영 의견**: 사용자에게 보이는 결과는 렌더 노드(display≠none)와 픽셀로 판정해야 하며 숨은 노드의 visibility 속성은 판정에서 제외하는 것이 맞다(JSXGraph 내부 상태이고 display:none이 우선). 판정 기준을 "속성 전체 동일"로 올리려면 `applyPart`에서 숨김 시 visibility도 명시해야 한다 |
| S4-4·S4-5 | PASS | F09 k=3 보존, 강조 구분(자체 테스트 + 그레이스케일 캡처 존재) — 캡처 육안 검수는 실기기 몫 |
| S4-6 | PASS | 표지 없는 입력: HEAD/현재 DOM을 같은 입력으로 직접 렌더해 비교 — 12건 + 적대 입력 8건 중 class **순서만** 다름(토큰 집합 동일). 표지가 있는 입력(`**1단계**없이 붙임`, `## 풀이\n**1단계**`)은 설계상 블록화(데이터 기준) |
| S4-7 | PASS | 헤드리스 none/throw: 표시 0, hang(상한 2.5s): 500ms 숨김+`aria-busy` → 대기 줄 → 상한 뒤 제거, 오류 0 |
| S4-8 | PASS | solve: 단계별 풀이 → 그림 → 최종 답, resume: 이어풀기 카드 → 그림 → AnswerBox(헤드리스), `pages/mypage` diff 0 |
| S4-9 | 코드 PASS / **NOT VERIFIED(VoiceOver 실기기)** | 슬롯 루트 `aria-live="off"`, Spinner `announce={false}` |
| S4-10 | PASS(LOW 1) | 플래그 미설정 빌드 dist 전체 grep: 커널 문자열·`JXG`·`SolutionFigures`·"그림을 준비"·`resolveStepStateAt` 0, JS 청크 1, precache 8. 메인 972,275B vs HEAD 967,770B(+4,505B, +0.47%, 단계 블록·훅·파서). **LOW**: `dist/sw.js`에 `CacheFirst` 런타임 라우트 `/assets/jsxgraph-…/`(cacheName "jsxgraph")가 off 빌드에도 들어감(청크는 없음, 무해). "jsxgraph 0"을 dist 전체 기준으로 읽으면 사실과 다름. `THIRD_PARTY_NOTICES.txt`의 jsxgraph 문구는 HEAD 빌드에도 있음 |
| S4-11 | PASS | 플래그 on 빌드: `jsxgraph-*.js`(1,040,973B)·`SolutionFigures-*.js`(51,381B, 커널 문자열은 여기에만)·`src-*.js`·runtime 분리, 메인에 커널 0, precache 12개에 jsxgraph 없음 |
| S4-12 | PASS | `touchAction===""`(auto), pointerdown `defaultPrevented` false(Chromium·WebKit), CDP: 도형 마운트 전후 document/window 리스너 집합 불변. 신규 코드 grep(touch-action·preventDefault·document/window.addEventListener) 0 |
| S4-13 | 헤드리스 PASS(Chromium CDP 터치) / **NOT VERIFIED(실기기)** | 보드 위 스와이프 scrollTop 7→206, 스테퍼 위 206→57 |
| S4-14 | PASS(헤드리스) | 5개 뷰포트 + 세로 834×1194·694×834 가드 덮임/해제: 보드 1, 해제 후 같은 SVG, 오류 0, 패널 Extend/Default 보드 유지, Close 0·Open 1(누수 0). 폭 238px에서 WebKit/Chromium 보드 높이 258/181 차이(가드 중간 프레임, 영향 작음) |
| S4-15 | 근사 PASS / **NOT VERIFIED(실제 키보드)** | 뷰포트 높이 834→500에서 보드 높이 258 불변 |
| S4-16 | PASS | 아래 7.16.4 |
| S4-17 | PASS | 키보드 Enter/Space로 단계 이동, 끝에서 disabled 시 반대 버튼 포커스 이동 확인, 버튼 높이 44px, `aria-current="step"`. 더블클릭은 비활성 끝 버튼 때문에 검사 스크립트가 대기(제품 문제 아님) |
| S4-X1~X6 | 해당 없음 | 탐색 UI 미구현(D-1). **"초기화 버튼 미이행"은 장부 §1·§7.4·§7.10, PROJECT_STATUS §3.41, PRD FIG-9에 명시되어 있음 — 확인함** |
| 자격 판정 | PASS | F01~F09 중 F09만 자격. 변이: 폐포 안 given 제약·파생 점 드래그·축 표시·수치 라벨·explore 아님 → 각각 올바른 사유로 거부, 폐포 밖 given 제약은 허용(올바름). 위치: 원래 좌표·내부는 허용, 경계 밖 out_of_bounds, 선분 BC 위·A=B 이동은 invalid/degenerate |
| G | PASS | 첫 실행 4종 exit 0. 기존 테스트 삭제 0 |

#### 7.16.3 변경 승인 판정
- 기존 테스트 수정: ① FigureView P2-2 150→250 — 단언 불변, 승인된 240px 최소 폭 때문이며 250px에서 눈금 간격이 바뀌어 원래 의도를 같게 검사함 → **완화 아님**. ② DOM 기준값 class 정렬 — 독립 렌더 비교로 정렬 없이도 차이가 class 순서뿐임을 확인 → **완화 아님**. ③ `problemInputFlow` 2곳 — 첫 인자 단언 유지 + `expect.any(AbortSignal)` 추가 → **강화**.
- `work.router.test` 타임아웃 5s→20s: 단언 불변, 해당 테스트 1개만 → 단언 완화 아님. 다만 원인은 미확정(아래 M-1).
- 계획 목록 밖 파일: `applySceneToBoard`(숨길 때 기본 스타일 선적용)·`mountFigureBoard`(suspendUpdate) — S4-3을 위한 최소 변경, 영향 범위 작음 → 적절. `Button` ref 타입 추가 — 렌더 불변 → 적절.
- 새 의존성 0(package.json·락 diff 0), `any` 0, TODO/FIXME/debugger 0, `console.log`는 CLI 스크립트 출력뿐, 비밀 값 0.

#### 7.16.4 필기 회귀(§7.2)
- 변경 금지 파일 diff 0(drawing-canvas 4개·`shared/lib/canvas`·`shared/styles`·`problemRepository.ts`·`supabase/migrations`·`infrastructure/cas`·`figuresJsonSchema.ts`·`prompts/system.ts`·`contracts`·`render.yaml`·`pages/mypage`·package.json·락·`packages`).
- 통합 테스트(`figuresHandwriting.integration.test.tsx`) 변이 시험(scratchpad 복사본): 슬롯을 최종 답 뒤로 이동 → 실패, 이전 버튼이 2단계씩 이동 → 실패, 슬롯이 pointerdown에서 캔버스로 획 이벤트를 새게 함 → 실패(3/3), 복원 후 통과. 참고: 스테퍼 이동량 변이는 `SolutionFigures.test.tsx` 단위 테스트가 잡지 못하고 통합 테스트만 잡음(LOW).
- 헤드리스 Chromium CDP `pointerType:"pen"`: 보드 위·스테퍼 위 pen 획 → 캔버스 픽셀 불변(158→158), 패널 밖 캔버스 pen 획 → 증가(158→814, 음성 대조 성립), 단계 전환 후 불변, 실행 취소 활성. 마우스·터치 보드 탭/드래그 후 픽셀 해시 불변(Chromium·WebKit). 콘솔 오류 0. WebKit의 pen 포인터·Apple Pencil은 실기기 NOT VERIFIED.

#### 7.16.5 발견 사항
- **HIGH H-1 (웹 플래그 on 전용)**: `SolveLandscapePage`의 `React.lazy(() => import(".../SolutionFigures"))`는 오류 경계가 없어, 이 청크 요청이 실패하면(오프라인·배포 뒤 오래된 탭의 해시 불일치) 결과 화면 전체가 React Router 기본 화면("Unexpected Application Error! Failed to fetch dynamically imported module")으로 바뀌고 이미 받은 풀이 텍스트도 사라진다. 재현: 헤드리스에서 `figure-visualization/SolutionFigures` 요청을 `route.abort()` → solve 결과 도달(Chromium·WebKit 모두). 대조: `jsxgraph` 청크만 막으면 결과·최종 답 정상 표시(FigureView의 기존 오류 경계가 처리). 기준: 계획 §10 "도형 실패는 풀이에 영향 없음", QA 규칙 11. 기대: 도형 슬롯만 사라지고 풀이·채팅 유지. 심각도 HIGH(운영 플래그 off 기본이라 현재 사용자 영향 없음, **플래그 on 전 필수**). 제안: `Suspense` 바깥에 오류 경계(fallback null)를 두고 테스트 추가.
- **MEDIUM M-1**: `work.router.test` "다른 사용자의 problemId면 404" 간헐 5초 초과의 원인이 확정되지 않았다. 현재 트리 게이트 1회 + 추가 5회 = 6/6 통과, 개발 기록상 현재 1/10·HEAD 0/14. Stage 4가 이 경로를 바꾸지 않았고 단언은 그대로라 Stage 4 결함 근거는 없다. 20초 연장은 단언 완화가 아니라 상한 완화이며 정체를 가릴 수 있다. 다시 나오면 단계별 시각 계측 필요.
- LOW L-A: 닫히지 않은/깨진 JSON(`{"concept_tags":["미완`)·마커 2회의 첫 JSON·`{ "concept_tags"`(공백)은 answerMd에 그대로 남음 — 계획 S4-P3가 "깨진 JSON = 변경 전 동일"로 고정한 동작이라 결함은 아님. 닫는 `}`가 하나 더 있는 JSON은 `}`가 답 앞에 남음.
- LOW L-B: D-5가 표지와 같은 줄의 내용을 함께 지움(위 S4-P5).
- LOW L-C: outcome `aborted`가 상한 만료와 클라이언트 끊김을 구분하지 못함(운영 지표).
- LOW L-D: off 빌드 `sw.js`의 jsxgraph 런타임 라우트(S4-10).
- LOW L-E: 보정 성공 기준에 의미 보존(표시 의도·role)이 없음(S4-R).
- LOW L-F: 추적되지 않는 에이전트 메모 디렉터리 `apps/api/src/.claude/`, `apps/web/.claude/`, `apps/web/src/.claude/`가 소스 트리 안에 있음(빌드 영향 없음, 위생).
- LOW L-G: Chromium 같은 k 픽셀 1개 RGB ±1 차이.
- LOW L-H: 헤드리스 resume 흐름의 `POST /suggestions` 400은 Stage 4가 바꾸지 않은 `ProblemInputProvider` 코드의 기존 동작(diff에 suggestions 관련 변경 0).

#### 7.16.6 NOT VERIFIED
계획 §7.5 실기기 12항목 전부(보드 위 손가락 스크롤, Apple Pencil 보드 위 획, 빠른 연속 필기·Scribble, 44px 터치, Default/Extend/Close, 회전 복귀, Split View·Slide Over, 소프트웨어 키보드 시 보드 높이·입력창, 준비 중/없음 표시, VoiceOver 순서·늦은 도형 미낭독, 라벨 겹침·글꼴, 탐색(미구현)). 이 보고의 헤드리스는 물리 iPad가 아니다. 실제 OpenAI 호출은 하지 않았다.

#### 7.16.7 재현 방법
HEAD worktree(`git worktree add --detach <dir> 74ddd3b` + `pnpm install --offline --frozen-lockfile`)에서 동일 입력 파서 실행 후 비교 / 현재 트리 복사본에 `FIGURES_ENABLED` 값을 바꿔 캡처 테스트 비교 / `l4-server`(어댑터 래퍼로 도형 호출 시작·abort 시각 기록) + Node fetch·Playwright로 abort 확인 / `.omc/research/figures-stage4-headless/`의 server.mts·run.mjs·off.mjs 실행(Playwright 경로는 npx 캐시) / H-1은 같은 하니스에서 `context.route(/figure-visualization\/SolutionFigures/, r => r.abort())` 후 `toSolveResult`.


### 7.17 재작업 1/3 (development-agent, 2026-10-25) — stage-qa CONDITIONAL PASS(§7.16) + design 사후 검수 P2·P3 대응

#### 7.17.1 항목별 처리

| 항목 | 처리 | 근거·테스트 |
|---|---|---|
| **[QA H-1]** 도형 슬롯 청크 실패 시 결과 화면 전체 오류 | `SolveLandscapePage`가 슬롯 내용을 `FigureErrorBoundary(fallback=null) > Suspense > SolutionFigures`로 감싼다. 기존 `features/figure-visualization/FigureErrorBoundary`를 재사용(page → feature 참조, 계층 규칙 준수. 파일은 import가 없는 작은 클래스라 off 빌드 메인 번들에 커널이 들어오지 않음 — 커널 문자열 0 확인) | jsdom `app/figuresSlotChunkFailure.integration.test.tsx`(실제 라우터 + Provider, `SolutionFigures` 모듈 로드 reject): 라우터 오류 화면 0, "풀이 결과"·단계별 풀이·블록 3·최종 답 "-1"·채팅 입력 유지, 슬롯 래퍼만 비어 있음. 변이: 경계를 빼면 이 테스트 실패. 헤드리스 §7.17.2 |
| **[design P2-1]** off 래퍼가 슬롯과 함께 새로 삽입됨 | 신규 `features/ai-solution/FigureSlot`(`aria-live="off"`, `data-figure-slot`)을 `ResultPanel`·`ResumeResultCard`가 슬롯 위치에 렌더하고 내용만 지연 로딩으로 채운다. 페이지는 플래그 on이고 ① 풀이가 단계 표지로 분할되거나(`hasSolutionSteps`) ② 도형 단계(waiting/received)일 때 `figureContent`를 넘긴다(①만이면 `null` = 래퍼만). 플래그 off·표지 없음·MyPage는 `undefined` → 래퍼 없음 → WU0 DOM 동일. 빈 래퍼의 간격: **`hidden`이나 `display:contents` 대신** 실제 상자로 두고(Safari에서 `display:contents` 요소가 접근성 트리에서 빠지는 문제, `hidden`은 트리에서 빠져 "새 삽입"과 같아짐) 보이는 자식이 없을 때만 `[&:not(:has(>:not([hidden])))]:-mt-3`으로 부모 `gap-3`을 상쇄 | jsdom `FigureSlot.test.tsx`(null이면 래퍼만, 내용이 생겨도 **같은 래퍼 노드**, 미지정이면 없음, 간격 상쇄 클래스, 이어풀기 순서). WU0 DOM 기준값 12건 통과. 헤드리스: 빈 슬롯 높이 0·주변 간격 12px(= Body gap, margin-top −12px), 그림 있을 때 간격 448 = 높이 424 + 12×2, MutationObserver 기록상 래퍼 노드는 한 번만 생기고 그림 카드는 같은 노드에 채워짐 |
| [QA L-B] D-5가 표지 줄의 내용까지 지움 | `parseResumeOutput`: 단계 표지는 **토큰만** 지우고 같은 줄의 나머지(예 `**3단계** 3` → `3`)는 남김. 표지만 있는 줄은 빠짐. 개념 JSON 줄은 줄째 제거(변경 없음) | `parseResumeOutput.test.ts` 신규 케이스 3. 정상 resume 오라클 15건 deep-equal 유지. **Stage 4에서 만든 테스트 2개의 기대값 수정**(이전 동작을 고정하던 값: `"\\[-1\\]"` → `"따라서 답은\n\\[-1\\]"`, `"-1"` → `"정리\n-1"`) — 요구된 동작 변경 때문 |
| [QA L-C] 상한 만료와 끊김 구분 | outcome `deadline`(상한 만료, 보낼 도형 없음) 추가, `aborted`는 클라이언트 끊김만, `partial_deadline` 유지. 로그(`solution_figures` 구조화 로그의 outcome)도 같은 값 | 신규 테스트 2(로그 outcome 순서 `deadline`·`aborted`·`partial_deadline`, 끊김이 먼저면 1차 통과가 있어도 `aborted`). **Stage 3 기존 테스트 1줄 기대값 수정**: "전체 상한을 넘기면 … (aborted)" → `deadline`(요구된 구분 때문, 주석 기록, `git diff --numstat` 삭제 1). Stage 4 S4-L1 테스트 기대값도 `deadline` |
| [QA L-D] off 빌드 sw.js에 jsxgraph 런타임 라우트 | `vite.config.ts`를 함수형으로 바꾸고 `loadEnv`로 `VITE_FIGURES_ENABLED`를 읽어 on일 때만 `runtimeCaching`에 넣음(`globIgnores`는 무해해 유지) | off 빌드 `sw.js`의 `CacheFirst` 0·`jsxgraph` 0, on 빌드 각 1. on 빌드 청크: index·`FigureErrorBoundary-*`(공통 청크 이름이 바뀜)·SolutionFigures·jsxgraph·runtime, precache 12개에 jsxgraph 없음, 커널 문자열은 SolutionFigures 청크에만 |
| [QA L-H(조정자 지시)] 스테퍼 이동량 ±1 | `SolutionFigures.test.tsx`에 k=2·3·4·최종에서 이전/다음 6가지 — 호출 1회·정확히 한 칸, 끝(1의 이전·최종의 다음) 호출 0 | 통과 |
| [QA L-F] 소스 트리 안 에이전트 메모 | 루트 `.gitignore`에 `apps/**/.claude/` 추가(루트 `.claude/`는 추적 유지) | `git check-ignore`: `apps/web/src/.claude`·`apps/api/src/.claude`·`apps/web/.claude` 무시, `.claude/agents` 무시 안 됨 |
| [design P3-1] 스테퍼 폭 문구 | `FIGURE_DESIGN.md` §17.16 "약 78px 이상(높이 44px로 타깃 충족)" | |
| [design P3-2] ElevatedCard `className` 규칙 | JSDoc과 `COMPONENT_MAP.md`에 "레이아웃 전용(flex·gap·정렬만, 표면을 바꾸는 클래스 금지)" | |
| [design P3-3] 카드 그림자 토큰화 | **하지 않음.** Stage 5 이후 과제: `drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]`(`Elevation/Card`)를 `tokens.css`의 그림자 토큰으로 등록하고 `ElevatedCard`·`ChatFooter`·`ChatBubble`·`ActionMenu`·`RecognizedChip`의 같은 값 교체(시각 변화 0 검사 포함) | 기록만 |
| [QA L-E] 보정 성공 기준에 의미 보존 없음 | `FIGURE_SPEC.md` §16.1 끝에 한계 기록(C3 role 변경, C4 45° 표시 끔 — 둘 다 검증 통과). 코드 변경 없음 | 기록만 |
| [QA M-1] work 라우터 플레이크 원인 미확정 | 코드 변경 없음. **재발 시 계측 방법**(아래) | 기록만 |

**M-1 재발 시 계측 방법**: ① 같은 실패가 나오면 즉시 루트 `pnpm test` 로그에서 동시에 돌던 파일과 시각을 남긴다. ② scratchpad 복사본(제품 트리 아님)의 `work.router.test.ts`에서 해당 테스트를 `supertest`의 `.on("request")`/`.on("response")` 대신, 앱 앞에 단계별 시각 기록 미들웨어(요청 수신·`authenticate` 통과·`rateLimiter` 통과·multer `finish`·핸들러 진입·응답 `finish`)와 클라이언트 쪽 `request.agent` 소켓 이벤트(`connect`·`finish`·`close`) 타임스탬프를 `process.hrtime`으로 붙여 실행한다. ③ 같은 시각에 `process.cpuUsage()`·이벤트 루프 지연(`perf_hooks.monitorEventLoopDelay`)을 함께 기록해, 멈춘 구간이 "서버 단계 사이"(코드 경로)인지 "이벤트 루프 전체 정지"(부하)인지 가른다. ④ 재현 빈도를 올리려면 루트 `pnpm test`를 `--pool=forks --poolOptions.forks.maxForks` 기본값으로 반복하되 다른 CPU 작업을 함께 돌린다. ⑤ 서버 단계 사이에서 멈추면 그 단계를 코드 결함으로 고치고 20초 타임아웃을 되돌린다.

#### 7.17.2 헤드리스 확인(H-1·P2-1, Chromium·WebKit, 1194×834, **물리 iPad 아님**)

- 스크립트 `.omc/research/figures-stage4-headless/rework1.mjs`(서버는 같은 폴더 `server.mts`, valid 시나리오), 결과 `rework1.json`.
- H-1: `context.route(/figure-visualization\/SolutionFigures/, r => r.abort())`로 청크 요청 1건 차단 → solve 결과: React Router "Unexpected Application Error" **없음**, "풀이 결과"·단계별 풀이·최종 답·채팅 입력 유지, 슬롯 래퍼(`aria-live="off"`) 남고 자식 0·높이 0·주변 간격 12px. 콘솔에는 React 개발 모드의 "경계가 잡은 오류" 보고와 차단된 요청 오류만 있다. 스크린샷 `shots/rework1-h1-slot-chunk-blocked-chromium.png`, `shots/rework1-h1-slot-chunk-blocked-webkit.png`.
- 대조(차단 없음): 그림 카드 표시, 슬롯 높이 424·간격 448, 오류 0. `shots/rework1-p21-normal-{chromium,webkit}.png`.
- 회귀: 기존 `run.mjs valid` 재실행 — 배치(단계별 풀이 → 그림 → 답), 렌더 노드 같은 k 불일치 0(4상태), S4-12 touch-action ""·defaultPrevented false, 필기 픽셀 불변, Chromium 보드 위 스와이프 스크롤, 콘솔 오류 0(`valid-rework1.json`).

#### 7.17.3 변경 파일(재작업 1)

`apps/web/src/features/ai-solution/{FigureSlot.tsx(신규), FigureSlot.test.tsx(신규), hasSolutionSteps.ts(신규), ResultPanel.tsx, ResumeResultCard.tsx, SolutionStepList.test.tsx}`, `apps/web/src/pages/solve/landscape/SolveLandscapePage.tsx`, `apps/web/src/app/figuresSlotChunkFailure.integration.test.tsx`(신규), `apps/web/src/features/figure-visualization/SolutionFigures.test.tsx`, `apps/web/src/shared/ui/card/ElevatedCard.tsx`(JSDoc), `apps/web/vite.config.ts`, `apps/api/src/infrastructure/ai/{parseResumeOutput.ts, parseResumeOutput.test.ts}`, `apps/api/src/modules/figures/{generateSolutionFigures.ts, generateSolutionFigures.test.ts}`, `.gitignore`, `docs/{FIGURE_SPEC.md, FIGURE_DESIGN.md, COMPONENT_MAP.md, FIGURES_WORKFLOW_STATE.md}`.

변경 금지 파일 diff 0, `figuresOff.baseline.test.ts`·WU0 파서 오라클·WU0 DOM 기준값 통과. 새 의존성 0.

#### 7.17.4 게이트(재작업 1, 저장소 루트)

| 시도 | typecheck | lint | test | build |
|---|---|---|---|---|
| **1차(첫 실행)** | exit 0 | exit 0 | **exit 1** — web `ResultPanelResizeHandle.test.tsx` "Default 상태에서 아래쪽 버튼 클릭 시 onClose" 6,314ms 타임아웃 1건(api 809/809, web 1,156/1,157) | exit 0 |
| 2차(전체 재실행) | exit 0 | exit 0 | exit 0 — api 60 파일/809, web 106 파일/1,157 | exit 0 — 메인 `index-c82YtCJj.js` 972,540B, JS 청크 1, precache 8(1021.21 KiB), `sw.js` `CacheFirst` 0, 커널 문자열·`JXG`·`jsxgraph`·`SolutionFigures` 0 |

- **첫 실행 통과 조건은 충족하지 못했다.** 실패한 테스트는 재작업 1이 건드리지 않은 파일이고(diff 0) **동기 테스트**(render → click → 단언, await 없음)다. 단독 3회 각 88ms 통과.
- 같은 시간대 증거: 1차 직후 load average 11.65(8코어), 2차 시작 시 23.93. 진단용 루트 `pnpm test` 재실행 2회 중 1회는 서로 무관한 web 테스트 **4건이 모두 6.1~6.3초**로 동시에 타임아웃(`cameraFlow`·`problemInputFlow` RESUME·`routing`·`RegisterPage`), 다른 1회는 전부 통과. 동기 테스트까지 6초 넘게 멈춘 것은 코드 경로가 아니라 **기계 전체가 몇 초씩 멈춘 현상**으로 보이며, §7.13 work 라우터 5,019ms 정체와 같은 모양이다.
- 가설(확정 아님): 저장소가 `~/Library/CloudStorage/OneDrive-…`(macOS File Provider) 안에 있어, 테스트·변환 캐시 파일 입출력이 동기화로 수 초 막힐 수 있다. 확인 방법: 같은 커밋을 OneDrive 밖(scratchpad 등)으로 `rsync` 해 루트 `pnpm test`를 반복하고 같은 6초대 집단 타임아웃이 사라지는지 비교(M-1 계측 ①~③과 함께).

### 7.18 Stage 4 QA 재검증 (stage-qa-agent, 2026-10-25, 재작업 1/3 이후)

판정: **STAGE PASS — READY FOR NEXT STAGE** (제품 코드 수정 없음. 변이 시험은 scratchpad 복사본에서만)

범위 구분: ① 자동 검사(vitest·tsx·빌드 산출물 grep) ② 헤드리스(Playwright Chromium·WebKit, 물리 iPad 아님) ③ **NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED**(계획 §7.5 실기기 12항목 전부, VoiceOver, 실제 소프트웨어 키보드, Split View, WebKit 터치 스와이프). 실기기 PASS는 보고하지 않는다.

#### 7.18.1 항목별 결과
| 항목 | 결과 | 독립 증거 |
|---|---|---|
| H-1 청크 실패 | **해소** | `SolutionFigures` 모듈 요청을 abort(Chromium·WebKit): 라우터 오류 화면 0, "풀이 결과"·단계 블록 3·최종 답·채팅 입력 유지, 슬롯 래퍼만 비어 있음(높이 0, margin-top −12px, 주변 간격 12px). 콘솔에는 React의 "FigureErrorBoundary가 잡았다" 보고만. 대조(차단 없음): 그림 카드 1·보드 1·간격 448=424+12×2·오류 0. `jsxgraph` 청크만 차단: 결과·카드 유지·오류 0. 변이(경계 제거) → `figuresSlotChunkFailure.integration.test.tsx` 실패 |
| P2-1 래퍼 선삽입 | 해소 | MutationObserver(두 브라우저): 슬롯 래퍼 추가 1회, 추가 시점 자식 0이고 같은 변이 묶음에 단계별 풀이 카드가 이미 있음. 그림 `section`은 약 300ms 뒤 **같은 래퍼 노드 안**에 추가. 래퍼 `aria-live="off"` |
| 빈 래퍼 간격(WebKit 포함) | 해소 | scenario none: 빈 슬롯 높이 0, margin-top −12px, 앞 카드→다음 카드 간격 12px(= Body gap, 래퍼 없는 화면과 같음), Chromium·WebKit 동일. 변이(상쇄 클래스 제거) → `FigureSlot.test` 실패 |
| `:has` 지원 | 문제 없음 | `CSS.supports("selector(:has(*))")` 두 엔진 true. `:has`는 Safari 15.4+, 앱의 Tailwind v4 CSS가 이미 `@property`·`color-mix`(Safari 16.4+)를 쓰므로 `:has`가 지원 하한을 더 높이지 않는다. 미지원 환경에서 규칙이 버려지면 빈 슬롯 주변이 12px 더 벌어질 뿐(기능 영향 없음). PRD에 iPadOS 최소 버전 명시는 없음 |
| 플래그 off·표지 없음 DOM | PASS | off 빌드 dist: 커널·`SolutionFigures`·`resolveStepStateAt` 0. 헤드리스 웹 off + 서버 on: 슬롯·스테퍼 0. WU0 DOM 기준값 12건 포함 `__baseline__` 통과(§7.16에서 HEAD 직접 렌더 비교 완료, 이번 변경은 래퍼를 `figureContent !== undefined`일 때만 렌더) |
| L-B (Stage 4 테스트 2개 기대값) | 완화 아님 | 두 테스트는 Stage 4가 만든 것이고 이전 동작("표지 줄째 삭제")을 고정하던 값이었다. 새 기대값(`따라서 답은\n\\[-1\\]`, `정리\n-1`)은 같은 줄 내용 보존이라는 요구된 변경을 **더 엄격하게** 단언한다. 정상 resume 오라클 15건·`parseOutput.baseline` 통과. HEAD 대조 27변형: 정상 입력 변화 0, `**3단계** 3`→`3`으로 해소 |
| L-C (Stage 3 테스트 1줄) | 완화 아님 | "전체 상한을 넘기면 …" 시나리오는 상한 만료이므로 이제 `deadline`이 맞다. 단언 강도 동일(값만 더 구체적), 신규 테스트가 `aborted`(끊김)·`deadline`·`partial_deadline` 구분을 별도로 단언. 직접 호출 재확인은 §7.16과 같은 시나리오에서 코드 경로 검토로 갈음 |
| L-D | PASS | off 빌드 `sw.js`: `CacheFirst` 0·`jsxgraph` 0, precache 8(1021.21 KiB), 메인 972,540B(§7.16 대비 +265B), 커널 문자열·`JXG` 0. on 빌드: `CacheFirst` 1, precache 12(jsxgraph 제외), 청크 = index·SolutionFigures·FigureErrorBoundary(공통 청크)·jsxgraph·runtime, 커널 문자열은 SolutionFigures 청크에만, `JXG`는 jsxgraph 청크에만 |
| L-F | PASS | `.gitignore`의 `apps/**/.claude/`가 세 디렉터리를 무시, 루트 `.claude/agent-memory`는 추적 유지(`git check-ignore`) |
| L-H | PASS | 스테퍼 ±1 테스트 6가지 통과 |
| 변경 금지 파일 diff | 0 | drawing-canvas·lib/canvas·styles·problemRepository·migrations·cas·figuresJsonSchema·system.ts·contracts·render.yaml·package.json·락·packages·pages/mypage |
| 기준 테스트 | 통과 | `figuresOff.baseline`·`parseOutput.baseline`·`parseResumeOutput`·figures 모듈 116 통과, web `__baseline__`(DOM·스트리밍)·FigureSlot·청크 실패·필기 통합·SolutionFigures 336 통과. `parseSolveOutput.ts`는 §7.16 검증 시점과 동일(복사본 diff 없음) |
| 이번 변경 범위 | 확인 | 이전 QA 복사본 대비 diff 파일 = 기재된 목록과 일치(`parseResumeOutput`·`generateSolutionFigures`(+test)·FigureSlot·hasSolutionSteps·ResultPanel·ResumeResultCard·SolutionStepList.test·SolutionFigures.test·SolveLandscapePage·ElevatedCard·vite.config·청크 실패 테스트) |

#### 7.18.2 신규 발견
- **LOW N-1**: L-B 이후 `**3단계** {"concept_tags":["a"]}`처럼 표지와 개념 JSON이 **같은 줄**에 있으면 표지만 지워지고 JSON이 `answerMd`에 남는다(이전 구현은 이 줄을 통째로 지움). 표지 제거 뒤 남은 줄을 JSON 줄 검사에 다시 통과시키면 해소. 발생 가능성은 낮음.
- **LOW N-2**: 페이지 수준의 "표지가 있으면 도형 단계 전이라도 래퍼를 미리 렌더" 규칙(`figureSlotContent`의 `hasSolutionSteps ? null : undefined`)을 지키는 자동 테스트가 없다. 변이(idle에서 `undefined` 반환)가 모든 관련 테스트(청크 실패·필기·FigureSlot)를 통과했다. 동작은 헤드리스 MutationObserver로 확인했으므로 현재 결함은 아니다.

#### 7.18.3 이월·참고
- 계획 §7.5 실기기 12항목은 그대로 NOT VERIFIED.
- 소스 트리 안 `.omc/` 상태 디렉터리(apps/api/src, apps/web/src 등)는 훅이 만든 것으로 `.omc/` 규칙으로 무시됨(Stage 4 무관).

#### 7.18.4 게이트와 간헐 실패 측정
| 실행 | 결과 |
|---|---|
| 저장소 루트(OneDrive 폴더) **첫 실행** | typecheck 0, lint 0, **test 1**, build 0. api 807/809: `chat.router.test` "question이 비어 있으면 400"이 **404**를 받음(56ms, 타임아웃 아님), `solutions.router.figures.test` "throw"가 5,007ms 타임아웃. web은 실행되지 않음. 시작 시 `fileproviderd` 61%·OneDrive File Provider 63% CPU, load 6~9 |
| 같은 트리 `pnpm test` 6회 연속 | 6/6 통과(load 22~44) |
| OneDrive 밖 복사본(scratchpad) `pnpm test` | 유효 4회(데이터 폴더 누락으로 무효였던 2회 제외) 4/4 통과 |
| OneDrive 밖 복사본 **전체 게이트 첫 실행** | typecheck 0, lint 0, test 0(api 809, web 1,157), build 0 — load 41~44 중에도 통과 |
| 실패한 두 파일 10병렬×6 | 60회 0 실패. `chat.router.test` 단독 25회 0 실패 |
| 읽기 지연 탐침(통계 7분, 두 트리 동시) | stat·read·readdir 최대 3~4ms, 이벤트 루프 지연 최대 6~8ms — OneDrive 폴더와 복사본 차이 없음, 정지 0 |

판정(환경 vs 코드): **Stage 4 코드 결함의 증거는 없다.** 실패한 테스트가 매번 다르고(work 라우터, 동기 컴포넌트 테스트, chat 라우터, figures 라우터, 서로 무관한 web 4건이 동시에 6.1~6.3초), 대부분 diff 0인 파일이며, 부하(load 44)나 병렬 반복으로는 재현되지 않는다. 같은 증상이 재작업 전(§7.13)에도 나왔다. 개발 측 가설(OneDrive File Provider가 기계 전체를 몇 초 멈춤)은 **정황은 맞으나 증명되지 않았다**: 실패 시점에 File Provider 프로세스가 CPU를 쓰고 있었고 OneDrive 밖 복사본에서는 실패가 없었지만(4+전체 게이트 1), 실패율이 낮아(OneDrive 1/7) 표본이 통계적으로 구분하지 못하고 읽기 탐침은 이상이 없었다. `chat.router.test`의 404(타임아웃이 아닌 단언 실패)는 이 가설로 설명되지 않아 **원인 미확정**이다.

처리: 계획 G의 "첫 실행 exit 0"은 **이번 QA 첫 실행에서 문자 그대로는 충족되지 않았다.** 환경성으로 판정해 예외 처리한다(근거: 위 표). 예외 조건과 후속: ① 실패 테스트가 diff 밖이고 단독·재실행에서 통과하면 전체 재실행 1회를 허용한다. ② 이후 Stage 게이트는 OneDrive 밖 복사본에서도 실행해 비교한다(권장). ③ 같은 증상이 다시 나오면 M-1 계측 방법(§7.17.1)을 적용하고, 특히 **타임아웃이 아닌 단언 실패(404)가 재현되면 코드 경로 조사로 격상**한다.

#### 7.18.5 범위 밖 파일 조작 확인
`~/Library/CloudStorage/`에는 `.DS_Store`와 실제 `OneDrive-개인`(유니코드 분해형 이름)만 있다. `%E1…`형 이름의 폴더는 `~/Library/CloudStorage`(깊이 4), 저장소(깊이 6), 홈(깊이 2~3), `/private/tmp/claude-501` 어디에도 없다. 저장소 `git status --ignored`에도 관련 항목 없음. 조회만 했고 삭제는 하지 않았다.


### 7.19 후속 정리(PASS 이후, 재작업 횟수 제외, development-agent 2026-10-25)

| 항목 | 처리 | 테스트 |
|---|---|---|
| N-1 표지와 개념 JSON이 한 줄(`**3단계** {"concept_tags":["a"]}`)이면 JSON이 `answerMd`에 남음 | `parseResumeOutput`: 표지를 지운 나머지를 개념 JSON 줄 검사에 한 번 더 통과시켜 JSON이면 줄째 제거 | `parseResumeOutput.test.ts` 신규 1(4단언: JSON만 남는 줄 제거·다른 줄 답 유지·앞 공백·JSON 아니면 L-B대로 유지). 정상 resume 오라클 통과 |
| N-2 페이지 래퍼 사전 렌더 규칙 테스트 공백 | 코드 변경 없음. 신규 `apps/web/src/app/figuresSlotPrerender.integration.test.tsx`(실제 라우터 + Provider, 플래그 on): 표지 있음 → 도형 없이 스트림 종료(waiting → empty)해도 같은 `aria-live="off"` 래퍼 노드가 단계별 풀이와 최종 답 사이에 남고 자식 0 / 표지 없음 → 종료 뒤 래퍼 없음. 결과 패널은 done 뒤에만 보여 그때 phase가 이미 waiting이라, 페이지에서 관찰되는 "도형 단계 아님"은 `empty`(idle과 같은 `!active` 분기) | 변이: `if (!active) return undefined;`로 바꾸면 첫 테스트 실패, 복원 확인 |

게이트(저장소 루트, **첫 실행**): typecheck 0, lint 0, test 0(api 810, web 1,159), build 0(메인 `index-c82YtCJj.js` 972,540B, precache 8). §7.18.4 플레이크 예외 적용 없음. 변경 금지 파일 diff 0.

---

## 8. Stage 5 — 저장·CHAT 연동과 통합 QA

승인 계획: `.omc/plans/figures-stage5.md`. 이번 요청 범위는 **WU0~WU6(WU2b·WU3b 포함)**. WU7(마이페이지 화면)은 design 명세 뒤 별도 요청, WU8·WU8b·WU10·WU11은 다음 요청.

### 8.1 WU 진행 상태 (development-agent, 2026-10-25)

| WU | 상태 | 요약 |
|---|---|---|
| WU0 | 완료 | 변경 전 기준값 5종 캡처(아래 §8.2). 캡처는 코드 변경 전 작업 트리(HEAD 091ae2a와 코드 동일)에서 했다 |
| WU1 | 완료 — 1차 요청에서는 원인 미확정·재현 0/N(§8.3), **2차 요청에서 원인 확정·수정(§8.13)** | supertest 서버가 외부 프로세스(VS Code helper)의 `127.0.0.1` 리스너와 포트가 겹쳐 요청이 외부 서버로 감. 테스트 하니스 결함 — `src/test-support/loopbackListen.ts`(vitest setup)로 수정 |
| WU2 | 완료 | solutions 마이그레이션, `FIGURES_PERSIST_ENABLED`, 탐지·재탐지·쓰기 분기·키 없이 재시도·`saveSolutionFigures`·상세 재파싱 |
| WU2b | 완료 | resume 마이그레이션, `RESUME_PERSIST_ENABLED`, `saveResumeSolution`·`saveResumeFigures`·상세 resume 별도 쿼리 |
| WU3 | 완료 | 메모리 도형 연결(같은 결과 객체만), `resolveSolutionContext` 도형·출처, `streamFiguresPhase` 콜백, solve·resume 라우터 연결(resume는 done 직전 저장, verified만) |
| WU3b | 완료 | `problemHistoryDetailSchema.resumeSolution`(선택, nullable 아님), 웹 problemHistory 테스트 |
| WU4 | 완료 | `buildFigureChatSummary`·`buildFigureChatSummaries`·`stepStateAt`(validation 순수 함수), 상한·라벨 안전 |
| WU5 | 완료 | `chatRequestSchema.figureContext`, 라우터 맥락·history 상한(on 전용), OpenAI user 메시지 그림 섹션 |
| WU6 | 완료 | 웹 `sendChatMessage`·`useChatMessages`·Context 타입·`SolveLandscapePage`(보이는 결과의 단계 전달, 웹 플래그 on 전용) |
| WU7 이후 | 미착수(범위 밖) | design §18 사전 검토는 별도 진행됨(`docs/FIGURE_DESIGN.md` §18, 이 요청에서 작성하지 않음) |

### 8.2 WU0 기준값

| 파일 | 내용 | 비교 테스트 |
|---|---|---|
| `apps/api/src/contracts/__baseline__/chatOff.baseline.json` | OpenAI chat 요청 본문(system+user) — history 0·3·30턴·긴 30턴(턴당 2,000자) × solve 맥락(M3)·resume 변환 맥락(H1) 8건, 라우터 `adapter.chat` 인자 JSON·응답 본문 6건 | `contracts/chatOff.baseline.test.ts` |
| `apps/api/src/contracts/__baseline__/persistenceOff.baseline.json` | 실제 라우터 + 기본 저장소 + 메모리 가짜 Supabase: solve 완료 시 호출(solutions upsert payload·옵션), resume 완료 시 호출(**0건**)과 SSE, 상세(풀이 있음/없음/없는 문제) select 문자열·필터 순서·응답 본문, 목록 호출·응답, `createProblemRepository(client).saveSolution` 단독 payload | `contracts/persistenceOff.baseline.test.ts` |
| `apps/web/src/features/follow-up-chat/__baseline__/chatRequest.baseline.json` | 실제 `useChatMessages` → 실제 `sendChatMessage` → fetch 스텁, 질문 3개의 URL 경로·method·헤더·본문 문자열(기준 URL origin은 기기별이라 캡처 직후 제거, 테스트도 경로만 비교) | `chatRequest.baseline.test.tsx` |
| `apps/web/src/pages/mypage/__baseline__/myPageDetailDom.baseline.json` | 실제 `MyPage` + 라우터(API 모듈만 mock), 행 클릭 → dialog `outerHTML` 4건: 풀이+대화, 풀이만(개념 없음), 풀이 없음, 풀이에 저장 도형 키 있음(변경 전 웹은 무시) — WU7 비교 기준 | `myPageDetailDom.baseline.test.tsx` |
| 기존 `figuresOff.baseline.*` | 수정 없음(diff 0) | 그대로 통과 |

- 캡처 방법: api 두 파일은 `STAGE5_BASELINE_CAPTURE=1`일 때만 쓰는 분기가 남아 있고 **파일이 이미 있으면 캡처를 거부**한다. 웹 두 파일은 캡처 분기를 캡처 직후 제거했다(웹 tsconfig에 node 타입이 없음). 모두 다시 캡처하지 않는다.
- 비교: 캡처 직후 HEAD 코드에서 비교 테스트 통과 확인 → 이후 모든 WU 뒤에도 통과.

### 8.3 WU1 — chat.router.test "question 비면 400"이 404 (§7.18.4) 조사

계측은 모두 scratchpad 복사본(`git archive HEAD` + `pnpm install --offline`, OneDrive 밖)에서 했다. 제품 트리 계측 코드 0.

1. **코드 경로**: 라우트 체인은 `authenticate → rateLimiter → validateRequest(chatRequestSchema) → handler`. `question: ""`은 `z.string().trim().min(1)`에서 실패해 **핸들러 진입 전에 400**으로 끝난다. 404를 내는 곳은 핸들러 안의 `resolveSolutionContext`뿐이라, **공유 `inMemoryProblemStore`가 새거나 순서가 바뀌어도 이 요청은 404가 될 수 없다**. 이 요청이 404를 받으려면 응답이 이 앱의 체인에서 나오지 않았어야 한다(라우트가 없는 다른 앱/서버의 Express 기본 404 등).
2. **저장소 격리**: vitest 기본 `isolate: true`(api `vitest.config.ts`는 바꾸지 않음) → 파일마다 모듈 인스턴스가 따로다. 파일 안에서는 `beforeEach`가 `clear()` 후 다시 채운다. 실측: chat.router.test 단독 `--sequence.shuffle` 시드 1~20 → **20/20 통과**, `src/modules` 전체를 단일 워커(`--no-file-parallelism`)·파일/테스트 순서 섞기로 10회 → **10/10 통과**.
3. **계측 ①~③(§7.17.1)**: 복사본 전용 setup 파일로 (a) 모든 서버 응답에 프로세스·서버 일련번호 헤더를 붙이고, 클라이언트 응답마다 "방금 만든 그 서버의 응답인가"를 대조, (b) keep-alive 소켓 재사용, (c) 1초 넘는 테스트·실패 테스트의 CPU 사용량, (d) 파일별 이벤트 루프 지연(`monitorEventLoopDelay`)을 기록. **루트 게이트와 같은 동시 부하**(api 2벌 + web 1벌 동시 실행) 12라운드 = api 전체 24회·web 전체 12회, load average 최대 95: api 810/810 × 24, web 1,159/1,159 × 12 **전부 통과**, 다른 서버 응답 0, 소켓 재사용 0, 1초 넘는 테스트 0, 이벤트 루프 지연 최대 1,076ms.
4. **같은 증상을 내는 환경 기제(실험으로 확인)**: macOS에서 `listen(0)`(`::`)은 **같은 프로세스 안**에 이미 `127.0.0.1:P`에 묶인 소켓이 있으면 그 포트 P를 받을 수 있고, supertest는 `127.0.0.1:P`로 접속하므로 요청이 그 다른 서버로 간다 — 실험에서 정확히 "404 FOREIGN"을 받았다. **다른 프로세스**가 `127.0.0.1:P`를 잡고 있으면 커널이 P를 건너뛰어 충돌하지 않았다(VS Code helper 등 외부 리스너 3개는 해당 없음, 외부 리스너 3,000개를 미리 잡아도 0건). api 테스트 코드에는 `127.0.0.1` 전용 리스너가 없다(grep) — **이 스위트에서 이 기제를 일으킬 요인은 찾지 못했다.**
5. **판정: 원인 미확정, 재현 0/N(N = 동시 부하 api 전체 24회 + 순서 섞기 30회).** 결함 근거가 없어 코드는 고치지 않았다. Stage 5가 바꾼 chat 경로에는 새 테스트(`chat.router.figures.test.ts`)를 붙였고 기존 `chat.router.test.ts`는 수정하지 않았다.
6. 부수 관찰: 저장소의 `node_modules/.pnpm/node_modules/`에 OneDrive가 만든 충돌 사본 2개(`@vitejs/plugin-react 2`, `@exodus/bytes 2`)와 클라우드 전용(dataless) 항목 1개(`@exodus/bytes`)가 있다. rsync가 이 dataless 항목을 읽다가 멈췄다(복사본은 `git archive`로 다시 만듦). 테스트 실패와의 관련은 확인하지 않았다 — 게이트 플레이크 가설(§7.17.4)의 추가 정황으로만 기록한다.
7. 재발 시: 위 setup(서버 일련번호 헤더 대조)을 복사본에 다시 넣고 실패 실행의 `foreign-response` 기록 유무로 "다른 서버 응답"인지부터 가른다.

### 8.4 변경 파일

- DB(신규, **적용·연결하지 않음**): `supabase/migrations/20261025000000_solution_figures.sql`, `supabase/migrations/20261025000100_resume_solutions.sql`
- api: `config/env.ts`(+`env.test.ts`), `.env.example`, `tsconfig.build.json`(`src/test-support/**` 빌드 제외), `infrastructure/persistence/problemRepository.ts`, `infrastructure/store/inMemoryProblemStore.ts`, `infrastructure/store/resolveSolutionContext.ts`, `infrastructure/ai/adapter.ts`(`ChatRequest.figureContext?`·`ChatFigureContext`), `infrastructure/ai/openai-adapter.ts`(`buildChatUserMessage` 그림 섹션), `modules/figures/streamFigures.ts`(`onAccepted`), `modules/solutions/solutions.router.ts`, `modules/resume/resume.router.ts`(`ResumeRouteOptions.resumePersistEnabled`), `modules/chat/chat.router.ts`(`ChatRouteOptions.figuresEnabled`), 신규 `modules/chat/chatContext.ts`(history 상한·도형 맥락 — 계획 §4에 없던 보조 파일, 라우터에서 분리)
- api 테스트(신규): `test-support/fakeSupabase.ts`(메모리 가짜 PostgREST), `contracts/chatOff.baseline.test.ts`, `contracts/persistenceOff.baseline.test.ts`, `contracts/figureChatSummary.contract.test.ts`(+`__snapshots__`), `persistence/solutionFigures.persist.test.ts`, `persistence/resumeSolutions.persist.test.ts`, `store/inMemoryProblemStore.test.ts`, `modules/solutions/solutions.router.persist.test.ts`, `modules/resume/resume.router.persist.test.ts`, `modules/chat/chat.router.figures.test.ts`
- validation·shared-types: `validation/src/index.ts`(`chatRequestSchema.figureContext`, `problemHistoryDetailSchema.resumeSolution`), `validation/src/figures.ts`(export), 신규 `validation/src/figures/chatSummary.ts`, `shared-types/src/index.ts`(`ChatFigureContextRequest`·`ChatFigureSummary` 등)
- web: `shared/api/chatMessage.ts`(+test), `features/follow-up-chat/useChatMessages.ts`(+test), `features/problem-input/ProblemInputContext.ts`(타입만 — Provider는 훅 함수를 그대로 넘겨 변경 불필요), `pages/solve/landscape/SolveLandscapePage.tsx`, `shared/api/problemHistory.test.ts`
- web 테스트(신규): `follow-up-chat/__baseline__/chatRequest.baseline.*`, `pages/mypage/__baseline__/myPageDetailDom.baseline.*`, `figure-visualization/stepStateParity.test.ts`, `app/figuresChatStep.integration.test.tsx`, `app/figuresChatStepOff.integration.test.tsx`
- 변경 금지 파일(계획 §4 끝) diff 0. 기존 테스트 수정·삭제 0(기존 파일에는 테스트 추가만: `env.test.ts`·`chatMessage.test.ts`·`useChatMessages.test.tsx`·`problemHistory.test.ts`). 새 의존성 0. 실제 OpenAI 호출 0, 실제 Supabase 연결 0.

### 8.5 설계 메모(구현 중 결정, 계획과 다른 점)

- **run id 연결 방식**: 계획 §3.4의 `saveSolutionFigures({problemId, runId, …})` 대신 `saveSolutionFigures({problemId, solution, …})`. 기존 `problemRepository.test.ts`가 `saveSolution(...)`이 `undefined`로 resolve함을 단언하고, `solutions.router.figures.test.ts`·`figuresOff.baseline`이 `saveSolution` 인자를 `{problemId, solution}`과 정확히 같게 단언해 반환값·인자를 바꿀 수 없었다. 저장소가 텍스트 upsert 때 발급한 run id를 **그 실행의 결과 객체에 묶어(WeakMap)** 두고, 같은 객체로 온 도형만 `problem_id`·`figures_run_id` 조건 update를 한다. 이전 실행 객체의 늦은 쓰기는 이전 run id로 가서 0행이 된다. resume도 같은 방식.
- **메모리 도형 연결**: `StoredProblem.solution` 객체를 바꾸지 않고 결과 객체 → 도형 WeakMap에 둔다(done payload·`setSolution` 객체 불변, 기존 테스트의 "저장소 solution에 figures 키 없음" 유지). 재풀이로 객체가 바뀌면 이전 도형은 조회되지 않는다.
- **도형 저장 시점**: `event: figures`를 실제로 쓴 뒤에만 `onAccepted`가 불린다(끊김·수용 0이면 저장 0, S5-D9). 콜백(메모리 연결 → DB update)은 `res.end()` 전에 await한다(best-effort, throw는 삼키고 로그).
- **resume 저장 조건**: 라우터 `resumePersistEnabled`(기본 env)가 off면 저장소 메서드 호출 자체가 0(RS1). on이어도 `verified !== true`면 라우터·저장소 모두에서 쓰기 0.
- **resume `ai_provider`/`ai_model`**: 어댑터가 공급자·모델을 노출하지 않아 `toSolutionFromResume`과 같은 env 값(`AI_PROVIDER` 없으면 "openai", `AI_MODEL`)을 쓴다 — **결정 필요**.
- **history 상한 세부**: 최근 12개 → 합계 8,000자 넘으면 오래된 것부터 버림, 마지막 1개만으로 넘으면 그 본문 앞 8,000자(임시값, S5-D5).
- **CHAT JSON 블록**: 한 줄 JSON, 백틱은 ```으로 이스케이프해 설명·라벨이 코드 블록을 닫지 못하게 했다.
- **알려진 한계(기록)**: PERSIST 플래그를 껐다가 다시 켜면, 꺼져 있던 동안 재풀이된 행은 도형 키 없이 텍스트만 덮어써져 이전 실행의 도형·run id가 남는다(계획 "off면 payload 바이트 동일"의 결과). 다시 켠 뒤 재조회하면 이전 도형이 새 텍스트와 함께 보일 수 있다 — 운영에서 PERSIST를 끄지 않고 유지하는 것을 권장(계획 §3.9 "유지해도 무해")하거나, 끄고 켤 때 해당 기간 행의 도형을 비우는 운영 절차가 필요하다(**결정 필요**).
- **design §18과의 차이(차단 요인)**: 이 요청 도중 작성된 `docs/FIGURE_DESIGN.md` §18.3에 "오너 결정 Q-A: 학생 풀이 줄(workLines, 가능하면 줄별 판정)을 Stage 5에서 저장하고 재조회에 보인다, 데이터 계약은 plan-agent"가 있다. 승인 계획 §3.2의 `resume_solutions`에는 workLines 컬럼이 없고 이번 구현도 계획대로다. **WU7 전에 plan-agent가 계약(컬럼·payload·상세 키)을 정해야 한다.** 마이그레이션은 아직 적용 전이라 파일 수정으로 반영할 수 있다.

### 8.6 수용 기준별 자체 결과 (development-agent 자체 검증 — QA 판정 아님)

| AC | 자체 결과 | 근거 |
|---|---|---|
| S5-1 | 이번 범위 항목 충족(MyPage DOM은 WU7에서 비교) | 플래그 4종 off(테스트 env 기본): `figuresOff.baseline` 무수정 통과(solve·resume SSE·saveSolution 인자), `persistenceOff.baseline`(saveSolution payload·resume 저장소 호출 0·상세 select·응답·목록 응답), `chatOff.baseline`(OpenAI chat 요청·어댑터 인자), 웹 `chatRequest.baseline`·`figuresChatStepOff`(본문 바이트·`figureContext` 키 0). `myPageDetailDom.baseline`은 현재 코드에서 통과(WU7 미착수) |
| S5-2 | 충족 | `solutionFigures.persist.test` "마이그레이션 전 + on"(42703·PGRST204 두 모드, 탐지 1회, 텍스트 저장, 도형 키 쓰기·읽기 0, 5분 재탐지, 롤백 시 키 없이 재시도, 상세 42703 시 기존 select로 재조회), `solutions.router.persist.test` S5-2(SSE 바이트 = 컬럼 있음) |
| S5-3 | 충족(가짜 DB; 실DB 왕복은 적용 후 오너) | 저장 행 figures = SSE figures deep-equal, 메모리 = SSE, `GET /problems/:id` 도형 = SSE, 그 사이 `generateFigures`·`repairFigure` 호출 0 |
| S5-4 | 충족 | 저장소 단위(run1 → run2 → run1 늦은 쓰기 0행) + 라우터 동시 요청(run1 도형 단계 대기 중 run2 완료 → run1 도형 도착: 메모리·DB·재조회 모두 run2) |
| S5-5 | 서버 부분 충족, 웹 parse는 WU3b 범위까지 | 변조 13종(비배열 객체·문자열·숫자·컬럼 schemaVersion 2·null·도형 내부 schemaVersion 2·HTML 라벨·양방향 제어문자 라벨·17자 초과 라벨·허용 안 되는 수식 노드·요소 10,000개(<2초)·중점 순환 참조·없는 참조)에서 상세 성공·텍스트 유지·도형 키 0, 정상+변조 섞이면 정상만. 웹: 서버가 내보내는 모양(키 없음/검증 도형)은 `problemHistory.test`에서 parse 성공 |
| S5-6 | 충족 | `chat.router.figures.test`: 단계 원문·풀이 발췌·k 기준 요약(서버 메모리 값만), 클라이언트가 보낸 `figures`·탐색 필드 무시, 잘못된 step 5종 400, 발췌 4,000·단계 1,000 상한, history 12개·8,000자 상한, 도형 없으면 `figureContext` 키 0. OpenAI user 메시지 섹션 순서·JSON 파싱 가능·인젝션 문자열은 JSON 한 줄 안에만(코드 블록 2줄 유지) |
| S5-7 | 충족 | resume에만 도형이 있는 문제의 CHAT: resume 도형 요약·이어풀기 발췌·단계 원문. 메모리 단위 `inMemoryProblemStore.test` |
| S5-8 | 충족 | CHAT 4회 뒤 메모리 도형 deep-equal·solution 객체 동일, 응답 키 `answerMd`만(`chatResponseSchema.strict()`), CHAT 경로에 DB 도형 쓰기 경로 없음(`saveChatTurn`만) |
| S5-12 | 충족(저장·재조회 경로) | 악성 라벨·수식·과도한 요소는 재조회 재파싱(`parseSolutionFigures`)에서 거부(S5-5 표). 저장 경로는 SSE로 보낸 최종 재파싱 결과만 쓰므로 검증 밖 값이 DB로 가지 않음(라우터 테스트: 저장 행 = SSE). 요약 경로의 라벨 재확인(`figureChatSummary.contract` 라벨 안전) |
| RS1 | 충족 | `resumePersistEnabled` off: 저장소 메서드 호출 0·Supabase 호출 0·SSE 바이트 = on(테이블 있음) |
| RS2 | 충족 | PGRST205·42P01: 쓰기 0·throw 0, 상세 200·`resumeSolution` 키 없음, 탐지 1회·5분 재탐지, solutions 쿼리 영향 0, 탐지 뒤 테이블 사라지면 사용 불가로 되돌림. 라우터: SSE 정상·error 0 |
| RS3 | 충족 | verified: done 쓰기 **전** upsert 1회(쓰기 순서 기록), 행 = done payload + ai·updated_at·도형 null·run id. verified=false: 쓰기 0·이전 행 유지 |
| RS4 | 충족 | own → alternative: 행 1개 교체·도형 null·새 run id, 이전 실행의 늦은 도형 쓰기 0행 |
| RS5 | 충족 | 도형 update 후 상세 `resumeSolution.figures` = SSE, 어댑터 호출 0, 변조 3종은 도형만 빠짐, 깨진 행·조회 오류·throw면 키만 빠짐 |
| RS6 | 충족 | 키 없음 응답 parse·바이트 동일, 예전 웹 스키마(`omit resumeSolution`)도 새 응답 parse 성공, 행 없음이면 키 없음, `null`은 거부(서버는 생략) |
| RS9 | 충족 | resume 저장 throw → done 전송·error 0, solve 도형 저장·메모리 연결 throw → done·figures 그대로·error 0 |
| RS10 | 충족 | 목록 `GET /problems` 호출·응답 = WU0 기준값(`persistenceOff.baseline`), `listProblems` 코드 무변경 |

이번 범위 밖: S5-9·S5-10·S5-11·S5-13 일부·S5-14·S5-15·RS7·RS8·S5-R·S5-D(WU7·WU8·WU8b·WU10·WU11 또는 오너).

### 8.7 변이 시험(OneDrive 밖 복사본에서만, 매번 원복)

| 변이 | 결과 |
|---|---|
| 도형 update에서 `.eq("figures_run_id", runId)` 제거 | 실패(S5-4 늦은 쓰기·update 조건 단언) |
| resume 라우터 `resumePersistEnabled` 조건 제거 | 실패(RS1) |
| chat 라우터가 `figuresEnabled`와 무관하게 맥락 구성 | 실패(off 인자 동일) |
| 메모리 연결의 "같은 객체" 조건 제거 | 실패(재풀이 뒤 이전 실행 연결 무시) |
| 저장소 `verified !== true` 가드 제거 | 실패(RS3 verified=false 쓰기 0) |
| 페이지 `chatFigureContextArgs`가 플래그와 무관하게 `[{ step }]` | 실패(웹 off 인자) |
| `streamFiguresPhase`가 보내지 않은 도형도 콜백에 넘김(`sent` 미설정 → 콜백 0으로 바뀌는 변이) | 실패(저장·연결 1회) |
| CHAT JSON의 백틱 이스케이프 제거 | 처음엔 **생존**(코드 블록 줄 수만 봤음) → 테스트에 "JSON 줄에 백틱 0" 단언 추가 후 실패 확인 |

### 8.8 게이트

| 실행 | typecheck | lint | test | build |
|---|---|---|---|---|
| 저장소 루트(OneDrive) **첫 실행** | 0 | 0 | 0 — api 69 파일/931, web 112 파일/1,181 | 0 — 메인 `index-DA3gjFQy.js` 972,912B, JS 청크 1, precache 8(1021.58 KiB) |
| OneDrive 밖 복사본(`git ls-files -co` 트리 + `pnpm install --offline`) 첫 실행 | 0 | 0 | 0 — api 931, web 1,181 | 0 — 같은 해시 `index-DA3gjFQy.js` |
| 저장소 루트 2차(변이 시험 뒤 테스트 단언 1개 추가 후) | 0 | 0 | 0 — api 931, web 1,181 | 0 — 같은 해시 |

- §7.18.4 예외 적용 없음(실패 0). 두 환경 결과 동일 — 이번에는 비교할 차이가 없었다.
- off 빌드: 메인 번들 +372B(Stage 4 후속 972,540B 대비, CHAT 인자 분기). 커널 문자열(`dependency_not_visible`)·`JXG`·`jsxgraph`·`SolutionFigures`·`buildFigureChatSummary` 0.

### 8.9 stage-qa 재현 방법

- 기준값: `pnpm -F api exec vitest run src/contracts` · `pnpm -F web exec vitest run src/features/follow-up-chat/__baseline__ src/pages/mypage/__baseline__`
- 영속: `pnpm -F api exec vitest run src/infrastructure/persistence src/infrastructure/store src/modules/solutions/solutions.router.persist.test.ts src/modules/resume/resume.router.persist.test.ts`
- CHAT: `pnpm -F api exec vitest run src/modules/chat src/contracts/figureChatSummary.contract.test.ts` · `pnpm -F web exec vitest run src/app/figuresChatStep.integration.test.tsx src/app/figuresChatStepOff.integration.test.tsx src/features/figure-visualization/stepStateParity.test.ts`
- 가짜 Supabase(`apps/api/src/test-support/fakeSupabase.ts`)는 `tablesFor({ figureColumns, resumeTable })`로 마이그레이션 전/후를 고른다. `setTables`로 테스트 중 적용·롤백을 흉내낸다.
- WU1 계측 setup은 복사본 전용이었다(제품 트리에 없음). 같은 계측이 필요하면 §8.3의 설명대로 vitest `setupFiles`에 서버 일련번호 헤더 대조를 넣는다.

### 8.10 진행 순서 메모

WU0 캡처는 코드 변경 전에 했다. WU1 계측은 HEAD 복사본에서 진행했고, 계측 실행(백그라운드 부하 12라운드)이 도는 동안 제품 트리에서 WU2(마이그레이션 파일·저장소)를 시작했다 — 계측 대상은 HEAD 복사본이라 결과에 영향이 없다. 원인 미확정이라 WU1이 요구한 수정은 없다.

### 8.11 남은 일·결정 필요

- **차단(WU7 전)**: design §18.3 오너 결정 Q-A(workLines 저장)를 반영한 데이터 계약 — plan-agent. 마이그레이션 `20261025000100_resume_solutions.sql`에 컬럼이 필요하면 적용 전에 수정한다.
- 결정 필요(임시값): 재탐지 5분(S5-D4), history 12개·8,000자(S5-D5), 발췌 4,000·단계 1,000·도형당 3,000·합계 6,000(S5-D6), resume `ai_provider`/`ai_model` 출처, PERSIST 끄고 켤 때 남는 이전 도형 처리(§8.5).
- 오너: 마이그레이션 2종 적용(적용 전엔 S5-2·RS2로 보증), 적용 뒤 서버 재시작, RS7(cascade)·S5-3 실DB 왕복 확인.
- 다음 요청: WU7(design §18 확정 뒤), WU8·WU8b(R3 실제 30회)·WU10(문서: FIGURE_SPEC §8·§10·§17, API_SPEC, PRD, DEPLOYMENT 플래그 4종 조합표, COMPONENT_MAP, PROJECT_STATUS)·WU11.

---

### 8.12 2차 요청(2026-10-25) — §12 보완·WU7a·WU7·WU8·WU8b·WU10·WU11

#### 8.12.1 오케스트레이터 결정(기록)

| 결정 | 처리 |
|---|---|
| resume 저장 행의 `ai_provider`/`ai_model`은 env 값 | 그대로(`resume.router.ts` `persistVerifiedResume` 주석). 어댑터가 공급자·모델을 노출하지 않음 |
| PERSIST를 껐다 켜면 이전 도형이 남는 한계는 수용·문서화 | `docs/DEPLOYMENT.md`(환경변수 표·Stage 5 플래그 절)에 "한번 켜면 끄지 않는 것을 권장", `docs/FIGURE_SPEC.md` §10 |
| 임시값 유지 + 코드 "결정 필요" 주석 | 재탐지 5분(`PERSIST_REDETECT_AFTER_MS`), history 12개·8,000자·발췌 4,000·단계 1,000(`chatContext.ts`), 도형당 3,000·합계 6,000(`chatSummary.ts`), workLines 50줄·500자·32KB(`RESUME_WORK_*`, 마이그레이션 주석) — 모두 "결정 필요" 주석 있음 |
| run id를 WeakMap으로 묶는 방식 수용 | 근거(§8.5 첫 항목): 기존 `problemRepository.test.ts`가 `saveSolution`의 반환값 `undefined`를, `solutions.router.figures.test.ts`·`figuresOff.baseline`이 인자 `{problemId, solution}` 정확 일치를 단언 → 반환값·인자를 바꾸면 기존 테스트 완화가 필요. 실행 결과 객체를 키로 쓰면 시그니처 무변경 + "같은 실행의 도형만 같은 run id로" 가 자연히 성립(이전 실행 객체 → 이전 run id → 0행) |

#### 8.12.2 §12 보완(WU2b·WU2c·WU3·WU3b)

- 마이그레이션 `20261025000100_resume_solutions.sql` create table에 `work_lines jsonb`·`last_valid_line smallint`·`stall_line smallint` + check 3개(§12.1 그대로). 적용·연결 0.
- 저장소: upsert에 세 컬럼 항상 포함(값이 없거나 검사 실패면 셋 다 null — 모드 변경 시 이전 줄이 남지 않게). 검사 `resumeWorkContextSchema`(validation, lineNo 1~999 정수·중복 없음·오름차순, latex ≤500자, ≤50줄, JSON ≤32KB UTF-8). 실패 로그는 issue code·path만, resume 쓰기 오류 로그는 DB 오류 code만(Postgres "Failing row contains" 문구에 줄 내용이 들어갈 수 있어서). 상세는 관대 파싱(실패 시 `workContext` 키만 생략). 탐지 쿼리 `select("id, work_lines").limit(0)`.
- WU2c: `inMemoryProblemStore.diagnosedWorkLines`/`setDiagnosedWorkLines`, `diagnosis.router.ts` 진단 직후 1줄. resume 저장은 `diagnosedWorkLines ?? workLines`(lineNo 정렬). resume 프롬프트·priorWork는 기존처럼 인식 원본 `workLines` — `diagnosis.workLines.test.ts`가 진단 응답·resume SSE·resume 어댑터 요청·priorWork를 "새 줄 무력화 실행"과 문자열 비교로 확인.
- WU3b: `problemHistoryDetailSchema.resumeSolution.workContext?`, `shared-types` `ResumeWorkContext`.
- **Stage 5 내 기대값 수정 2건(내가 만든 테스트, §12 계약 추가 때문)**: `resumeSolutions.persist.test.ts` RS3 payload 단언에 `work_lines/last_valid_line/stall_line: null` 추가, 상세 select 문자열에 work 컬럼 3개 추가.

#### 8.12.3 WU7a·WU7(화면)

- `HistoryDetailPanel`: 루트 `fixed inset-x-0 top-0 h-dvh`. 첫 렌더에서 `document.activeElement`를 잡아 두고 마운트 시 "목록으로"에 포커스, 언마운트(닫기 3경로 모두) **passive effect 정리 단계**에서 복귀 — 같은 커밋에서 MyPage가 배경 `inert`를 걷어낸 뒤라야 포커스가 막히지 않는다(layout 정리 단계는 inert 제거보다 먼저 돈다). 잡아 둔 요소가 사라졌거나 `body`(Safari는 버튼 클릭에 포커스를 주지 않음)면 `getFallbackFocus`(MyPage: 연 행 상세 버튼 → 목록 첫 행 → NavTabBar 현재 탭). JS 트랩·전역 keydown 추가 0.
- MyPage: `header`·`main`에 `inert={selectedProblemId !== null}`. 상세 조립: `ResultPanel`에 `resumeContent`(새 prop, 답 다음·대화 앞)와 `answerMd: string | null`(null이면 AnswerBox 없음). resume 섹션 = `<section aria-labelledby>` h3 "이어풀기 결과"(solve 있을 때만 보임 + `pt-3`, 아니면 `sr-only`) → WorkLineList(읽기 전용, `deriveWorkLineJudgments(workContext.lines, workContext)`) 또는 own + workContext 없음이면 S5-V3 문구 → ResumeResultCard(무수정, `currentStep=resumeStep`, `figureContent=savedFigureSlot(...)`). 단계 state 결과별(`solveStep`·`resumeStep`), 문제 전환·닫기 시 최종.
- `LazySolutionFigures`: 페이지의 `figureSlotContent`·lazy 정의를 옮김(`splitSolutionSteps(...).ok` 직접 사용) + 재조회 `savedFigureSlot`(도형 0이면 `undefined`). 지연 청크 진입점은 `lazyEntry.ts` 하나. `SavedSolutionFigures`는 렌더러와 같은 `parseFigureSpec`로 원소를 다시 확인(figureId 중복 제거, 최대 3).
  - **번들 함정(발견·수정)**: 처음엔 `SavedSolutionFigures`가 `validation`의 `parseSolutionFigures`를 불렀는데, 이 함수가 메인 번들도 쓰는 모듈(`figures.ts`)에 있어 on 빌드에서 검증 커널이 메인이 정적으로 불러오는 공통 청크(`FigureErrorBoundary-*`)로 옮겨졌다(`dependency_not_visible` 1 — HEAD·WU6 상태 on 빌드는 지연 청크에만). `parseFigureSpec`로 바꾼 뒤 커널은 `lazyEntry-*` 청크에만(§8.15).
- 한 줄 배치(S5-V7·V8·V10): `RecognizedProblemBar`(행 `items-start`, 배지 `shrink-0 whitespace-nowrap`, 본문 `min-w-0 pt-0.5 wrap-anywhere`, 버튼 `whitespace-nowrap pt-0.5` + 포커스 링 `outline-none focus-visible:ring-2 ring-brand ring-offset-2 rounded-[6px]`), `RecognizedChip`(배지 래퍼 `shrink-0`, 배지 `whitespace-nowrap`), `WorkLineList`(판정 배지 2곳에 `shrink-0 whitespace-nowrap`만 — diff 2줄). `deriveWorkLineJudgments`는 매개변수 타입만 `Pick`으로 넓힘.
- **WU0 DOM 기준값 차이 처리(사유 기록)**: `resultDom.baseline`(Stage 4 WU0)·`myPageDetailDom.baseline`(Stage 5 WU0)·`elevatedCardUsage.test`가 RecognizedProblemBar 클래스 변경으로 실패 → diff를 확인하니 **차이가 S5-V7·V8·V10 클래스 토큰뿐**(카드 `items-center`→`items-start`, 배지 +2, 본문 +3, 버튼 +7). 기준값 JSON은 고치지 않고 `src/test/stage5OneLineDelta.ts`가 비교 직전 **기준값 쪽 그 노드에만** 승인 토큰 증감을 적용 — 그 밖의 태그·속성·텍스트·토큰이 하나라도 다르면 여전히 실패. `elevatedCardUsage`의 RecognizedProblemBar 기대 토큰은 `items-start`로 바꿈(주석). MyPage 기준값 비교는 class 토큰 순서만 무시(resultDom과 같은 방식)하게 바꿈. 실시간 화면 기존 통합 테스트는 수정 0으로 통과.

#### 8.12.4 WU8 통합 QA

- 서버 왕복 `apps/api/src/contracts/figuresStage5.integration.test.ts`(73 테스트): 테스트 전용 stub 어댑터(fake-adapter 무변경)로 사례 1~9 × 컬럼 있음/없음: SSE figures = 서버 재파싱 기대값, 메모리 = SSE, DB 행 = SSE(컬럼 있음)·도형 키 0(없음), 상세 parse(웹 스키마) = SSE, 상세 동안 생성 호출 0, CHAT k = null·1·2·3에서 어댑터가 받은 요약의 점 좌표 = fixture 손 계산값 + 사례별 독립 사실(F01 각 45° 제약, F02 H·CH⊥AB, F04 OM·AB 내적 0, F05 외적 부호 반대, F07 V·근, F08 점근선 요소, F09 k별 강조·숨김), CHAT 뒤 도형 불변. 사례 10 = F10a~j + F11a~ad **37건**: `validateFigureCandidate`가 fixture의 code·path로 거부, done 있음·figures·error 0, 텍스트 저장·도형 null·update 0, 상세 키 없음, CHAT `figureContext` 없음. resume 대표(F09): SSE → 메모리 → resume_solutions → 상세(`workContext` 포함) → CHAT 요약.
- 웹 렌더 좌표 `apps/web/src/features/figure-visualization/stage5Cases.render.test.ts`(**실제 JSXGraph**, 648px 보드): 서버 재파싱 → 상세 parse → 다시 검증 → 장면 → 보드, 그려진 SVG 점 중심을 보드 좌표로 되돌린 값 = 손 계산값(소수 둘째 자리), 각도는 그려진 세 점으로 atan2 독립 계산(F01 45°, F02 90°, F05 OT⊥TP 90°), F04 내적 0, F05 외적 부호, F08 곡선 조각 2, F09 k=1·2·3·최종 라벨 표시.
- 헤드리스(`.omc/research/figures-stage5-headless/{server.mts,run.mjs}`, 결과 `out/stage5.json`, 캡처 `out/shots/`, **물리 iPad 아님**): Playwright 1.63 Chromium·WebKit, hasTouch, 1194×834. 서버는 저장소 라우터 조립 + 메모리 가짜 PostgREST(마이그레이션 2종 적용 상태) + 가짜 Supabase 인증(HTTPS 54398), 긴 문제·긴 학생 줄·3번째 줄 오류 CAS. 웹 vite 5199(플래그 on). 오너 dev 서버(5173·4000·8000)는 건드리지 않음.

| 항목 | Chromium | WebKit |
|---|---|---|
| "인식됨" 배지(결과 패널, 카드 안 346px, 본문 6~7줄) | 1줄·22px | 1줄·22px |
| "수정" 버튼(결과 패널·진단 화면) | 1줄 | 1줄 |
| "인식됨"(RecognizedChip, 필기 화면) | 1줄·20px | 1줄·20px |
| "막힌 지점"·"확인"(진단 화면 WorkLineList, 긴 줄) | 1줄 | 1줄 |
| 오버레이(카드 안 646px) "인식됨"·"다시 풀기" | 1줄 | 1줄 |
| 마이페이지 resume만: "저장된 풀이가 없는 문제예요" 없음 · h3 sr-only · 학생 줄 · "막힌 지점" 1줄 · "확인" 2 · "수정" 링크 0 | 충족 | 충족 |
| 열 때 포커스 "목록으로", header·main inert | 충족 | 충족 |
| 닫기 3경로(목록으로·Escape·배경) → 연 행 상세 버튼 복귀·inert 해제 | 3/3 | 3/3 |
| Tab 20회 동안 대화상자 밖(배경) 포커스 | 0 (대화상자 15·문서 끝 body 5) | 0 (WebKit 기본 설정은 Tab이 버튼에 가지 않아 body 20 — 버튼 순환은 실기기 확인 필요) |
| `h-dvh`: 높이 834 → 500 → 834에서 오버레이 루트 높이 | 834 → 500 → 834, 대화상자 아래끝 ≤ 500 | 같음 |
| 같은 단계 = 같은 그림(solve 그림, 최종→3→2 vs 1→2, 보이는 요소 속성) | 같음, k=1과는 다름 | 같음 |
| 오버레이 10회 열고 닫기(3경로 섞음) — 열린 동안 보드/닫은 뒤 보드 | 1/0 × 10, 최종 0 | 1/0 × 10, 최종 0 |
| CHAT: 스테퍼 2단계에서 질문 → 서버가 받은 본문 | `{question, history, figureContext:{step:2}}` | 같음 |
| 콘솔 오류 | 기존 suggestions 400 1건(resume 문제, Stage 4 헤드리스에도 있던 동작)만 | 같음 |

- 관찰(LOW, 기존 렌더러 동작): 강조된 적 없는 숨김 언더레이(`-u`)는 처음 기본 stroke를 갖고 있다가 한 번 강조된 뒤엔 언더레이 색을 유지한다 — `display:none`이라 화면 차이 0. 그래서 스냅샷 비교는 보이는 요소만(숨김 여부는 비교). 보드 폭은 설계 파생값 648이 아니라 **644px**(오버레이 테두리 1px·카드 테두리 등) — 새 값을 만든 것이 아니라 파생 계산 차이(design 확인 필요).
- 하니스 경로 버그 수정: Stage 4 `run.mjs`의 `new URL("./out/", import.meta.url).pathname`은 한글 경로를 %인코딩해 `~/Library/CloudStorage/OneDrive-%E1…` 폴더를 만든다(§7.18.5에서 QA가 찾던 그 폴더). Stage 5 `run.mjs`도 처음엔 같은 코드라 그 폴더를 만들었고(내용은 Stage 5 출력뿐, 생성 12:09), 출력은 올바른 위치로 옮기고 그 폴더는 지웠다. `fileURLToPath`로 고침. Stage 4 `run.mjs`는 고치지 않았다(기록).

#### 8.12.5 WU8b — R3 실제 호출(오너 승인), 결과 `.omc/research/figures-stage5-textcheck.json`

스크립트 `apps/api/scripts/evalTextMarkers.ts`(게이트 밖). 먼저 `EVAL_DRY_RUN=1`(Fake, 비용 0, `figures-stage5-textcheck.dryrun.json`). 실제: 모델 `gpt-5.6-terra`, 2026-10-25, **어댑터 호출 30/30**(하드 카운터 30, 요청별 `maxRetries: 0`·30초), 실패 0, **도형 호출 0**, 재실행 0. 로컬 CAS(127.0.0.1:8000) 실제 검증. 키 문자열·`sk-` 결과 파일·로그 grep 0. off 대조군 없음.

| 지표 | 결과(비율은 Wilson 95% CI) |
|---|---|
| solve 20: 개념 JSON 위치 | 맨 끝 20 / `## 최종 답` 바로 아래 0 / 중간 0 / 없음 0 |
| conceptTags 파싱 | 20/20 (0.839~1) |
| answerMd 빈 값·혼입(`concept_tags`·`{"`·`**N단계**`) | 0 · 0 |
| D-4 폴백(boxed·empty) | 0 · 0 |
| 단계 분할 성공 | 19/20 (0.764~0.991) — 실패 1 = X4(그림 없는 "그림과 같이" 문제, `no_markers`) |
| `## 풀이` 있음 | 20/20 |
| 파서 정상화 효과(74ddd3b 파서 실패 → 현재 정상) | 0건(이 표본에서는 이전 파서도 실패 0) |
| resume 10(own 5·alt 5): 최종 답 순수 LaTeX | 10/10 (0.722~1) |
| resume CAS verified | 8/10 (0.49~0.943) — 미통과 2 = 좌표쌍 답 `(2,2)`·`(1,3)`(기대값과 수학적으로 같음, CAS가 순서쌍을 비교 못 하는 것으로 보임 → 이런 결과는 저장되지 않는다, §8.16) |
| resume 단계 분할 | 10/10 |
| 지연(호출 1회 전체) | p50 3,836ms · p95 5,742ms · 최대 5,997ms |
| 토큰(30회 합) | 입력 18,282 · 출력 13,096 |

R1(CHAT 도형 맥락 실평가)·R2(22건 재평가): **NOT RUN — 오너 미승인**.

#### 8.12.6 WU10 측정(`.omc/research/figures-stage5-report/`)

- 상세 조회 서버 파싱(도형 3 × 요소 60, 로컬 300회): `parseSolutionFigures` p50 0.361ms·p95 0.445ms, `getProblemDetail` 전체(가짜 DB) p50 0.356ms·p95 0.413ms. **원본은 `measure.json`**(재작업 1, QA LOW-3 정정 — 처음 적은 0.388/0.467·0.406/0.499는 스크립트 정리 전 첫 실행 값이었고, 파일은 정리 후 재실행 값으로 덮였다. 행 바이트·CHAT 문자 수는 결정적이라 두 실행이 같다).
- 행당 도형 JSON 바이트: F01 955 · F02 1,497 · F03 1,280 · F04 1,361 · F05 1,686 · F06 792 · F07 1,112 · F08 919 · F09 1,850 · 3×60 상한 근처 18,667.
- CHAT user 메시지 문자 수(on/off, 단계 2, 빈 history): off 60자 기준 on +686(F08)~+1,777(F09), 도형 없음 +0.
- 번들: off 빌드 메인 `index-Cor4xjlb.js` 976,028B(HEAD 972,540B 대비 +3,488B), JS 청크 1, precache 8, 커널·JXG·jsxgraph·SolutionFigures·lazyEntry 문자열 0, `sw.js` CacheFirst 0. on 빌드: 메인 886,293B(커널 0), 공통 `FigureErrorBoundary-*` 90,131B(커널 0), `lazyEntry-*` 51,895B(커널 여기만), `jsxgraph-*` 1,040,973B, precache 12.
- 최종 JSON 예시(F09, 실제 코드 생성): `f09-examples.json` — SSE figures 이벤트, solutions 행 도형 4컬럼, GET 상세, CHAT user 메시지 그림 섹션. SSE = DB = 상세 확인.

### 8.13 WU1 원인 확정·수정(2차 요청)

- 재현: 게이트 2차(OneDrive) test에서 새 통합 테스트 F11s가 5초 타임아웃, 이어서 같은 파일 6개 동시 실행 24회 중 2회가 **401·404 단언 실패**(F09·F02, 정상이면 200). 복사본에서 §8.3 계측(서버 일련번호 헤더 대조)을 붙여 30회 동시 실행 → 실패 1건 포착: `port 49316, status 401, foreignTag null`(우리 테스트 서버의 응답이 아님).
- 49316은 VS Code helper(PID 1228)가 `127.0.0.1:49316`에 묶은 리스너다(조사 첫날 `lsof`로 본 3개 중 하나). 결정적 확인: `listen(49316)`(supertest 방식, `::`) **성공** → `127.0.0.1:49316` 요청이 외부 서버의 `401 authentication_error`를 받음, `listen(49316, "127.0.0.1")`은 **EADDRINUSE**. 1차 요청 때의 "다른 프로세스면 커널이 건너뛴다" 실험은 Node가 만든 리스너(SO_REUSEADDR)로 한 것이라 VS Code helper 경우와 달랐다(1차 판단 정정).
- 판정: **테스트 하니스 결함.** supertest가 `app.listen(0)`(`::`)으로 띄우고 `127.0.0.1`로 접속하는데, macOS가 외부 프로세스의 127.0.0.1 전용 리스너와 같은 포트를 내줄 수 있다 → 요청이 외부 서버로 가서 401·404(§7.18.4 chat 404, 56ms)를 받거나 응답이 없어 타임아웃. Stage 4의 api 5초 타임아웃들(work 라우터·figures throw)도 같은 기제와 맞지만 개별 증명은 못 했다(웹 jsdom의 6초대 집단 타임아웃은 다른 현상 — 소켓 없음).
- 수정: `apps/api/src/test-support/loopbackListen.ts`(vitest `setupFiles`, `apps/api/vitest.config.ts`): supertest가 서버를 직접 띄우는 경우만 `listen(0, "127.0.0.1")`로 묶고(같은 주소면 커널이 충돌을 감지해 다른 포트를 줌), 호스트 지정 listen이 비동기라 listening 뒤 URL을 정해 `end`를 잇는다. 제품 코드·기존 테스트 무변경.
- 검증: 수정 후 같은 동시 실행 48회 **실패 0**, 모든 리스너 127.0.0.1(12,960건), VS Code helper 포트 배정 0. 수정 전 같은 조건 54회 중 3회 실패.
- 남은 범위: `app.listen(0)` + `http.request({ port })`(호스트 기본 localhost)를 쓰는 테스트 4곳은 그대로(`::` + ::1/127.0.0.1 자동 선택) — 외부 IPv6 루프백 리스너가 생기면 같은 부류가 다시 가능하다(기록).

### 8.14 변경 파일(2차 요청 추가분)

- DB: `supabase/migrations/20261025000100_resume_solutions.sql`(work 컬럼·제약 추가, 미적용)
- api: `infrastructure/persistence/problemRepository.ts`(workContext·탐지·로그), `infrastructure/store/inMemoryProblemStore.ts`(`diagnosedWorkLines`), `modules/diagnosis/diagnosis.router.ts`(1줄), `modules/resume/resume.router.ts`(workContext), `vitest.config.ts`(setupFiles), 신규 `src/test-support/loopbackListen.ts`, `test-support/fakeSupabase.ts`(work 컬럼·행 check), 신규 테스트 `contracts/figuresStage5.integration.test.ts`·`modules/diagnosis/diagnosis.workLines.test.ts`, 추가 테스트(`resumeSolutions.persist.test.ts` RS11, `resume.router.persist.test.ts` RS11), 신규 `scripts/evalTextMarkers.ts`(게이트 밖)
- validation·shared-types: `resumeWorkContextSchema`·`RESUME_WORK_*`, detail `workContext`, `ResumeWorkContext`
- web: `features/learning-history/HistoryDetailPanel.tsx`(+test), `features/ai-solution/{ResultPanel.tsx(+test), RecognizedProblemBar.tsx, WorkLineList.tsx(배지 2곳 클래스만)}`, `features/solve-session/RecognizedChip.tsx`, `features/figure-visualization/{LazySolutionFigures.tsx, SavedSolutionFigures.tsx, lazyEntry.ts}`(신규), `shared/lib/solve/deriveWorkLineJudgments.ts`(타입), `pages/mypage/MyPage.tsx`, `pages/solve/landscape/SolveLandscapePage.tsx`(lazy 정의 이동), 신규 테스트 `pages/mypage/{MyPage.stage5.test.tsx, MyPage.figures.test.tsx}`·`features/figure-visualization/stage5Cases.render.test.ts`·`test/stage5OneLineDelta.ts`, 기준값 비교 조정(`resultDom.baseline.test.tsx`·`myPageDetailDom.baseline.test.tsx`·`elevatedCardUsage.test.tsx` — §8.12.3 사유), `shared/api/problemHistory.test.ts`(workContext)
- 문서: `FIGURE_SPEC.md`(§8 버전 구조·§10 저장·§17 CHAT), `API_SPEC.md`(Stage 5 추가), `DEPLOYMENT.md`(PERSIST 2종·4종 조합표·켜는 순서·끄지 않기 권장), `PRD_WHYMATH.md`(FIG-12·13), `COMPONENT_MAP.md`(LazySolutionFigures·사용처), `PROJECT_STATUS.md`, 이 장부. `FIGURE_DESIGN.md` §18은 design-agent 작성분(수정하지 않음).
- 연구 산출물: `.omc/research/figures-stage5-headless/`, `.omc/research/figures-stage5-r3/parseSolveOutput.74ddd3b.ts`(비교용 이전 파서 사본), `.omc/research/figures-stage5-textcheck{,.dryrun}.json`, `.omc/research/figures-stage5-report/{measure.mts,measure.json,f09-examples.mts,f09-examples.json}`
- 변경 금지(계획 §4 + §12.7) diff 0: `WorkLineList.tsx`는 허용된 클래스 2개만, `diagnosis.router.ts`는 허용된 1줄만. `ResumeResultCard`·`DiagnosisCard`·`Modal`·`button/*`·`work.router`·`cas/*`·`parseResumeOutput`·`parseSolveOutput`·`prompts/*`·`figuresJsonSchema`·`figuresOff.baseline.*`·drawing-canvas·`shared/lib/canvas`·`shared/styles`·`ChatFooter`·`ChatBubble`·`SolutionFigures.tsx`·`render.yaml`·package.json·락 0. 새 의존성 0. `node_modules`의 OneDrive 충돌 사본·dataless 항목은 건드리지 않음.

### 8.15 수용 기준 자체 결과 — Stage 5 전체(development-agent 자체 검증, **QA 판정 아님**)

| AC | 자체 결과 | 근거(테스트·헤드리스) |
|---|---|---|
| S5-1 | 충족 | 플래그 4종 off(테스트 기본): `figuresOff.baseline` 무수정, `persistenceOff`·`chatOff`·`chatRequest` 기준값, `figuresChatStepOff`, MyPage DOM 기준값(승인 클래스 증감만 적용, §8.12.3) |
| S5-2 | 충족 | §8.6 |
| S5-3 | 가짜 DB 충족(실DB는 적용 후 오너) | §8.6 + 통합 하니스 사례 1~9(컬럼 있음) + `f09-examples.json` |
| S5-4 | 충족 | §8.6 |
| S5-5 | 충족 | 서버 변조 13종 + workContext 변조 6종, 웹 parse(`problemHistory.test`), MyPage 변조 도형 → 카드 0·보드 0(`MyPage.figures.test`) |
| S5-6 | 충족 | §8.6 + 헤드리스 CHAT 본문 `{step:2}` |
| S5-7 | 충족 | §8.6 + 통합 하니스 resume 대표 |
| S5-8 | 충족 | §8.6 + 통합 하니스(CHAT 4회 뒤 메모리·DB 도형 불변) |
| S5-9 | A·H 충족, D 미확인 | `MyPage.figures.test`(기본 최종·10회 후 보드 0·문제 전환 시 최종), 헤드리스(같은 k 같은 그림·10회 후 JXG 보드 0, 콘솔 오류는 기존 suggestions 400만) |
| S5-10 | A·H 충족 | jsdom: solve+resume 그림 2 = 보드 2, 닫으면 0. 헤드리스: 열린 동안 1(그림 1), 닫으면 0. StrictMode 중복 0은 기존 `FigureView.test`(Stage 2) |
| S5-11 | 충족(QA 독립 재계산 전) | 통합 하니스 73 + 웹 렌더 좌표 10 |
| S5-12 | 충족 | §8.6 + 사례 10(37건) |
| S5-13 | 충족 | 기존 테스트 수정은 §8.12.3의 기준값 비교 3곳(승인 클래스 증감)뿐, 실시간 통합 테스트 무수정 통과. 필기 회귀 통합 테스트 통과 |
| S5-14 | 충족 | 웹 off → MyPage DOM 기준값(도형 키 있는 행 포함) 동일, 웹 on이어도 도형 없는 행 DOM 동일(`MyPage.figures.test`) |
| S5-15 | 충족 | off 빌드 커널·JXG 0, on 빌드 커널은 `lazyEntry` 청크에만(메인·정적 공통 청크 0) — §8.12.6 |
| RS1~RS6, RS9, RS10 | 충족 | §8.6 |
| RS7 | NOT VERIFIED — 실DB(마이그레이션 적용 후 오너) | |
| RS8 | A·H 충족 | `MyPage.stage5.test`(resume 카드·대체 문구·"저장된 풀이가 없는 문제예요" 없음), 헤드리스(같은 확인 + 10회 후 보드 0), resume 없으면 DOM 동일(기준값) |
| RS11 | 충족 | 저장·재조회 = 진단 입력 deep-equal(저장소·라우터·통합), 51줄·501자·32KB 초과·중복·역순·lineNo 0 → 셋 다 null, 변조 6종 → 키만 빠짐, `\href`/`\htmlId`는 문자열 통과·웹 렌더에서 링크·id 0(`MyPage.stage5.test`, KaTeX trust=false), 로그 줄 내용 0 |
| RS11b | 충족 | 과거 행 키 없음, own → S5-V3 문구·WorkLineList 없음, alternative → 없음 |
| RS11c | A·H 충족 | 같은 함수(`deriveWorkLineJudgments`)·같은 컴포넌트, "수정" 링크 0, 헤드리스 실시간·재조회 모두 "막힌 지점" 1줄·"확인" 2 |
| RS12 | A·H 충족, D 미확인 | jsdom 3경로 복귀·inert·Safari형(body) 복귀, 헤드리스 두 엔진 3경로 복귀·Tab 밖 0(WebKit은 Tab이 버튼에 안 가는 기본 설정 — VoiceOver·실기기 NOT VERIFIED) |
| RS13 | A·H 충족, D 미확인 | 클래스 단언, 헤드리스 834→500 추종. iOS 하단 막대 가림은 실기기 NOT VERIFIED |
| S5-R | 실행 | §8.12.5(R3 30회). R1·R2 NOT RUN — 오너 미승인 |
| S5-D | NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED | 그림 위 터치 스크롤, VoiceOver 순서, Split View |

### 8.16 남은 일·결정 필요(2차)

- CAS가 순서쌍 답(`(2,2)` vs `(2, 2)`)을 같다고 보지 못해 이런 이어풀기는 `verified=false` → 저장되지 않는다(R3 2/10). CAS 쪽 과제(이번 범위 밖, 결정 필요).
- 오버레이 보드 실측 644px(설계 파생 648) — design 확인.
- 실기기: Stage 4 §7.5 12항목 + Stage 5 마이페이지 3항목(터치 스크롤·VoiceOver·Split View) + iOS 하단 막대.
- 마이그레이션 2종 적용(오너) → RS7·실DB 왕복.

#### 8.16.1 처리 기록(development-agent, 2026-10-25, 3차 요청 — A·B-3·B-2·B-1, 커밋 안 함)

자체 검증 결과다(QA 판정 아님). 오너 dev 서버 5173·4000·8000은 끄거나 재시작하지 않았다. 다만 api 4000은 오너의 `tsx watch`(PID 3991, 10:23 기동)가 소스 변경을 보고 **스스로** 자식 프로세스를 다시 띄웠다(22:28, 새 자식 PID 38563). CAS 8000은 `--reload` 없이 10:23부터 떠 있어 **새 코드를 반영하지 않은 상태**다.

| 작업 | 처리 | 근거·테스트 |
|---|---|---|
| **A** CAS 순서쌍·집합·여러 해(위 첫 항목, QA 이월 MEDIUM-2) | 새 `services/cas/app/core/answer_forms.py`(분류·원소별 비교), `routers/final_check.py`만 연결. 순서: `_strip_wrappers` → `\left`·`\right`·`\ `·`\,` 정리 → 쉼표 없으면 **원문 그대로** 기존 경로 → 천 단위(`^-?\d{1,3}(,\d{3})+$`)는 합쳐 기존 경로 → `(x,y)=` 좌변(서로 다른 Symbol 튜플) 제거 → 점 이름(대문자 1자 + 선택적 아래첨자) 제거 → 괄호 깊이 0 쉼표로 분할 → ordered/set/solutions/invalid. ordered끼리는 길이·순서 일치, set·solutions끼리는 양방향 매칭(순서·중복 무관), 종류 다르면 false. 원소 파싱 실패·`Eq`·관계식 원소·10개 초과·`[1,3]`·`(1,3]`·`1<x<3`·연립(`x=2, y=2` vs `(2,2)`)·다른 Symbol 목록 → false. 라우터 전체 try/except → 예외 시 200 + `verified=false`(실제 재현: `x<3` vs `3`이 기존 코드에서 TypeError). `\text{또는}`은 미룸(`_strip_wrappers`가 지우므로 쉼표 없는 기존 경로로 가서 false). `parse_to_sympy`·`step_verify` diff 0 | 신규 `tests/test_answer_forms.py` 65건(참 21쌍·거짓 20쌍 + 파싱 실패·11개·10개 경계·`Eq` 튜플·섞인 목록·분류 단위), `test_routers.py` 추가 5건(R3 두 쌍, `x<3`/`3` 200 false, scalar·composite·classify 경로 예외 주입 200 false) — 구현 전 RED 확인. 기존 `test_parser` 9·`test_equivalence` 15·`test_routers` 11 수정 0·통과. api `resume.router.test.ts` 1건 추가: `"(2, 2)"`·`"\\[\n(2,2)\n\\]"`가 가공 없이 `verifyFinalAnswer`로 가고 `verified`가 SSE done·메모리에 반영. **HTTP 확인(별도 8123, 확인 후 그 서버만 종료)**: R3 두 쌍 `{"verified":true}`, `(1,3)`/`(3,1)` false, `x<3`/`3` HTTP 200 false. README 지원 형식 표 갱신 |
| **B-3** Modal 접근성 | `useId`로 h2 id → `aria-labelledby`. `aria-describedby`는 content 슬롯이 없고 description이 공백이 아닐 때만 p id로 연결. class·구조 변경 0 | `Modal.test.tsx` 6건 추가(`getByRole("dialog"\|"alertdialog", {name})`, `toHaveAccessibleDescription`, content 변형 describedby 없음, 빈·공백 description, 두 인스턴스 id 다름, className 문자열 그대로 + wide). 이전 Modal에서 6건 실패 확인. Modal은 DOM 기준값(결과·마이페이지·CHAT)에 들어 있지 않다 |
| **B-2** 마이페이지 오버레이 불투명화(위 §8.20.5 "오버레이 뒤 목록 비침") | `HistoryDetailPanel` 루트 `bg-glass-fill`(#fbfaf6f5) → `bg-bg-canvas`(#fbfaf6). `ResultPanelShell`은 그대로(design 판정 대기) | `HistoryDetailPanel.test.tsx` 기대 토큰 교체(+`bg-glass-fill` 없음 단언). 기준값 JSON은 덮어쓰지 않고 `apps/web/src/test/historyPanelOpaqueDelta.ts`(대상 노드 정확히 1개가 아니면 throw)를 `myPageDetailDom.baseline.test.tsx`·`MyPage.figures.test.tsx` 비교에 `stage5OneLineDelta` 뒤에 적용. 신규 `historyPanelOpaqueDelta.test.ts`: 4종 모두 루트 1노드·1토큰만 달라짐, 대상 0·2개면 throw, 무관 변이 10종(토큰 되돌림·둘 다·다른 불투명 토큰·보더·모서리·그림자·안쪽 카드 배경·aria-label·속성·텍스트) 모두 비교 실패. 이전 패널 코드로 되돌리면 기준값 비교·패널 테스트 6건 실패. `COMPONENT_MAP.md`에 항목 신설(기존에 HistoryDetailPanel 항목이 없었다) |
| **B-1** CHAT `figureContext.source`(§8.20.5 이월 LOW-8) | `validation` `figureContext.source: z.enum(["solve","resume"]).optional()`, `shared-types` `ChatFigureContextRequest.source?`. `resolveSolutionContext(problemId, userId, preferredSource?)`: `"resume"`이고 이어풀기 결과가 있으면 그 결과·도형, 아니면 기존 순서(solve → resume), 실제 `solutionSource` 반환. `chat.router`: on이고 source가 있을 때만 세 번째 인자를 넘기고, 요청 source ≠ 실제 source면 step을 null로. off·source 없음은 인자 2개 호출 그대로. 웹 `SolveLandscapePage` `chatFigureContextArgs(step, source)` — solve 분기 `"solve"` 2곳, 진단·이어풀기 분기 `"resume"` 2곳, 플래그 off면 `[]`. **계획에 없던 필요 변경 1곳**: `shared/api/chatMessage.ts`가 본문을 `{ step }`으로 다시 만들고 있어 source가 빠졌다 → source가 `"solve"`·`"resume"`일 때만 `{ step, source }`, 그 밖에는 `{ step }`(타입 밖 키 계속 버림) | `chat.router.figures.test.ts` 공존 묶음 10건(resume → resume 맥락, solve → solve, 없음 = solve와 인자 동일, resume 결과 없음 → solve fallback·currentStep null, solve 결과 없음 → resume fallback·null, 잘못된 source `"x"`·`""`·`1`·`null` → 400·어댑터 호출 0, off + source resume = 기존 인자). rate limiter(사용자당 분당 30, 모듈 상태)를 기존 묶음과 나누지 않도록 별도 사용자로 seed. `figuresStage5.integration.test.ts` 2건(solve F01 → resume F09 실제 SSE 왕복 뒤 source별 CHAT 요약, 잘못된 source 400, resume 없음 fallback). 라우터·resolver를 되돌리면 새 테스트 5건 실패. 웹 `figuresChatStep.integration.test.tsx`: 기존 사례 기대값을 `{ step: null, source: "solve" }`·`{ step: 2, source: "solve" }`로 **강화**, 진단 → 이어풀기 분기 사례 추가(실제 `sendChatMessage` + fetch 스텁으로 본문 `{"question":"이어풀기 질문","history":[],"figureContext":{"step":null,"source":"resume"}}` 확인). `chatMessage.test.ts` 1건(source 직렬화·잘못된 source 버림). 기준값 바이트 동일: api `chatOff.baseline`, 웹 `chatRequest.baseline`, `figuresChatStepOff` 수정 없이 통과 |

- **오프 동작 변화 1건(보고)**: `source`가 스키마에 생겨 `figureContext: { step, source: "x" }`는 서버 플래그와 무관하게 400이다(이전에는 모르는 키라 버려지고 200). 웹은 플래그 off면 `figureContext` 자체를 보내지 않으므로 운영 off 경로에는 영향이 없다.
- **범위 밖(기록만)**: `suggestions.router`도 같은 `resolveSolutionContext` 우선순위(solve 우선)를 쓴다 — 공존 시 추천 질문은 solve 결과 기준이다. 이번에 바꾸지 않았다.
- **헤드리스 B-2**(Chromium·WebKit, hasTouch, 1194×834, **물리 iPad 아님**): vite 5199(`VITE_API_BASE_URL=https://localhost:4199`, 가짜 Supabase 54398). 4199·54398은 서버 없이 Playwright route로 응답(목록 14행·상세 1건 고정). 패널 뒤에 목록 행 5개가 겹친 상태에서 패널 영역(테두리 2px 안쪽)을 캡처 → 오버레이 밖 요소를 모두 `visibility:hidden`으로 숨겨 "목록 없음" 상태로 다시 캡처 → 픽셀 비교. 모서리 24×24 사각형 안 차이는 둥근 모서리 밖 배경이라 따로 셌다.

  | | 패널 배경(computed) | 다른 픽셀(전체 / 모서리 밖) | 대조군: 같은 화면에서 `bg-glass-fill`로 되돌림 |
  |---|---|---|---|
  | Chromium | rgb(251, 250, 246) | 92 / **0** (영역 716×500) | rgba(251, 250, 246, 0.96) — 15,988 / **15,837** |
  | WebKit | rgb(251, 250, 246) | 128 / **0** (영역 716×515) | 같은 값 — 17,806 / **17,656** |

  → 현재 토큰에서는 패널 안쪽에 목록 글자가 비치지 않는다. 대조군으로 같은 측정이 비침을 잡아낸다는 것도 확인했다. 콘솔 pageerror 0. 하니스(`run.mjs`)와 스크린샷은 휘발성 scratchpad에만 있고, 끝난 뒤 5199를 종료했다(4199·54398·8123 LISTEN 0).
- **오너 CAS 8000**: `--reload` 없이 떠 있어 A의 새 판정은 **재시작해야** 반영된다(재시작 전까지 좌표 답 이어풀기는 여전히 `verified=false`).

게이트(OneDrive 트리):

| 실행 | 결과 |
|---|---|
| CAS `uv run pytest` / `ruff check .` / `ruff format --check .` | 105 통과(answer_forms 65·equivalence 15·parser 9·routers 16) / 0 / 0(format 설정은 없지만 함께 실행) |
| 루트 1차 | typecheck **2**(내 새 테스트 `resume.router.test.ts`에서 동적 import 값 `FakeLLMAdapter`를 타입으로 씀 → `InstanceType<typeof FakeLLMAdapter>`로 수정), lint 0, test **1**(web `MyPage.figures.test` "solve·resume 그림이 각자 자리에"의 lazy 도형 `waitFor` 1초 안에 섹션 0 — 그 `it` 본문은 수정 0, 이 파일에서 바꾼 것은 다른 `it`의 기준값 비교 한 줄), build 0. api 1,045 통과 |
| 실패 테스트 단독 5회 + 8병렬(load 27) | 13/13 통과 → §7.18.4 ①(단독·재실행 통과)로 전체 재실행 1회 |
| **루트 2차(수정 뒤 처음부터)** | typecheck 0, lint 0, test 0 — api 71 파일/1,045, web 118 파일/1,254, build 0 — 메인 `index-Dxf_ZN1r.js` 977.10kB, precache 8(load 27→49) |

- OneDrive 밖 복사본 비교 실행은 이번에 하지 않았다.

##### 8.16.1 QA 판정 (stage-qa-agent, 2026-10-25) — STAGE CONDITIONAL PASS — FIX REQUIRED (BLOCKER 0 · HIGH 0 · MEDIUM 2 · LOW 6)

제품 코드는 수정하지 않았다(변이·대조는 scratchpad 복사본·HEAD d8e9f3c 추출본). 오너 5173·4000·8000은 건드리지 않았고 QA용 CAS 8123은 확인 뒤 종료했다.

- **게이트(저장소 루트 첫 실행)**: typecheck 0 · lint 0 · test 0(api 71 파일/1,045, web 118 파일/1,254) · build 0. CAS `pytest` 105 통과 · `ruff check` 0.
- **A (CAS)**: 160쌍 적대 묶음을 HEAD CAS와 신규 CAS에 같은 입력으로 돌려 비교. R3 두 쌍 true, `(1,3)`/`(3,1)`·`[1,3]`·`(1,3]`·`1,000`/`1,0`·부분집합·개수 차이·`f(1,2)`·`m(1,3)`·`x=2,y=2` vs `(2,2)`·원소 11개·빈 문자열·중첩/불균형 괄호 모두 false, `1,000`=`1000` true. 쉼표 없는 3,481쌍(59×59, 쉼표 있는 입력은 이 묶음에 없음)은 HEAD와 판정 동일(true 123=123), 달라진 465쌍은 전부 HEAD 500 → 200 false. `step_verify`·`parser`·`equivalence`·`schemas`·`main` diff 0. 예외 주입 5종(분류·비교·scalar·원소·RecursionError) 모두 200 + false. HTTP 8123에서도 동일(422는 스키마 위반만).
  - **MEDIUM-1 (거짓 양성)**: `(x,y)=(1,3)` vs `(y,x)=(1,3)` → true(좌변 제거로 변수 순서가 사라짐, HEAD는 false). `(a,b)=(1,3)` vs `(b,a)=(1,3)`도 true.
  - **MEDIUM-2 (거짓 양성)**: `x=1,x=3` vs `y=1,y=3`·`x=2,x=-2` vs `a=2,a=-2` → true(변수 이름 무시). 단일 해 `x=3` vs `y=3`은 false라 서로 일관되지 않다. 둘 다 "같은 변수일 때만" 비교하도록 좁히면 된다(작은 수정).
  - LOW: `A(1,3)` vs `B(1,3)` true(점 이름 폐기, 설계 문서 그대로) · `0,001`=`1`·`(1,000)`=`(1,0)` 같은 퇴화 천 단위/선행 0 · 쉼표가 있는 자기 자신 비교(`f(1,2)`·`m(1,3)`)가 HEAD true → false(소문자 점 이름 보수 처리) · 원소 파싱 시간 최대 10배/simplify 최대 110회, CAS·casClient 모두 시간 제한 없음(기존 한계).
- **B-1**: 현재 트리 ↔ HEAD 동일 요청 15종 × 문제 3종(solve만·resume만·공존) × 플래그 2 = 90건의 상태·응답·`adapter.chat` 인자·OpenAI 요청 본문을 비교. off는 유효한 source(solve·resume)·없음 모두 HEAD와 바이트 동일, on+공존+`resume`은 이어풀기 발췌·단계 원문·도형 fig-f01만, `solve`/없음은 HEAD와 동일. 요청 결과가 없으면 fallback하고 currentStep·stepText null. 변이 15종(api 9·web 6) 전부 검출. **`source:"x"`(및 `""`·null·1·"SOLVE"·배열)는 플래그와 무관하게 400** — 유일한 송신자인 웹은 off면 figureContext를 안 보내고 on이면 허용값만 보내며, 구/신 웹·API 조합에서도(구 API는 모르는 키를 버림) 깨지지 않아 **수용 가능**.
- **B-2**: 변이 14종(배경 되돌림·둘 다·다른 불투명 토큰·보더·모서리·폭·그림자·헤더 패딩·overflow·max-h·aria-label·속성 추가·p-1) 전부 기준값 비교에서 실패, 무변이 16/16 통과. `bg-bg-canvas`는 빌드 CSS에 `var(--color-bg-canvas)`(#fbfaf6)로 생성됨. 헤드리스 픽셀 측정은 개발자 기록만 확인했다(QA 미실행, 물리 iPad NOT VERIFIED).
- **B-3**: HEAD Modal ↔ 신규 Modal을 12가지 변형(아이콘 3·설명 없음·공백·긴 설명·wide·content·content+description·취소·`content=false`·`content=""`)에서 id/aria 참조 속성만 제거하고 `innerHTML` 비교 → 12/12 동일(시각 변화 0). 접근 가능한 이름 = 제목, 설명 = description, content 슬롯 변형은 describedby 없음, 두 인스턴스 id 서로 다름. LOW: `content={false}`·`content=""`처럼 falsy지만 null이 아닌 값이면 `aria-describedby`가 존재하지 않는 id를 가리킨다(현재 호출부는 항상 JSX 요소라 발생하지 않음).
- **회귀**: 기존 테스트 삭제 0·완화 0(바뀐 단언 5줄은 모두 강화 또는 승인된 B-2 토큰 교체), 새 의존성 0, 제품 코드 `any` 0, `eslint-disable`·`@ts-ignore`·`console.log`·TODO 0(테스트 1곳에 의도된 `as unknown as`).
- **MUST FIX**: MEDIUM-1·2(위). **NOT VERIFIED**: 물리 iPad(B-2 오버레이 비침·B-3 VoiceOver 낭독), 실제 AI 호출, 오너 CAS 8000(재시작 전이라 옛 코드).

##### 8.16.1 재작업 1/3 (development-agent, 2026-10-25) — QA CONDITIONAL PASS(위) + design PASS 대응, 커밋 안 함

자체 검증 결과다(QA 판정 아님). 오너 5173·4000·8000 무변경(4000은 PID 38563 그대로, 이번엔 api 소스 변경 0).

| 항목 | 처리 | 근거·테스트 |
|---|---|---|
| **MEDIUM-1** 좌변 순서 소실 | `AnswerForm.lhs`(좌변 Symbol 튜플)를 기억하고, **양쪽 모두** 좌변이 있으면 튜플이 같아야 참. 한쪽만 있으면 기존대로 값만 비교 | `(x,y)=(1,3)` vs `(y,x)=(1,3)`·`(a,b)` 변형·`(x,y)` vs `(a,b)` → false. `(x,y)=(2,2)` vs `(2,2)`(양방향)·`(x,y)=(1,3)` vs `(1,3)` true 유지 — 유지 근거(원 문제 정답은 보통 값만 있고 반대편에 비교할 변수 정보가 없음)를 `test_one_sided_lhs_keeps_matching` 주석에 기록 |
| **MEDIUM-2** 해 목록 변수 무시 | `AnswerForm.symbol`(`x=값` 목록의 Symbol), **양쪽 모두** 있으면 같아야 함. 순수 값 목록·집합과의 비교는 기존 유지 | `x=1,x=3` vs `y=1,y=3`/`y=3,y=1`·`x=2,x=-2` vs `a=2,a=-2` → false, 단일 해 `x=3` vs `y=3` false(기존 경로)로 일관. `x=1,x=3` vs `1,3`·`\{1,3\}` true 유지 |
| LOW 점 이름 | `AnswerForm.point`, 양쪽 모두 이름이 있으면 같아야 함(`{}`·공백 제거 정규화 `P_{1}`=`P_1`). 한쪽만 있으면 떼고 비교 | `A(1,3)`/`B(1,3)`·`P(0,0)`/`Q(0,0)`·`P_1`/`P_2` false. **1차 테스트의 참 쌍 `P_{1}(2,2)` vs `Q(2,2)`는 이 규칙상 거짓 양성이라 거짓 목록으로 옮기고** 참 목록은 `P_{1}(2,2)` vs `P_1(2,2)`로 바꿨다. `M(1,3)`/`(1,3)`·`(1,3)`/`B(1,3)`·`M(1,3)`/`M(1,3)` true |
| LOW 퇴화 천 단위 | 정규식 `^-?[1-9]\d{0,2}(,\d{3})+$`(괄호 없는 최상위 단일 수에만 적용 — 원래도 전체 문자열에만 적용) | `0,001`/`1`·`000,000`/`0`·`-0,001`/`-1` false. `1,000`=`1000`·`12,345,678`·`-1,000` true 유지 |
| LOW 괄호·집합 안 천 단위 | 괄호·집합 안에서는 합치지 않는다(기존과 같음). **확인 결과**: 선행 0 규칙 전에는 `(1,000)`이 원소 `1`·`000`(=0)인 순서쌍이 되어 `(1,0)`과 원소별 동치 → **true**였다(QA LOW). 보수안 채택: 원소 원문에 선행 0 숫자(`(?<![\d.])0\d`, 예 `000`·`01`)가 있으면 파싱 실패 → invalid → false. `10`·`0.5`·`1.05`·`0`은 해당 없음. 해 목록 항에도 같은 규칙 | `(1,000)`/`(1,0)`·`(1,000)`/`1000`·`\{1,000\}`/`\{1,0\}`·`x=1,x=000`/`x=1,x=0`·`1,0001`/`10001` false. 분류 단위 테스트(`(1,000)`·`0,001` invalid, `(1,0)`·`(0.5,10)`·`(1.05,0)` ordered). 부수 효과: 1차 테스트 `1,00`·`1,0000`·`1000,000`이 `solutions` → `invalid`(둘 다 "천 단위로 합치지 않음"이라 취지 같음, 기대 kind만 갱신 — 판정은 원래도 false) |
| LOW Modal `content={false}`·`""` | describedby 조건을 p 렌더 조건(`content ?? <p>` → content가 null/undefined일 때만)과 같은 `rendersDescription`으로 통일. 렌더링·class 변경 0 | `Modal.test.tsx` 4건 추가(`false`·`""`·`0`에서 p 없음·describedby 없음, 6가지 조합에서 describedby가 있으면 항상 실제 요소를 가리킴). 1차 조건(`!content`)으로 되돌리면 이 4건 실패 확인 |

- **QA 묶음 재실행**(scratchpad `s8161/`): `fp.py` 9쌍 — 거짓 양성이던 7쌍 모두 false, `(x,y)=(1,3)` 자기 자신만 true. `battery.py` 160쌍(같은 입력, `s8161/rework1_{head,new}.json`):

  | | true 수 | 500 | 기대 false인데 true | 기대 true인데 아님 |
  |---|---|---|---|---|
  | HEAD d8e9f3c | 14 | 7 | 2(`f(1,2)`·`m(1,3)` 자기 비교) | 32 |
  | 1차 구현(`new.json`) | 58 | 0 | 3 | 0 |
  | **재작업 1** | **52** | 0 | **1**(`unicode`) | 0 |

  1차 → 재작업 1 변화 6쌍은 모두 true → false: `solutions x vs y`, `(x,y)/(y,x)`, `A(1,3)/B(1,3)`, `(1,000)/(1,0)`, `0,001`, `000,000`. HEAD 대비 true +38(R3 4·천 단위 7·집합·해 목록·점 이름·좌변·감싼 표기 등), HEAD true → false 2(`f(1,2)`·`m(1,3)` 자기 비교, QA 기대와 일치), HEAD 500 → 200 false 7.
- **남은 1건 `unicode`(`(１,３)` vs `(1,3)` true) — 결정 필요, 바꾸지 않음**: SymPy가 전각 숫자를 숫자로 읽어, 이번에 손대지 않은 쉼표 없는 기존 경로에서도 HEAD부터 `３`=`3`·`x=３`/`3`·`１２`=`12`가 true다. 값이 실제로 같고, 쉼표 목록만 false로 막으면 기존 경로와 어긋난다. 보수적으로 막으려면 원소에 ASCII가 아닌 숫자가 있으면 invalid로 하는 한 줄이면 된다(오케스트레이터 판단 요청).
- 재작업 1 변경 파일: `services/cas/app/core/answer_forms.py`, `services/cas/tests/test_answer_forms.py`(회귀 추가 + 위 참 쌍 1건 이동·kind 기대 3줄 갱신), `services/cas/README.md`, `apps/web/src/shared/ui/modal/{Modal.tsx, Modal.test.tsx}`, 이 장부. `parser.py`·`step_verify.py`·`final_check.py` 이번 diff 0.

| 게이트(재작업 1, OneDrive 트리 첫 실행) | 결과 |
|---|---|
| CAS `uv run pytest` / `ruff check .` / `ruff format --check .` | 134 통과 / 0 / 0 |
| 루트 | typecheck 0 · lint 0 · test 0(api 71 파일/1,045, web 118 파일/1,258) · build 0(`index-HByrMPkl.js` 977.10kB, precache 8). §7.18.4 예외 적용 없음 |

- 오너 CAS 8000은 여전히 재시작 전(옛 코드)이다. 재시작해야 A와 재작업 1이 반영된다.

##### 8.16.1 재검증 (stage-qa-agent, 2026-10-25, 재작업 1/3 이후) — STAGE PASS — READY FOR NEXT STAGE (BLOCKER 0 · HIGH 0 · MEDIUM 0 · LOW 3 이월)

제품 코드는 수정하지 않았다. 오너 5173·4000·8000은 건드리지 않았고, 8123은 재검증 중 열지 않았다(TestClient로 검증).

- **게이트(루트 첫 실행)**: typecheck 0 · lint 0 · test 0(api 71/1,045, web 118/1,258) · build 0. CAS `pytest` 134 통과 · `ruff check` 통과.
- **MEDIUM-1·2 해소 확인**: `fp.py` 9쌍 중 거짓 양성이던 7쌍 모두 false(`(x,y)=(1,3)` 자기 자신만 true). `battery.py` 160쌍을 다시 돌려 1차 구현 대비 달라진 쌍이 정확히 6개(전부 true→false: `x`/`y` 해 목록, `(x,y)`/`(y,x)`, `A`/`B` 점, `(1,000)`/`(1,0)`, `0,001`, `000,000`), 500 0건, 52 true. 기대와 다른 1건은 오케스트레이터가 수용한 `unicode`(전각 숫자)뿐이다. 쉼표 없는 3,481쌍은 HEAD와 판정 동일(HEAD 500→200 false 제외 차이 0, 1차 구현 대비도 변화 0, true 123).
- **새 규칙 적대 탐침 126건**(양방향·한쪽만·점 이름 유무·선행 0 vs `0.5`/`0.05`/`10`/`1.05`/`100`/`0.0`·`2^{10}`·음수·공백 변형): 기대와 다른 것 1건(아래 LOW-1). 통과한 것: 좌변 순서 변형(공백, `\left`, 3개, 첨자, 집합 우변), 한쪽만 좌변/점 이름(`(x,y)=(2,2)`↔`(2,2)`↔`M(2,2)` true), `P_{1}`=`P_1`·`P_{12}`≠`P_1`·`P`≠`P_1`·`A(1,3)`≠`A(3,1)`, `0.5`·`0.50`·`0.05`·`1.05`·`10`·`100`·`0,0`·`1,0.0` 정상 통과 / `00.5`·`01`·`000`·`2^{010}`·`x=03`·`1,01`·`\{1,01\}` false, `(-1,3)`≠`(1,3)`≠`(+1,3)`·`(-0,3)`=`(0,3)`·`(-0.5,3)`=`(-\frac12,3)`·`{-1,3}`={3,-1}, 공백·탭·개행·`\ `·`\,`·`\[ \]` 변형 true, 후행 쉼표·`(1 3)`·`(1;3)` false.
- **새 테스트 비공허성**: 변이 15종(좌변·점·해 Symbol 검사 삭제/한쪽만→양쪽, 중괄호 정규화 제거, 천 단위 선행 0 허용, 선행 0 검사 두 곳 삭제, 정규식이 소수를 막도록/`00`을 놓치도록 변경, lhs/point/symbol 미저장) 전부 검출, 무변이 통과.
- **Modal**: HEAD ↔ 신규 12변형 `innerHTML`(id/aria 속성 제거) 12/12 동일 유지, `content={false}`·`""`에서 describedby null(댕글링 해소), 나머지 변형은 기존과 동일. 테스트 삭제·완화 0, 새 의존성 0, 제품 코드 `any`·`eslint-disable`·`console.log`·TODO 0.
- **LOW-1 (새 우회, 이월)**: 괄호 없는 우변이면 solutions 종류가 좌변을 버려 `(x,y)=1,3` vs `(y,x)=1,3`이 true. 표준 표기(`(x,y)=(1,3)`)에서는 막혀 있고 이 표기는 비표준이라 LOW. 수정하려면 solutions 종류에도 `lhs`를 저장해 양쪽에 있을 때 비교.
- **LOW-2**: `(1, 0 0)`·`(1,0\,0)` = `(1,0)` true — 공백으로 떼어 쓴 숫자를 기존 파서가 곱(0·0)으로 읽는다(쉼표 없는 경로와 같은 기존 동작, 선행 0 규칙 밖).
- **LOW-3**: 좌변이 다르고 값 대응이 같은 `(x,y)=(1,3)` vs `(y,x)=(3,1)`은 false(보수적 거짓 음성), 유니코드 마이너스 `−`는 false.
- NOT VERIFIED: 실제 AI, 물리 iPad(B-2 비침·B-3 VoiceOver), 오너 CAS 8000(재시작 전).

### 8.17 WU11 게이트(2차 요청)

| 실행 | typecheck | lint | test | build | 비고 |
|---|---|---|---|---|---|
| OneDrive 3차 | 0 | **1** | 0 | 0 | 새 테스트 `diagnosis.workLines.test.ts`의 불필요한 타입 단언(내 코드) → 고침 |
| OneDrive 4차 | 0 | 0 | **1** | 0 | 새 통합 테스트 F11s 5초 타임아웃(diff 안) → 예외 처리하지 않고 조사 → WU1 원인 확정·하니스 수정(§8.13) |
| OneDrive 5차(수정 뒤 첫 실행) | 0 | 0 | 0 — api 71/1,027, web 115/1,209 | 0 | |
| **OneDrive 6차(최종 변경 뒤 첫 실행)** | 0 | 0 | 0 — api 71 파일/1,027, web 115 파일/1,210 | 0 — 메인 `index-Cor4xjlb.js` 976,028B, precache 8 | §7.18.4 예외 적용 없음 |
| **OneDrive 밖 복사본 첫 실행**(같은 트리, `git ls-files -co` + `pnpm install --offline`) | 0 | 0 | 0 — api 1,027, web 1,210 | 0 — 같은 해시 | load 23~38 |

- 두 환경 결과 동일. 5차·6차는 WU1 수정 뒤라 api supertest 경로의 외부 포트 충돌은 막힌 상태다.


### 8.18 Stage 5 QA 판정 (stage-qa-agent, 2026-10-25, 재작업 0/3)

**판정: STAGE CONDITIONAL PASS — FIX REQUIRED** (BLOCKER 0 · HIGH 0 · MEDIUM 2 · LOW 10). 구현 결함으로 FAIL인 수용 기준은 없다. 조건부인 이유는 ① 실DB 항목(RS7·S5-3 실DB·RLS·SQL 실행)이 마이그레이션 미적용(오너 결정)이라 BLOCKED, ② 실기기(S5-D, RS12·RS13 일부)가 NOT VERIFIED, ③ 아래 MEDIUM 2건과 최종 보고 자료(§9) 누락 때문이다. 제품 코드는 수정하지 않았다(검증은 scratchpad 복사본·`git worktree`·QA 자체 하니스).

범위 분리: **자동**(vitest·가짜 PostgREST HTTP·실제 supabase-js/openai SDK) 통과 / **헤드리스**(Playwright Chromium·WebKit, hasTouch, 1194×834, **물리 iPad 아님**) 통과 / **실기기** NOT VERIFIED / **실DB** BLOCKED / **실제 AI** R3 기록 검토만(새 OpenAI 호출 0, R1·R2 NOT RUN은 오너 결정이라 FAIL 아님).

#### 8.18.1 독립 검증 방법(개발자 fakeSupabase·기준값에 의존하지 않음)

1. **QA 독립 가짜 PostgREST+Auth+OpenAI(HTTP)**: 실제 라우터 + 실제 `problemRepository` + **실제 `@supabase/supabase-js`·`openai` SDK**가 HTTP로 붙는다(스키마 전/후, 42703·PGRST204·PGRST205·42P01, check 위반·FK, merge-duplicates upsert 의미, 결함 주입). 라우터 조립은 운영 `createApp`.
2. **off 동일성**: `git worktree add --detach <경로> 091ae2a` + 현재 트리 복사본(`pnpm install --offline`)에서 **같은 캡처 스크립트**를 돌려 `cmp`. 플래그 3종 off × DB 스키마 2종(마이그레이션 전/후) = 4개 조합 JSON 바이트 동일(solve 4옵션 SSE·저장 요청 본문, resume own/alt × CAS 통과/실패 SSE·저장소 호출 0, 진단 응답, 상세 3종·404·타 사용자, 목록, CHAT history 0/3/30/긴 30 어댑터 인자·OpenAI 요청 본문(SDK→가짜 서버), 어댑터 `diagnose/resume/generateFigures`(priorWork 포함) 인자). 플래그 값 `false/1/TRUE/" true"/""/yes`도 동일, `true`는 달라짐(비공허). `FIGURES_ENABLED=true`(영속 off)에서는 CHAT만 달라지고 나머지 전부 HEAD와 동일. PERSIST on에서도 SSE·응답 본문은 동일(상세에 `resumeSolution` 키만 추가, 목록 동일).
3. **기준값 진본성**: 개발자의 WU0 기준값 파일(api `chatOff`·`persistenceOff`, 웹 `chatRequest`·`myPageDetailDom`)을 **HEAD worktree에 복사해 돌려** 통과(= 기준값이 변경 전 출력). MyPage 기준값은 HEAD에서 delta 적용을 뺀 채 4/4 통과.
4. **`stage5OneLineDelta.ts` 은폐 검사**: (a) 실제 HEAD 기준값 ↔ 현재 렌더 DOM을 노드 단위로 diff → 차이는 `RecognizedProblemBar`의 4노드 class 토큰뿐(카드 `items-center→items-start`, 배지 `+shrink-0 whitespace-nowrap`, 본문 `+min-w-0 pt-0.5 wrap-anywhere`, 버튼 `+focus-visible:ring-brand rounded-[6px] pt-0.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-offset-2`) = S5-V7·V8·V10과 정확히 일치, 태그·속성·텍스트·자식 수 차이 0. (b) 컴포넌트에 무관한 변이 11종(p `font-bold`, `gap-4`, 버튼 `pt-0.5` 제거, `data-qa` 속성, 배지 size, `whitespace-pre-wrap` 제거, 라벨 접미사, `aria-label`, 배지 `mt-1`, `min-w-0` 제거, 카드 `mb-2`) → **11/11 모두 기준값 비교 실패**(헬퍼가 다른 차이를 숨기지 않음). `elevatedCardUsage`의 기대 토큰 변경은 `items-center→items-start` 한 토큰이며 승인된 S5-V8이다.
5. **개발자 테스트의 비공허성**: 제품 코드 변이 api 17종·web 12종을 복사본에서 주입 → 28/29 검출. 생존 1건(M03: resume 라우터의 `verified !== true` 조기 반환 제거)은 저장소의 같은 가드(M02는 검출)가 받쳐 관측 가능한 쓰기는 0 — 중복 방어층 미검증(LOW). 모든 변이는 원복 후 `cmp` 확인.

#### 8.18.2 게이트

| 실행 | typecheck | lint | test | build |
|---|---|---|---|---|
| 저장소 루트(OneDrive) **첫 실행** | 0 | 0 | 0 — api 71 파일/1,027, web 115/1,210 | 0 — 메인 `index-Cor4xjlb.js` 976,028B |
| OneDrive 밖 복사본(`git ls-files -co` − ProblemDB) **첫 실행** | 0 | 0 | **1** — web `src/app/devFiguresRoute.test.tsx` 스위트 로드 실패(`supabaseUrl is required`), 나머지 api 1,027·web 1,208 통과 | 0 |
| 같은 복사본, `apps/web/.env`(gitignored, VITE_* 4줄) 제공 후 `pnpm test` | — | — | 0 — api 1,027, web 1,210 | — |

- 밖 복사본의 실패는 **단언 실패가 아니라 환경 로드 실패**이고 diff 밖 파일이다. HEAD worktree에서 `.env`를 빼고 같은 파일을 돌려 **그대로 재현**(Stage 2 도입 테스트가 gitignored `.env`에 암묵 의존, LOW-6). §7.18.4의 단언 실패(chat 404 등)는 어느 실행에서도 0이었다 — 예외로 넘긴 것이 없다.
- 새 의존성 0(`package.json`·락 diff 0, supertest 7.2.2 고정), 기존 테스트 삭제 0·단언 약화 0(기존 파일 수정은 위 §8.18.1-4의 기준값 비교 3곳뿐), 변경 금지 파일 diff 0(허용 예외 `WorkLineList` 클래스 2개·`diagnosis.router` 1줄만).

#### 8.18.3 수용 기준별 결과

| AC | 판정 | 근거(자동 / 헤드리스) |
|---|---|---|
| S5-1 | PASS(자동) | §8.18.1-2·3·4. 웹 chat 본문: HEAD에서 기준값 통과 + 변이(off에서도 figureContext 직렬화) 2종 검출 |
| S5-2 | PASS(자동) | 마이그레이션 전+on: 탐지 1회(42703), upsert 키 = 텍스트 7개(HEAD 키 집합과 동일), PATCH 0, 상세 200·도형·resume 키 0, +4분 재탐지 0 |
| S5-3 | PASS(자동) / **실DB BLOCKED** | 행 도형 = SSE deep-equal, 상세 = SSE, 어댑터 호출 0, +5분1초에 재탐지로 마이그레이션 적용 감지(서버 재시작 없이). 사례 9종 × 컬럼 있음/없음 |
| S5-4 | PASS(자동) | 재풀이 중 이전 run 도형이 늦게 도착(동시 요청): 행·메모리 모두 run2, PATCH 2회 중 run1은 0행. 도형 update 필터 `problem_id`+`figures_run_id` |
| S5-5 | PASS(자동·헤드리스) | solutions 변조 11종(객체·문자열·숫자·null 원소·버전 컬럼 2·"1"·내부 버전 2·script 라벨·요소 10,000·순환 midpoint·expr 문자열)+혼합(정상만 남음), resume 변조 9종, 모두 200·텍스트 유지. 웹: 변조 행 열기 → 보드 0·콘솔 오류 0(Chromium·WebKit) |
| S5-6 | PASS(자동) | **실제 OpenAIAdapter→SDK 요청 본문** 직접 검사: 섹션 순서, JSON 한 줄 파싱, 상한(도형 1개 ≤3,000자·3개 합계 ≤6,000·발췌 ≤4,000·history 12개/8,000자/단일 거대 메시지 8,000자 절단), 서버 `figureContext.step` 1~99 정수/null만(0·100·-1·1.5·"2"·true·[]·{} → 400), 클라이언트 도형·탐색 필드 문자열은 요청 본문에 0, 시스템 지시(`instructions`) 도형 유무·단계와 무관하게 불변 |
| S5-7 | PASS(자동) | resume만 있는 문제: 그림 섹션·이어풀기 발췌. 단 solve와 resume가 함께 있으면 solve 맥락 우선(문서화된 동작, LOW-8) |
| S5-8 | PASS(자동) | CHAT 4회 뒤 메모리·DB 행(run id 포함) 불변, CHAT wire는 `chat_messages` POST뿐, 응답 키 `answerMd`. "CHAT은 도형을 생성하지 않는다"는 FIGURE_SPEC §8·§17에 명시 |
| S5-9 | PASS(자동·헤드리스) / **실기기 NOT VERIFIED** | 같은 단계=같은 그림, 기본 최종, 10회 열고 닫기(3경로 섞음) 후 보드 0, 콘솔 오류 0 |
| S5-10 | PASS(자동·헤드리스) | solve 그림 3 + resume 그림 1 = JXG 보드 4 = 보이는 그림 4, 닫으면 0 |
| S5-11 | PASS | 아래 §8.18.4 |
| S5-12 | PASS(자동) | 악성 라벨·수식·요소 과다·순환·`\href`/`\htmlId`가 저장·재조회·웹 경로 모두에서 거부/무해화 |
| S5-13 | PASS(자동·헤드리스) | 전체 스위트 통과, 필기(drawing-canvas·canvas·styles) diff 0, 인식 칩 배지 1줄 |
| S5-14 | PASS(자동·헤드리스) | 웹 `VITE_FIGURES_ENABLED=false` + 서버 저장 도형 있는 행: 도형 슬롯·보드·`window.JXG` 0, 지연 청크 요청 0(이어풀기 텍스트 섹션은 서버 `RESUME_PERSIST` 독립 기능이라 보임 — 설계대로) |
| S5-15 | PASS | 직접 만든 off·on 빌드의 dist grep(§8.18.5) |
| RS1~RS6, RS9, RS10 | PASS(자동) | RS2: PGRST205·42P01 둘 다 탐지 1회·쓰기 0·상세 200·키 없음·+5분 재탐지·저장, RS3: done 전 upsert 1회, RS4: 모드 변경 시 1행 교체·늦은 도형 쓰기 무시, RS9: 저장 400·PATCH 500에도 done·error 0, RS10: 목록 응답·wire 동일 |
| RS7 | **BLOCKED**(실DB, 오너) | 가짜 DB의 cascade는 모사일 뿐 |
| RS8 | PASS(자동·헤드리스) | resume만: "저장된 풀이가 없는 문제예요" 0, h3 sr-only, 학생 줄·배지, solve+resume: h3 눈에 보임·순서 결과→그림→답→이어풀기 |
| RS11 | PASS(자동·헤드리스) + LOW-1 | 저장 줄 = **진단에 쓴(수정된) 줄**(인식 원본 아님)·진단 근거 2값 = 진단 응답, 부가 필드 미저장, 한도 경계 50줄·500자 저장 / 51줄·501자·32KB 초과·중복·소수·0·1000·빈 배열 → 세 값 null + resume 저장·SSE 정상 + 로그 줄 내용 0 + 상세 키 없음. KaTeX 경로 직접 확인: 줄·풀이·답·방법명·개념에 `$\href{javascript:…}$`·`\htmlId`·`\htmlClass`·`\htmlStyle`·`\includegraphics`·`\url`·`<script>`·`<img onerror>`를 `$…$`로 감싸 넣은 행을 마이페이지에서 열어 링크·id·class·style·img·script·onerror 0, `alert` 대화상자 0, `<script>`는 글자로만 표시(Chromium·WebKit). 구분자 없는 줄은 KaTeX를 거치지 않아 이 검사에 쓰지 않았다 |
| RS11b/c | PASS | 판정 배지 확인 2 + 막힌 지점 1이 실시간과 같은 함수·같은 입력, 재조회 "수정" 링크 0 |
| RS12 | PASS(자동·헤드리스) / **실기기·VoiceOver NOT VERIFIED** | 열면 "목록으로" focus, 3경로 닫기 복귀, header·main inert, Chromium Tab 20회 중 밖 0. WebKit 헤드리스는 기본 설정상 Tab이 버튼에 가지 않아 이 항목은 확인 불가 |
| RS13 | PASS(자동·헤드리스) / 실기기 NOT VERIFIED | 루트 `fixed inset-x-0 top-0 h-dvh`, 높이 834→500→834 추종, 대화상자 하단 ≤ 500 |
| S5-R | PASS(기록 검토) | §8.18.6. R1·R2 NOT RUN(오너 미승인) |
| S5-D | **NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED** | 그림 위 터치 스크롤, VoiceOver 순서, Split View, iOS 하단 막대 |
| G | PASS | §8.18.2 |

#### 8.18.4 10개 사례(자동 + 헤드리스, 고정 fixture — 실제 AI 결과 아님)

기대값은 fixture의 `expected`가 아니라 **별도 수치 코드**로 다시 계산했다(자유점 좌표에서 수선의 발=사영, 중점, 접점 `a=r²/d, h=r√(d²−r²)/d`와 외적 부호, Cramer 교점, 자체 수식 평가기+구간 스캔, 단계 가시성·강조 규칙 독자 구현). 왕복 = SSE → 메모리 → DB 행 → `GET` 상세 → CHAT 요약(k=최종·1·2·3) 전부 deep-equal, 웹은 **실제 JSXGraph 보드의 점 좌표**(`board.objectsList` X()/Y())와 대조.

| 사례 | 독립 기대값 | 결과 |
|---|---|---|
| 1 F01 | ∠BAC = acos(AB·AC/(\|AB\|\|AC\|)) = 45° | 렌더 좌표에서도 45°(오차 1e-6) |
| 2 F02 | H = (2,0), ∠CHB = 90°, CH⊥AB | 일치(서버 CHAT 요약·렌더) |
| 3 F03 | M = (1,0), BM = MC | 일치 |
| 4 F04 | M = (1.5,1.5), OM·AB = 0, \|OA\|=\|OB\|=3 | 일치 |
| 5 F05 | T=(1,±√3), \|OT\|=2, OT⊥TP, ccw 외적 > 0·cw < 0 | 일치(오차 1e-9) |
| 6 F06 | P = (2,2) (x+y=4, x−y=0 모두 만족) | 일치 |
| 7 F07 | V=(2,−1)=정의역 최솟점, R1=(1,0), R2=(3,0) | 일치 |
| 8 F08 | x=1 불연속, 곡선 조각 ≥2·어느 조각도 x=1을 가로지르지 않음, x<1 조각 y<2 · x>1 조각 y>2, 점근선 x=1·y=2 | 일치(Chromium·WebKit) |
| 9 F09 | k=최종·1·2·3의 보이는/숨김/강조 집합 + H=(0,0), M=(1,0), ∠AHC=90° | 서버 CHAT 요약·웹 보드 가시성 모두 독립 규칙과 일치 |
| 10 안전한 실패 | 거부 fixture **53건**(F10a~j, F11a~ad, Stage 1 reject 포함) | 53/53: done·텍스트 저장, figures 이벤트 0, 도형 컬럼 null·PATCH 0, 상세 도형 키 0, CHAT 그림 섹션 0. 거부 사유 code·path 목록으로 눈 확인(예: F10a `unknown_reference`, F10b `forward_reference`, F10c `constraint_violation`, F11a `no_tangent`, F11e `degenerate`) |

기하 도형 보드 축 단위 비율 1:1(F01~F06·F09) 확인.

#### 8.18.5 번들(S5-15, 직접 빌드)

- off 빌드: JS 1개 `index-Cor4xjlb.js` 976,028B, `sw.js` 포함 **커널 문자열(`dependency_not_visible`·`forward_reference`·`no_tangent`)·JXG·jsxgraph·SolutionFigures·lazyEntry·stepStateAt·buildFigureChatSummary 전부 0**, precache 8.
- on 빌드(`VITE_FIGURES_ENABLED=true`): 메인 886,293B(커널·JXG·jsxgraph 0, `lazyEntry` 지연 import 참조만), 정적 공통 청크 `FigureErrorBoundary-*` 90,131B(커널 0), 커널은 `lazyEntry-*` 51,895B에만, JSXGraph는 `jsxgraph-*` 1,040,973B에만, precache 12. MyPage는 별도 청크 없이 메인에 있고 커널을 포함하지 않는다. `validation`의 `chatSummary`는 웹 번들에 0(트리 셰이킹).
- 개발자 기록(§8.12.6)의 바이트 수와 전부 일치.

#### 8.18.6 R3 기록 검토(새 OpenAI 호출 0)

- `.omc/research/figures-stage5-textcheck.json`: `dryRun:false`, 어댑터 호출 30/30(하드 카운터), 도형 호출 0, 실패 0, off 대조군 없음 명시. **지표를 `results[]` 원문에서 독립 재계산**: 개념 JSON 위치 맨 끝 20/20, conceptTags 20/20(Wilson 0.839~1.0), 답 빈 값·혼입 0, 단계 분할 19/20(0.764~0.991, 실패 1 = X4 `no_markers`), resume 최종 답 순수 LaTeX 10/10(0.722~1.0), 단계 분할 10/10, CAS 8/10(0.49~0.943), 토큰 합 입력 18,282·출력 13,096, 지연 최대 5,997ms — 모두 기록과 일치(p50/p95는 분위수 정의 차이로 3,836→3,933ms, 5,742→5,711ms 수준). `apps/api/.env`의 키 값을 고정 문자열로 결과 JSON 2개·스크립트·장부에서 검색 → 0건, `sk-` 패턴은 스크립트의 제거 코드와 장부 설명 문구뿐.
- **CAS 순서쌍 미통과의 판정 반영**: 미통과 2건(`(2,2)`·`(1,3)`)은 답이 수학적으로 기대값과 같고 CAS가 비교하지 못한 것이라 **AI 텍스트 품질 지표에서 분리**해 "CAS 한계"로 읽는다(범위 밖이므로 FAIL 사유 아님). 다만 제품 영향은 있다 — `verified=false`는 웹이 카드로 보이지 않고 저장도 하지 않으므로, **좌표 답(교점·중점·접점 — 그림이 가장 필요한 유형)의 이어풀기는 실시간에서도 마이페이지에서도 결과가 없다.** 후속 CAS 과제로 이월(MEDIUM-2).
- 이 표본은 도형 호출 0이므로 "도형 생성 성공률"이 아니라 텍스트 경로(단계 표지·개념 JSON 위치·답 오염)만 말한다. 고정 fixture 통과(자동)와 실제 AI 결과는 분리해 보고한다.

#### 8.18.7 WU1(chat 404 / 타임아웃) 원인 판정

- **원인 타당**: 직접 재현 — (E1) 외부 프로세스가 `127.0.0.1:P`만 잡은 상태에서 `listen(P)`(`::`)는 성공하고 `127.0.0.1:P` 접속은 외부 서버가 받음, (E2) `listen(P,"127.0.0.1")`은 EADDRINUSE, (E3) 임시 포트 배정은 순차적이라 외부 리스너 5개를 둔 40,000회 `listen(0)` 중 10회 그 포트를 배정받고 `listen(0,"127.0.0.1")`은 0회. (E4) **제품 테스트 스위트로 재현**: 외부 `127.0.0.1` 리스너 400개를 배정 경로에 두고 api 전체를 돌리면 수정 전(setup 제거 설정) 새 통합 테스트 F02가 실패, 수정 후 1,027/1,027 통과(수정 없이는 우연히 안 걸리는 실행도 있음 — 배정 위치 의존).
- **테스트 완화 아님**: `loopbackListen.ts`는 supertest가 서버를 직접 띄울 때 `listen(0,"127.0.0.1")`만 바꾸고 단언·fixture·타임아웃은 건드리지 않는다. 결합도: supertest 내부(`serverAddress`·`end`·`_server`)에 의존 — 7.2.2 고정이라 지금은 안전, 업그레이드 시 재확인 필요(LOW-5).
- **남은 4곳**(`resume.router.figures.test`·`solutions.router.figures.test`·`figuresDeadline.router.test` ×2: `app.listen(0)` + `http.request({port})`, 호스트 기본 `localhost`): Node 24는 `::1`을 먼저 시도하고 우리 서버(`::` 듀얼스택)가 받으므로 외부 `127.0.0.1` 리스너가 가로챌 수 없다. 외부 `::1` 전용 리스너가 같은 포트에 있을 때만 가능 — 낮은 위험(LOW).

#### 8.18.8 발견 사항

- **BLOCKER 0 · HIGH 0**
- **MEDIUM-1** `WorkLineList`(기존 컴포넌트, 변경 금지 목록)의 줄 본문 `<p class="flex-1 …">`에 `min-w-0`·줄바꿈 규칙이 없어 **공백 없는 긴 토큰**(300자 재현, 대략 80~90자 이상 무공백 수식)이 한 줄을 1,841px로 넓힌다. 마이페이지 오버레이에서는 **대화상자 본문 전체가 가로로 스크롤**되고(scrollWidth 1,948 vs 718, Chromium·WebKit, 1194/507/375px) 줄 오른쪽의 "확인"/"막힌 지점" 배지가 화면 밖(x=2,186)으로 밀린다. 실시간 진단 화면도 같은 컴포넌트·같은 클래스라 같은 한계(패널 폭 346px이라 더 일찍 발생, 개발자 하니스의 긴 줄은 공백이 있어 이 경우를 건드리지 않았다). Stage 5가 만든 결함은 아니지만 재조회 화면이 노출을 늘린다. 수정은 `WorkLineList`(Q-F로 클래스 2개만 허용) 변경 또는 MyPage 래퍼 → **오너 결정 필요**. 재현: QA 하니스 `overflow2.mjs`(긴 줄 행 열기).
- **MEDIUM-2** (이월·범위 밖) CAS 순서쌍 미통과 → 좌표 답 이어풀기는 저장·표시 모두 안 됨(§8.18.6).
- LOW-1 `updateFigures`(resume 도형 PATCH)가 PostgREST 오류 객체 전체(message·details·hint)를 로그 — 오류에 "Failing row contains (…)"가 실리면 학생 풀이 줄이 로그에 남는다(upsert 경로는 코드만 남기도록 가렸는데 이 경로만 빠짐). 주입한 오류로 재현, 실제 트리거(check 위반)는 희박. `logResumeWriteError`를 같이 쓰면 해소.
- LOW-2 resume 라우터의 `verified !== true` 조기 반환은 변이 생존(저장소 가드가 받쳐 쓰기 0은 유지) — 중복 방어층 미검증.
- LOW-3 `measure.json`(p50 0.361/p95 0.445, 상세 0.356/0.413)과 장부 §8.12.6(0.388/0.467, 0.406/0.499) 수치가 다르다(저장 파일과 장부의 측정 시점 불일치).
- LOW-4 `apps/api/api-none.out`(Stage 4 하니스 로그)이 추적되지 않은 채 제품 폴더에 남음.
- LOW-5 `loopbackListen`은 supertest 내부에 결합(7.2.2 고정).
- LOW-6 `devFiguresRoute.test.tsx`가 gitignored `apps/web/.env`에 의존(HEAD에서도 재현, Stage 5 이전 결함) — 깨끗한 체크아웃·CI에서 첫 test가 실패.
- LOW-7 DB 제약 `pg_column_size(work_lines) <= 32768`(jsonb 이진 크기)과 서버 상한(UTF-8 JSON 텍스트 32,768B)의 기준이 달라 약 1KB 구간에서 서버는 통과·DB는 거부할 수 있다. 거부되면 resume 행 전체가 저장 안 됨(로그 1줄, done 정상). 실DB 미실행이라 NOT VERIFIED.
- LOW-8 solve와 resume가 같은 문제에 모두 있으면 CHAT 맥락은 solve 우선(FIGURE_SPEC §17에 명시)이라, 웹이 이어풀기 화면에서 보낸 `step`이 solve의 단계로 해석될 수 있다. UI가 같은 `problemId`에 둘 다 만들 수 있는지는 확인하지 못함.
- LOW-9 `ResolvedSolutionContext.solutionSource`는 운영 코드에서 쓰이지 않는다(테스트만).
- LOW-10 마이그레이션: `create table if not exists`라 이전 버전 파일을 이미 적용한 DB에 다시 실행해도 `work_lines` 등 컬럼이 추가되지 않는다(현재는 미적용이라 해당 없음). SQL은 비파괴(DROP은 새 테이블의 자기 정책 `drop policy if exists`뿐), 괄호·`$$` 균형 확인, `notify pgrst`·RLS select-own·FK `on delete cascade`·재실행 안전 구조는 정적으로 확인. **SQL 구문 자체는 Postgres가 없어 실행하지 못함(NOT VERIFIED).**

#### 8.18.9 NOT VERIFIED / BLOCKED

- BLOCKED(오너 결정): 마이그레이션 적용 후 실DB 왕복(S5-3 실DB), RS7(cascade 삭제), RLS select-own 교차 사용자, `pg_column_size` 경계(LOW-7), SQL 실행.
- NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED: S5-D(그림 위 터치 스크롤, VoiceOver 순서·대화상자 밖 이동 차단, Split View), iOS Safari 하단 막대(RS13), Safari 키보드 Tab 순환(WebKit 헤드리스는 확인 불가), Stage 4 실기기 체크리스트(`.omc/plans/figures-stage4.md` §7.5)와 Stage 5 3항목.
- NOT RUN(오너): R1(CHAT 도형 맥락 실평가)·R2(22건 재평가) — CHAT 도형 맥락이 실제 모델 답변 품질을 올리는지는 자동(stub/실제 SDK 요청 본문) 검사로만 확인했고 **효과는 미평가**.

#### 8.18.10 최종 보고 자료(§9) 점검 — `.omc/research/figures-stage5-report/`

채워짐: 4 최종 JSON 예시(`f09-examples.json` — SSE·DB 행·상세·CHAT 섹션 4종, SSE=DB=상세 `checks`), 9 중 측정 일부(`measure.json`). 장부로 채울 수 있음: 1·2·6·7·10.
**누락/보강 필요**: ③ **데이터 흐름도**(인식 → solve·resume SSE → done 저장 → 도형 단계 → 검증 → SSE·메모리·DB → 재조회 파싱 → 렌더 / CHAT 맥락)가 어디에도 없음, ⑤ **지원·미지원 도형과 검증 범위** 한 장 요약(FIGURE_SPEC §3.3·§6·§13에 흩어져 있고 미지원 목록은 PRD 범위 제외 문장뿐), ⑧ **iPad 체크리스트 통합본**(Stage 4 12항목은 계획 문서에, Stage 5 3항목은 FIGURE_DESIGN §18에 각각), ⑨ 수치 출처 불일치(LOW-3)와 "금액 미산정 사유" 한 줄 통합, 수정 후 QA 결과·재작업 횟수 갱신. 보고 문서 본체(`report.md` 같은 단일 문서)가 아직 없다.

#### 8.18.11 다음 단계 전 필수

1. 오너: MEDIUM-1 처리 방식 결정(WorkLineList 클래스 허용 또는 MyPage 래퍼). 처리 후 긴 무공백 줄 헤드리스 재확인.
2. 최종 보고 자료 누락 보강(§8.18.10), LOW-3 정정, LOW-1 로그 가리기(권장).
3. 오너: 마이그레이션 적용(2종, 적용 후 서버 재시작) → RS7·S5-3 실DB·RLS·SQL 실행 확인 → 실기기 체크리스트 수행 후 플래그 켜기(순서: 장부 §8·DEPLOYMENT).

#### 8.18.12 QA 재현 방법(scratchpad는 휘발성 — 방법만 기록)

- off 동일성: `git worktree add --detach <dir> 091ae2a` + 현재 트리 `git ls-files -co`(ProblemDB 제외) 복사, 각각 `pnpm install --offline --frozen-lockfile`, **같은 `offcapture.mts`**(실제 `createApp` + QA 가짜 PostgREST/OpenAI HTTP 서버)를 `cd apps/api && QA_SCHEMA=pre|post [플래그 env] npx tsx …`로 돌려 `cmp`.
- 영속·CHAT·사례: 같은 가짜 서버에 시계(`Date.now`) 주입으로 5분 재탐지, 게이트 어댑터로 늦은 쓰기 경쟁, 응답 결함 주입.
- 헤드리스: 개발자 하니스(§8.12.4) 그대로 + QA 자체 API 서버(HTTPS 4199, 사례를 문제 텍스트 `case:F05`로 선택)·vite 5199. 오너 서버(5173·4000·8000)는 건드리지 않음, 종료 후 5199·4199·54398 해제 확인.
- WU1: 외부 `127.0.0.1` 리스너 N개 보유 프로세스 + `listen(0)` 순차 배정 위치 맞추기(`position.mjs`) 후 api 전체 실행.

### 8.19 재작업 1/3 (development-agent, 2026-10-25) — stage-qa CONDITIONAL PASS(§8.18) + design 사후 검수(PASS, P2 1·P3) 대응

#### 8.19.1 항목별 처리

| 항목 | 처리 | 근거·테스트 |
|---|---|---|
| **[QA MEDIUM-1]** 긴 무공백 학생 줄이 대화상자·진단 패널을 가로로 넓힘 | 오너 승인 S5-V7 규칙 적용: `WorkLineList` 줄 본문 `<p>`에 `min-w-0 wrap-anywhere` 추가(이 파일의 허용 변경 = 배지 2곳 + 본문 1곳, diff 3줄) | `features/ai-solution/oneLineLayout.test.tsx`(클래스 규칙). 헤드리스 §8.19.2: 300자 무공백 줄에서 스크롤 컨테이너 scrollWidth = clientWidth(오버레이 718=718, 진단 패널 418=418), 줄 폭 = 카드 안(614/314px, 4~7줄로 꺾임), 배지 3개 모두 카드·화면 안 — Chromium·WebKit |
| **[QA LOW-1]** 도형 PATCH(`updateFigures`) 오류 로그에 PostgREST 오류 전체 | `logResumeWriteError`로 코드만 남김(solutions·resume 공통), throw는 이름만. 탐지 "사용 불가" 전환 로그도 코드만(쓰기 오류로도 불리므로) | `resumeSolutions.persist.test.ts` 신규 3: "Failing row contains (SECRET…)" 오류·throw 주입 → 로그에 `23514`·`PGRST205`만, `SECRET`·`Failing row` 0(solutions·resume 둘 다) |
| **[QA §9]** 최종 보고 자료 누락 | **`docs/FIGURES_FINAL_REPORT.md`** 신설(수풀잉, §4 10개 항목 구조, mermaid 흐름도, 통합 체크리스트 17항목 모두 미실행, 수치 원본 표, 금액 미산정 사유) | — |
| **[QA LOW-3]** `measure.json`과 장부 수치 불일치 | 원본 = `measure.json`으로 정함, §8.12.6을 0.361/0.445·0.356/0.413으로 정정(처음 값은 스크립트 정리 전 첫 실행 값이었고 파일이 재실행 값으로 덮였음). 최종 보고서도 같은 값 | — |
| **[QA LOW-2]** 라우터 `verified !== true` 조기 반환 미검증 | 저장소 가드 없이 무조건 쓰는 대체 구현으로 `saveResumeSolution`을 바꾼 테스트: verified=false면 라우터가 부르지 않음·행 0, verified=true 대조에서는 1회·행 1 | `resume.router.persist.test.ts` 신규 1. 변이(라우터 가드 제거) → 실패 확인 후 원복 |
| **[QA LOW-4]** `apps/api/api-none.out` | 삭제 | — |
| **[QA LOW-6]** `devFiguresRoute.test.tsx`가 gitignored `.env`에 의존 | 다른 라우트 테스트와 같은 관례로 `shared/lib/supabase/client`를 mock | 밖 복사본에서 `.env` 없이 게이트 통과(§8.19.4) |
| **[QA LOW-7]** DB `pg_column_size ≤ 32768`과 서버 32KB(UTF-8 텍스트) 기준 불일치 | DB 제약을 65,536으로 느슨하게 — 서버 상한이 항상 먼저 걸림(마이그레이션 주석에 근거). 가짜 DB도 같게 | `resumeSolutions.persist.test.ts` 신규 1: 서버 상한 바로 아래(50줄·UTF-8 약 31KB) 저장 성공 |
| **[QA LOW-10]** 이전 버전 적용 DB 재실행 시 새 컬럼 없음 | 마이그레이션 머리말에 "이전 버전 적용 DB면 별도 alter 필요, 현재 미적용이라 해당 없음" 명시 | — |
| [QA LOW-5] `loopbackListen`이 supertest 내부 결합 | 기록만: supertest 7.2.2 고정(락), 업그레이드 시 `serverAddress`·`end`·`_server` 재확인 필요 | — |
| [QA LOW-8] solve·resume 공존 시 CHAT step 해석 | **코드 확인: 웹에서 실제로 공존 가능.** `ProblemInputProvider.returnToWorkFromResult`(결과 화면 "수정")는 solve·진단·이어풀기 화면 상태만 초기화하고 `problemId`를 유지한다 → 같은 문제로 "아직 못 풀겠어요"(solve) 뒤 "수정" → "봐 주세요" → 진단 → 이어풀기 가능. 서버 메모리에는 solve 풀이가 남아 CHAT 맥락은 solve 우선 → 이어풀기 화면에서 보낸 `resumeStep`이 solve 단계로 해석된다(도형도 solve 그림). 채팅 이력(`resetChat`)도 이 경로에서 초기화되지 않는다(기존 성질). 기록만(결정 필요: 요청에 `source` 키를 더하거나 이어풀기 시작 시 solve 맥락을 비우는 안) | — |
| [QA LOW-9] `solutionSource` 운영 미사용 | 기록만(LOW-8 해결안에서 쓸 수 있어 유지) | — |
| **[design P2]** 오버레이 보드 648 | `FIGURE_DESIGN.md` §18.4·§18.7·§18.9·§18.11·§18.12를 "액자 646(테두리 포함) / 그리기 644"로 정정, 분해 근거(720 − 대화상자 테두리 2 − `px-5` 40 − `p-4` 32 = 646, 액자 `border` 2 제외 = 644). **§7.4도 같은 누락** — Default 348 → 액자 346 / 그리기 344, Extend 676 → 674 / 672로 정정(`ResultPanelShell` 테두리 2). 헤드리스 실측과 일치(§8.19.2). 코드의 측정 전 자리 상수 `PLACEHOLDER_BOARD_WIDTH = 348`은 바꾸지 않음(측정 뒤 실제 폭으로 다시 맞춤) | — |
| **[design P3]** 포커스 링 조합 3회 반복 | `shared/ui/text-link/textLinkStyle.ts`에 `TEXT_LINK_FOCUS_RING`(`rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`) — `TEXT_LINK_STYLE`과 `RecognizedProblemBar`가 함께 씀(밑줄 링크도 모서리 6px로 통일). `Button`은 그대로. `RecognizedProblemBar` 버튼의 `pt-0.5` → **`mt-0.5`**(링 바깥 여백, 새 래퍼 노드 없이 DOM 구조 유지) | `oneLineLayout.test.tsx`. 기준값 비교의 승인 토큰 증감(`stage5OneLineDelta.ts`)도 `pt-0.5` → `mt-0.5`로 갱신(같은 S5-V8 정렬, 위치만 링 밖). 헤드리스: 글자 위 − 버튼 위 = 1 / 버튼 아래 − 글자 아래 = 1(Chromium, WebKit 1.3/1.3) → 링 안 글자 치우침 없음, 글자 위 − 배지 위 = 3(이전 `pt-0.5` 때도 2 + 1 = 3 → 글자 위치 동일), 버튼 상자 높이 20 → 18 |
| [design P3, 기존] MyPage `min-h-screen` | `min-h-dvh` | `MyPage.stage5.test.tsx` 신규 1 |
| 오버레이 뒤 목록 비침(유리 패널·tint) | **결정 필요**(기록만, 기존 `HistoryDetailPanel` 표면 — design/오너) | — |

#### 8.19.2 헤드리스(Chromium·WebKit, hasTouch, 1194×834, **물리 iPad 아님**) — `.omc/research/figures-stage5-headless/out/stage5.json`

하니스 서버에 300자 무공백 학생 줄(4번째 줄)을 추가해 다시 실행했다.

| 항목 | Chromium | WebKit |
|---|---|---|
| 진단 화면: 스크롤 컨테이너 scrollWidth/clientWidth | 418 / 418 | 418 / 418 |
| 진단 화면: 긴 줄 폭(카드 378) · 줄 수 · 배지 3개 카드·화면 안 | 314 · 6줄 · 예 | 314 · 7줄 · 예 |
| 마이페이지 오버레이: scrollWidth/clientWidth | 718 / 718 | 718 / 718 |
| 오버레이: 긴 줄 폭(카드 678) · 줄 수 · 배지 3개 카드·화면 안 | 614 · 4줄 · 예 | 614 · 4줄 · 예 |
| 인식 바 버튼 정렬(글자 위−버튼 위 / 버튼 아래−글자 아래 / 글자 위−배지 위) | 1 / 1 / 3 | 1.3 / 1.3 / 3.3 |
| "다시 풀기" 키보드 포커스(Tab 1회) | 링 표시(box-shadow brand), 모서리 6px | WebKit 기본 설정은 Tab이 버튼으로 가지 않음 — 확인 불가 |
| 보드 실측(결과 패널 / 오버레이) | 액자 346 · 그리기 344 / 646 · 644 | 같음 |
| 기존 항목 재확인: 한 줄 배지·버튼, 닫기 3경로 복귀·inert, Tab 밖 0, `h-dvh` 834→500→834, 같은 단계 같은 그림, 10회 열고 닫기 후 보드 0 | 모두 같음 | 모두 같음 |
| 콘솔 오류 | 기존 suggestions 400만 | 같음 |

하니스 서버는 끝난 뒤 종료(4199·5199·54398), 오너 dev 서버(5173·4000·8000)는 건드리지 않음.

#### 8.19.3 변경 파일(재작업 1)

- api: `infrastructure/persistence/problemRepository.ts`(PATCH·탐지 로그 코드만), `test-support/fakeSupabase.ts`(65,536), 테스트 추가 `infrastructure/persistence/resumeSolutions.persist.test.ts`(4), `modules/resume/resume.router.persist.test.ts`(1), 삭제 `apps/api/api-none.out`(추적 안 됨)
- DB: `supabase/migrations/20261025000100_resume_solutions.sql`(65,536·머리말 주의, 미적용)
- web: `features/ai-solution/{WorkLineList.tsx(본문 1줄), RecognizedProblemBar.tsx}`, `shared/ui/text-link/textLinkStyle.ts`, `pages/mypage/MyPage.tsx`(`min-h-dvh`), `test/stage5OneLineDelta.ts`(`mt-0.5`), `app/devFiguresRoute.test.tsx`(supabase mock), 신규 `features/ai-solution/oneLineLayout.test.tsx`, 추가 `pages/mypage/MyPage.stage5.test.tsx`(1)
- 문서: 신규 `docs/FIGURES_FINAL_REPORT.md`, `docs/FIGURE_DESIGN.md`(§7.4·§18 보드 폭 정정 — design P2 지시), 이 장부
- 하니스: `.omc/research/figures-stage5-headless/{server.mts, run.mjs}`(긴 무공백 줄·넘침·정렬 측정)
- 변경 금지 diff 0 유지(허용 예외: `WorkLineList` 배지 2곳 + 본문 1곳, `diagnosis.router` 1줄). 기존 테스트 삭제·완화 0(`devFiguresRoute.test.tsx`는 mock 추가만, 단언 동일). 새 의존성 0.

#### 8.19.4 게이트(재작업 1)

| 실행 | typecheck | lint | test | build |
|---|---|---|---|---|
| **OneDrive 첫 실행** | 0 | 0 | 0 — api 71 파일/1,032, web 116 파일/1,214 | 0 — 메인 `index-P_tNks0Z.js` 975,975B, precache 8, 커널·JXG·jsxgraph·SolutionFigures·lazyEntry 0 |
| OneDrive 밖 복사본(`git ls-files -co` + `pnpm install --offline`, `apps/web/.env` 넣음) 첫 실행 | 0 | 0 | 0 — api 1,032, web 1,214 | 0 — 같은 해시 `index-P_tNks0Z.js` |
| OneDrive 밖 복사본(**`.env` 없음**, 깨끗한 체크아웃 상당) 첫 실행 | 0 | 0 | 0 — api 1,032, web 1,214(LOW-6 해소) | 0 — `index-DzxsB5TF.js` 975,980B(빌드에 박히는 `VITE_*` 값이 없어 해시만 다름) |

- §7.18.4 예외 적용 없음(세 실행 모두 실패 0). 하니스 서버 종료 후 실행.


### 8.20 Stage 5 QA 재검증 (stage-qa-agent, 2026-10-25, 재작업 1/3 이후)

**판정: STAGE CONDITIONAL PASS — FIX REQUIRED (문서 보정 3건뿐) — 구현·테스트 수준의 미해소 항목 0.** 1차 지적(MEDIUM-1, LOW-1·2·3·4·6·7·10, design P2·P3)은 모두 해소 확인. 남은 것은 ① 최종 보고 문서의 사실 오류 3건(LOW) ② 실DB BLOCKED ③ 실기기 NOT VERIFIED ④ 이월 MEDIUM-2(CAS 순서쌍). 제품 코드·문서(이 장부 제외) 수정 0.

범위 분리: **자동** 통과 / **헤드리스**(Chromium·WebKit, hasTouch, 1194×834, 물리 iPad 아님) 통과 / **실기기** NOT VERIFIED / **실DB** BLOCKED(마이그레이션 미적용, 오너) / **실제 AI** 새 호출 0, R1·R2 NOT RUN(오너 미승인)·R3는 §8.18.6 검토 그대로.

#### 8.20.1 항목별 재검증

| 항목 | 판정 | 직접 확인 |
|---|---|---|
| MEDIUM-1 긴 무공백 줄 | **해소** | (a) 마이페이지 오버레이, 지난번 하니스(공백 없는 300자 줄, 이어풀기 행): **수정 전 코드(복사본 vite)** scrollWidth 1,948/2,236 vs clientWidth 718, 줄 폭 1,841/2,129, 배지 카드 밖 → **현재**: 718=718(Chromium·WebKit), 줄 폭 571로 4~5줄 꺾임, 배지 카드 안. (b) 실시간 진단 화면(개발자 서버의 4번째 줄 300자): 수정 전 1,924/2,086 vs 418 → 현재 418=418, 줄 폭 314, 배지 3개 카드·화면 안. (c) 회귀: 짧은 줄만 있는 행의 줄·번호·배지·카드 기하(좌표·폭·높이) **수정 전과 동일**, 공백 있는 긴 줄·짧은 줄 폭 동일. (d) 같은 입력의 "내가 쓴 풀이" 머리·1·3번째 줄·인식 바 스크린샷 old/new **픽셀 동일**(두 엔진) |
| LOW-1 도형 PATCH 로그 | 해소 | 변경 코드: `logResumeWriteError`(코드만), 탐지 "사용 불가" 로그도 코드만. 내 하니스 P11("Failing row contains" 주입, resume PATCH) **지난번 FAIL → 현재 PASS**, 영속 시나리오 113/113. 신규 테스트 3종은 로그를 되돌리는 변이에서 실패(2건) |
| LOW-2 라우터 가드 | 해소 | 신규 라우터 테스트: 라우터 가드 제거 변이 → 해당 테스트만 실패(지난번엔 생존) |
| LOW-3 수치 | 해소 | 장부 §8.12.6 = `measure.json`(0.361/0.445, 0.356/0.413) |
| LOW-4 `api-none.out` | 해소 | 파일 없음 |
| LOW-6 `.env` 의존 | 해소 | **`.env` 없는** 밖 복사본에서 web 116/1,214 통과(§8.20.3). `devFiguresRoute.test.tsx`는 mock 추가만(단언 diff 0) |
| LOW-7 DB 크기 제약 | 해소(설계) | 마이그레이션 65,536으로 완화 + 주석, 가짜 DB 동일, 서버 상한 바로 아래 저장 성공 테스트. 실DB 확인은 BLOCKED |
| LOW-10 | 해소 | 머리말 주의 문구 확인 |
| design P2 | 해소 | 실측 결과 패널 액자 346/그리기 344, 오버레이 646/644(두 엔진). FIGURE_DESIGN §7.4·§18 정정 확인. **잔여**: §17 본문 574·670행의 "Default 보드는 항상 348px"·"348px로 맞춘다"는 정정되지 않음(LOW-11) |
| design P3 포커스 링·`mt-0.5` | 해소 | `TEXT_LINK_FOCUS_RING` 하나를 `TEXT_LINK_STYLE`·인식 바가 공유, 버튼 `pt-0.5`→`mt-0.5`(글자 위−버튼 위 1·버튼 아래−글자 아래 1, 글자 위−배지 위 3 — 두 엔진), "다시 풀기" Tab 포커스 링 box-shadow 확인(Chromium, 모서리 6px) |
| design P3 `min-h-dvh` | 해소 | MyPage 루트 클래스 + 테스트 |
| WorkLineList 변경 범위 | 허용 범위 내 | `git diff HEAD`: 줄 본문 `<p>`에 `min-w-0`·`wrap-anywhere`, 배지 2곳 `shrink-0 whitespace-nowrap` — 3줄(+3/−3), 그 밖 diff 0. 변경 금지 목록 diff 0(예외 `diagnosis.router` 1줄뿐), package.json·락 diff 0, 기존 테스트 삭제·단언 약화 0(§8.20.2) |

**포커스 링 정리의 다른 화면 영향**: `TEXT_LINK_STYLE`을 쓰는 곳은 `WorkLineList` "수정"(실시간 진단)과 `PasswordResetModal` 링크뿐이다. 두 링크에 정적으로 `rounded-[6px]`가 더해졌지만 배경·테두리가 없어 안 보이고(computed: radius 0→6px, background 투명, border 0, 폭·높이 25.95×20 동일) "수정" 링크·머리·줄 스크린샷이 수정 전과 픽셀 동일하다. 바뀌는 것은 **키보드 포커스 링 모서리**(직각→6px)뿐이다. `PasswordResetModal`은 복구 세션이 필요해 직접 열어 보지 못했다(클래스 동일 상수라는 근거로만). 또 하나의 off 상태 변화: MyPage 루트 `min-h-screen`→`min-h-dvh`(데스크톱 동일, iOS에서만 의도된 차이)는 MyPage DOM 기준값이 대화상자만 비교해 기준값 밖이다 — S5-1의 "바이트 동일"에 대한 문서화된 예외로 보고(오너 확인 권장, 장부 §8.19 기록은 있음).

#### 8.20.2 off 동일성·기준값(S5-1) 재확인

- 지난번 캡처 스크립트로 현재 트리를 다시 캡처: HEAD(091ae2a) 대비 스키마 전/후 **모두 바이트 동일**(어댑터 `diagnose/resume/generateFigures` 인자 포함). 영속 113/113, CHAT 51/51, 10개 사례(스키마 전/후) 55/55 — 변화 없음.
- 기준값 비교 느슨함 점검: 이번 변경으로 `stage5OneLineDelta.ts`의 버튼 증감 `pt-0.5`→`mt-0.5` 한 토큰만 바뀌었고(기준값 JSON 불변), **실제 HEAD 기준값 ↔ 현재 렌더 DOM diff**는 `RecognizedProblemBar` 4노드뿐: 카드 `items-center→items-start`, 배지 +`shrink-0 whitespace-nowrap`, 본문 +`min-w-0 pt-0.5 wrap-anywhere`, 버튼 +`mt-0.5 whitespace-nowrap rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` — delta와 정확히 일치, 태그·속성·텍스트·자식 수 차이 0. 무관 변이 13종(본문 `font-bold`, `gap-4`, 버튼 `mt-0.5` 제거, **`pt-0.5`로 되돌림**, `data-qa`, 배지 size, `whitespace-pre-wrap` 제거, 라벨 접미사, `aria-label`, 배지 `mt-1`, `min-w-0` 제거, 카드 `mb-2`, 포커스 상수의 `rounded-[6px]` 제거·`ring-offset-4`) → **13/13 비교 실패**(느슨해지지 않음). WorkLineList 클래스 제거 변이는 신규 `oneLineLayout.test.tsx`가 잡는다.

#### 8.20.3 게이트(첫 실행)

| 실행 | typecheck | lint | test | build |
|---|---|---|---|---|
| 저장소 루트(OneDrive) | 0 | 0 | 0 — api 71/1,032, web 116/1,214 | 0 — 메인 `index-P_tNks0Z.js` 975,975B(off, 커널·JXG·jsxgraph·SolutionFigures·lazyEntry 0, `sw.js` 포함), precache 8 |
| OneDrive 밖 복사본(`git ls-files -co` − ProblemDB, **`apps/web/.env` 없음**) | 0 | 0 | 0 — api 1,032, web 1,214 | 0 — `index-DzxsB5TF.js`(빌드에 박히는 VITE 값 차이로 해시만 다름) |

단언 실패·예외 적용 0. on 빌드(`VITE_FIGURES_ENABLED=true`, `.env` 포함): 메인 **886,248B**(커널·JXG 0), 공통 `FigureErrorBoundary` 90,131B(커널 0), 커널은 `lazyEntry` 51,895B에만, `jsxgraph` 1,040,973B, precache 12.

#### 8.20.4 최종 보고 문서(`docs/FIGURES_FINAL_REPORT.md`) 검토

- **§4 10개 항목 전부 존재**: 1 Stage 결과·재작업 / 2 design 실행·생략 / 3 변경 파일+mermaid 흐름도 / 4 F09 JSON 예시 / 5 지원·미지원 / 6 QA·재작업 / 7 실제 AI / 8 iPad 체크리스트 / 9 지연·비용 / 10 남은 제약·비활성화.
- **표기**: Stage 1~4 판정·재작업(0/1·0/1·…)이 장부 §2와 일치, Stage 5는 "재검증 대기·1/3"(이번 재검증으로 갱신 필요). 실기기는 전부 "미실행"이며 "실기기 PASS" 표현 없음, 헤드리스는 "물리 iPad 확인이 아니다"로 구분. R1·R2 **NOT RUN — 오너 미승인**, 실DB **BLOCKED(오너 결정)**, 금액 미산정 사유 명시 — 모두 맞음.
- **원본 대조 일치**: 커밋별 파일 수(61·43·92), Stage 3 평가 22건 지표·지연·토큰(16/16, 0/6, 13/13, 6,383/14,260/16,126ms, 80,448/15,595), Stage 4 보정 4/4·토큰 15,881/2,154·지연 3.3~5.4s, R3 지표·p50/p95(스크립트 정의 vs QA 재계산 병기), `measure.json` 수치, 행당 JSON 바이트, CHAT 증가량, 플래그 표·켜는 순서, F09 JSON 예시(SSE=DB=상세 확인값, CHAT 섹션의 H foot highlight (0,0)·M midpoint visible:false (1,0)), iPad 항목 1~12(계획 §7.5)+13~17.
- **사실과 다른 서술(LOW 3건, 보정 필요)**: (1) §9 **웹 번들(on) 메인 886,293B** — 재작업 뒤 실측 886,248B(off만 975,975로 갱신되고 on은 재작업 전 값, "같음"으로 표기). (2) §5 "**지원 요소(12)**" — 나열·FIGURE_SPEC §3.3 기준 요소 타입은 **14개**(표 행이 12행). (3) §1·§6의 Stage 5 "재검증 대기"는 이 절 판정으로 갱신 필요. 또 `FIGURE_DESIGN.md` §17 본문 2곳의 348px(LOW-11).

#### 8.20.5 남은 항목

- **필수(문서)**: 위 LOW 3건 + LOW-11 정정, 최종 보고 §1·§6에 이 판정 반영.
- **BLOCKED(오너)**: 마이그레이션 2종 적용 → RS7 cascade·S5-3 실DB·RLS select-own·SQL 실행·`pg_column_size` 경계(65,536 완화 포함).
- **NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED**: 최종 보고 §8의 17항목 전부(그림 위 터치 스크롤, VoiceOver, Split View, iOS 하단 막대, Safari Tab 순환 등). WebKit 헤드리스는 Tab이 버튼에 가지 않아 "다시 풀기" 포커스 링은 Chromium으로만 확인.
- 이월: MEDIUM-2(CAS 순서쌍 → 좌표 답 이어풀기 미저장·미표시), LOW-5·8·9(기록만, LOW-8은 같은 problemId에 solve·resume 공존 가능성을 개발자가 코드로 확인 — 결정 필요), 오버레이 뒤 목록 비침(결정 필요).
- 하니스: 개발자 `run.mjs`를 scratchpad 복사본으로 그대로 실행해 §8.19.2 수치와 일치(콘솔 오류는 기존 suggestions 400뿐). 포트 5199·4199·54398만 사용, 종료·해제 확인. 오너 서버(5173·4000·8000) 무변경.

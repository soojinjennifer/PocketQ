# 수풀잉 도형 시각화 — 워크플로 상태 장부

`Prompt/15. Graph JSXGraph change.md`의 표준 에이전트 루프(plan-agent → design-agent(필요시) → development-agent → stage-qa-agent)를 Stage 단위로 기록한다. 대화가 끊겨도 이 문서만 보고 이어서 실행할 수 있어야 한다.

- 요구사항: `docs/PRD_WHYMATH.md` §4.12 (FIG)
- 데이터 계약: `docs/FIGURE_SPEC.md`
- 프로젝트 전체 현황: `docs/PROJECT_STATUS.md` §3.41, §5 "6.8 도형 시각화"

---

## 1. 현재 위치

| 항목 | 값 |
|---|---|
| 현재 Stage | Stage 3 — 풀이 AI API 연결 |
| 현재 역할 | Stage 3 stage-qa-agent 판정 완료(§6.10) → 다음 Stage 4 plan-agent 대기 |
| 상태 | **Stage 3 PASS**(stage-qa 독립 검증, §6.10). 운영 플래그는 off 유지, on 전 조건 2건(텍스트 회귀 대표본/파서 보강, 보정 효과 측정) Stage 4로 이월(§6.10.8) |
| 재작업 | Stage 2: 1 / 3 (종료). Stage 3: 0 / 3 |
| 차단 요인 | 없음(실제 키로 평가 실행함). 운영 플래그는 off 유지(D9) |
| 다음 작업 | Stage 4 plan-agent: §6.3 design 인계 + §6.10.8 이월 조건 반영. 제품 문서 머리말의 "stage-qa 전/대기" 문구 갱신(§6.10.4 L-3) |

## 2. Stage 표

| Stage | 내용 | 루프 | design-agent | 상태 | 재작업 |
|---|---|---|---|---|---|
| 1 | 현황 분석과 데이터 계약 | plan → dev → stage-qa | 생략(UI 영향 없음) | **PASS** | 0/3 |
| 2 | 검증기와 고정 fixture 렌더링(JSXGraph 설치) | plan → design → dev → stage-qa | 실행(`docs/FIGURE_DESIGN.md`, 오너 승인) | **PASS**(design 재검수 PASS + stage-qa 재검증 PASS §4.6, 실기기 미확인) · 후속 정리 완료(§4.7) | 1/3 |
| 3 | 풀이 AI API 연결 | plan → dev → stage-qa (+design: 로딩·실패 UI 시) | 생략(화면 변경 없음, §6.3) | **PASS**(stage-qa §6.10, 실제 모델 보정 효과·텍스트 대표본은 이월 조건) | 0/3 |
| 4 | 단계별 표시와 iPad 대응 | plan → design → dev → stage-qa | 필요 | 미착수 | — |
| 5 | 저장·CHAT 연동과 통합 QA | plan → design(필요시) → dev → stage-qa | 조건부 | 미착수 | — |

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

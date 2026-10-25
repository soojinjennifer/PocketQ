# 수풀잉 API 계약 — 풀이(solve)·이어풀기(resume)

이 문서는 **풀이·이어풀기 스트리밍 엔드포인트만** 다룬다(Stage 3 결정 D7). 다른 엔드포인트(recognize, chat, suggestions, work, diagnose, problems)는 아직 이 문서에 정리하지 않았으며 각 라우터(`apps/api/src/modules/*/*.router.ts`)와 요청 스키마(`packages/validation/src/index.ts`)가 기준이다.

- 요구사항: `docs/PRD_WHYMATH.md` §4.4(SOLVE), §4.7(RESUME), §4.12(FIG, FIG-11)
- 도형 데이터 계약: `docs/FIGURE_SPEC.md`(§2 응답 위치, §16 AI 생성)
- 기능 플래그: 서버 환경변수 `FIGURES_ENABLED`(정확히 `"true"`일 때만 on, 기본 off)

---

## 공통

| 항목 | 값 |
|---|---|
| 인증 | `Authorization: Bearer <Supabase access token>` 필수. 없거나 무효면 `401 unauthorized` |
| 속도 제한 | `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` |
| 스트림 전 오류 | JSON `{ "error": { "code", "message", "details"? } }` + HTTP 상태(400 `validation_error`, 401, 404, 429, 500 `internal_error`) |
| 스트림 응답 | `200`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive` |

SSE 블록 형식은 `event: <이름>\ndata: <JSON 한 줄>\n\n`이다. `:`로 시작하는 줄만 있는 블록(예: `: keep-alive`)은 **주석**이며 클라이언트는 무시한다(`apps/web/src/shared/api/parseSse.ts`는 data가 없는 블록을 버린다).

### SSE 이벤트

| 이벤트 | data | 횟수 | 설명 |
|---|---|---|---|
| `chunk` | `{ "delta": string }` | 0회 이상 | 모델 출력 텍스트 조각(마크다운) |
| `done` | `Solution` 또는 `ResumeSolution` | 0~1회 | 텍스트 풀이 완료. **도형 키(`figures`·`stepFigureRefs`)를 넣지 않는다** — 플래그 on/off와 무관하게 같은 모양 |
| `figures` | `{ "figures": FigureSpec[], "stepFigureRefs": StepFigureRef[] }` | 0~1회 | **on 전용, done 뒤.** 서버 검증을 통과한 도형이 1개 이상일 때만 보낸다. 형식은 `docs/FIGURE_SPEC.md` §3 |
| `error` | `{ "code": "provider_error", "message": string }` | 0~1회 | 텍스트 풀이 실패. **done 뒤에는 보내지 않는다(on)** |
| `: keep-alive`(주석) | — | 0회 이상 | on 전용, done 뒤 도형 단계 동안 주기적으로(기본 15초, 결정 필요) |

### done 이후 규칙(FIGURES on)

1. `done`을 먼저 보내고(저장도 done 시점에 끝난다), 그다음 별도의 비스트리밍 구조화 호출로 도형을 만든다.
2. 도형 단계는 **어떤 경우에도 `event: error`를 보내지 않는다.** 생성 실패·타임아웃·incomplete·거부·JSON 실패·검증 실패는 모두 "figures 이벤트 없음"으로 끝난다.
3. 받아들인 도형이 없으면 `figures` 이벤트 없이 스트림이 끝난다. 거부 사유는 서버 로그에만 남는다(내용 없이 개수·코드만).
4. 클라이언트가 연결을 끊으면 진행 중인 도형 호출을 취소하고, 이후 아무것도 쓰지 않는다.
5. 도형 생성은 요청당 1회, 실패한 도형만 도형당 최대 1회 보정한다(SDK 자동 재시도 없음, 호출별 타임아웃 30초, 도형 단계 전체 상한 60초 — 상한은 결정 필요).
6. `figures`의 각 도형은 서버의 zod 출력 객체다. AI가 준 `verified`·스타일 등 스키마에 없는 키는 그 도형을 거부하게 만들며 그대로 전달되지 않는다.
7. 클라이언트는 `done`에서 결과를 확정하고(후속 동작 시작), 이후 `figures`가 오면 결과에 병합한다. done 이후의 오류는 결과를 지우지 않는다.
8. **(Stage 4) 하드 데드라인**: 도형 단계 전체 상한이 지나면 어댑터 응답과 관계없이 도형 단계를 끝내고 스트림을 닫는다. 상한이 보정 중에 지나면 이미 1차 검증을 통과한 도형만 `figures`로 보낸다. 클라이언트가 끊긴 경우는 보내지 않는다.
9. **(Stage 4) 클라이언트 중단**: 웹은 새 요청·reset·화면 이탈 때 요청을 abort한다. 서버는 연결 종료로 이를 알고 진행 중인 도형 호출을 취소한다(규칙 4와 같다).

> **Stage 4 의미 변화 메모(계약 불변)**: SSE 이벤트 이름·순서·`Solution`/`ResumeSolution`/`FigureSpec` 스키마는 바뀌지 않았다. 바뀐 의미는 두 가지다. ① 비정상 모델 출력 정상화 — 개념 분류 JSON이 응답 끝이 아닌 곳에 있으면 `done.answerMd`에서 JSON을 지우고 `conceptTags`를 살린다(JSON만 있는 답은 풀이의 마지막 `\boxed{…}` 또는 빈 값). 이어풀기 `answerMd`에서는 줄 맨 앞 단계 표지·개념 JSON 줄을 지운다. 정상 출력은 변경 전과 같다. ② 위 규칙 8의 하드 데드라인과 만료 시 1차 통과 도형만 전송. off 경로는 여전히 기준값과 바이트 동일하다(`figuresOff.baseline.test.ts` 무수정 통과).

### FIGURES off(기본)

프롬프트·요청·SSE가 Stage 3 이전과 **바이트 단위로 같다**(기준값 `apps/api/src/contracts/__baseline__/figuresOff.baseline.json`, 테스트 `figuresOff.baseline.test.ts`). 단계 표지 지시·도형 호출·keep-alive·figures 이벤트 모두 0. 플래그를 지우고 서버만 재시작하면 복귀한다.

---

## POST `/api/problems/:problemId/solve`

최초 풀이(SOLVE).

요청 본문(`solveRequestSchema`):

```json
{ "options": { "concept": true, "solution": true }, "confirmedText": "선택 — 학생이 고친 문제 텍스트" }
```

- `problemId`가 없거나 다른 사용자 소유면 `404 validation_error`.
- `done` data = `Solution`: `{ conceptMd: string|null, solutionMd: string|null, answerMd: string, conceptTags: string[], aiProvider, aiModel }`.
- 저장: done 시점에 서버 메모리 저장소와 Supabase `solutions`에 저장한다(도형은 저장하지 않는다 — Stage 5).
- on이면 풀이 프롬프트가 `## 풀이` 섹션의 각 단계를 줄 맨 앞 `**N단계**`로 시작하도록 요청한다. `sN`은 `Solution.solutionMd`(헤더 제외) 안의 N번째 단계다.

예(on, 도형 1개):

```
event: chunk
data: {"delta":"## 풀이\n**1단계** ..."}

event: done
data: {"conceptMd":"...","solutionMd":"**1단계** ...\n**2단계** ...\n**3단계** ...","answerMd":"최솟값은 -1입니다.","conceptTags":["이차함수 > 최대·최소"],"aiProvider":"openai","aiModel":"..."}

: keep-alive

event: figures
data: {"figures":[{"schemaVersion":1,"figureId":"fig-f07", ...}],"stepFigureRefs":[{"stepId":"s1","figureId":"fig-f07"}, ...]}

```

## POST `/api/problems/:problemId/resume`

이어풀기(RESUME). 진단(DIAG)이 끝난 문제만 가능하다.

요청 본문(`resumeRequestSchema`): `{ "mode": "own" | "alternative" }`

- 문제가 없거나 다른 사용자 소유, 또는 진단 결과가 없으면 `404`. `mode: "own"`인데 진단이 `isMethodApplicable: false`면 `400`.
- 순서: `chunk*` → (CAS 최종 답 검증) → `done` → (on) `: keep-alive`* → `figures`? → 종료.
- `done` data = `ResumeSolution`: `{ mode, methodName, solutionMd, answerMd, verified }`. `verified`는 CAS 검증 결과. 저장(`setResumeSolution`) 시점·내용은 플래그와 무관하다.
- on이면 `## 이어풀기` 섹션에 `**N단계**` 표지를 요청한다. `sN`은 `ResumeSolution.solutionMd` 안에서 s1부터 센다 — own 모드에서도 학생 풀이의 줄 번호(`lineNo`)와 무관하며 s1은 이어서 쓴 첫 단계다. `## 최종 답`은 계속 순수 LaTeX(CAS 파싱 대상)이며 표지를 넣지 않는다.
- 도형 생성에는 own 모드만 학생 풀이의 유효 구간(`lineNo ≤ diagnosis.lastValidLine`, stallLine 이후 제외, 줄 수·길이 상한)을 데이터로 넘긴다. alternative는 넘기지 않는다.

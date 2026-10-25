# PocketQ CAS Service

PocketQ(포켓큐)의 DIAG-1(학생 풀이 각 줄의 수학적 타당성 검증)과 RESUME-5(이어풀기 최종 답이
원 문제의 정답과 일치하는지 검증)를 담당하는 CAS(Computer Algebra System) 서비스다.
Node API(`apps/api`)가 이 서비스가 없거나(`CAS_SERVICE_URL` 미설정) 응답하지 않을 때는
결정론적 스텁(`apps/api/src/infrastructure/cas/stubCasVerification.ts`,
`stubResumeCasCheck.ts`)으로 대체된다.

## 범위 — Phase 1만 구현

**등식 변형 동치성 검사만 지원한다.** 부등식 방향 반전, 미적분(도함수·적분), 수열(점화식·일반항)
검증은 **Phase 2로 명시적으로 연기**됐고 이 서비스에는 구현돼 있지 않다. 그런 입력이 들어와도
등식/단일 수식 동치성 판정 로직만 적용되며, 별도의 부등식/미적분/수열 처리는 없다.

로컬 개발 환경까지만 지원한다 — 프로덕션 배포(Dockerfile, Render 설정 등)와 CI 통합은 이
범위 밖이다.

## 기술 스택

- Python 3.12
- [uv](https://docs.astral.sh/uv/) (패키지 매니저)
- FastAPI + uvicorn
- SymPy `sympy.parsing.latex.parse_latex` (`backend="lark"` — 순수 파이썬 파서라 별도 grammar
  컴파일이 필요 없다. 기본 백엔드인 `antlr`은 별도 런타임 설치와 grammar 컴파일이 필요해
  사용하지 않는다.)
- 테스트: pytest / Lint: ruff

## 로컬 기동

```bash
cd services/cas
uv sync                 # .venv 생성 + 의존성 설치 (Python 3.12는 uv가 필요 시 자동 설치)
uv run uvicorn app.main:app --reload --port 8000
```

`.env.example`을 참고해 필요하면 `.env`로 복사해 포트를 바꿀 수 있다(기본 8000).

## 테스트 / Lint

```bash
uv run pytest
uv run ruff check .
```

## 엔드포인트

### `GET /health`

```json
{ "status": "ok" }
```

### `POST /verify-work-lines` (DIAG-1)

요청:

```json
{
  "lines": [
    { "lineNo": 1, "latex": "y=x^2-4x+3" },
    { "lineNo": 2, "latex": "y=(x-2)^2-1" }
  ]
}
```

응답:

```json
{ "results": [{ "lineNo": 1, "isValid": true }, { "lineNo": 2, "isValid": true }] }
```

각 줄의 `isValid`는 "직전 줄과 대수적으로 동치인가"를 뜻한다. 첫 줄은 비교 대상이 없으므로
항상 `isValid: true`다.

**파싱 실패 처리**: `CasStepVerification` 타입(Node `shared-types`)을 `{ lineNo, isValid }`에서
확장하지 않기로 했으므로(오너 결정), 파싱 실패로 "판정 불가" 상태가 돼도 별도 필드로 표현하지
않는다 — 이 서비스는 로그만 남기고 Node 쪽에는 보수적으로 `isValid: false`를 응답한다. 즉
Node/LLM 레이어는 "CAS가 부적합으로 판정한 줄"과 "CAS가 판정할 수 없었던 줄"을 구분하지
못한다.

### `POST /verify-final-answer` (RESUME-5)

요청:

```json
{ "problemAnswerLatex": "-1", "solutionAnswerLatex": "-1" }
```

응답:

```json
{ "verified": true }
```

파싱 실패 시에도 위와 동일한 원칙으로 `verified: false`를 보수적으로 응답한다. 판정 중 어떤
예외가 나도(예: `x<3` vs `3`처럼 비스칼라 값을 비교해 TypeError) 500이 아니라 200과
`verified: false`로 응답한다.

#### 지원하는 답 형식

SymPy lark 파서는 괄호 안의 쉼표 목록(`(2,2)`)을 받지 못하므로, 최종 답 비교에서만
`app/core/answer_forms.py`가 쉼표 목록을 원소로 나눠 원소마다 기존 파서·동치 판정을 쓴다
(`parse_to_sympy`·`/verify-work-lines`는 그대로다). 먼저 `$…$`·`\(…\)`·`\[…\]`·`\text{…}`를 벗기고
`\left`·`\right`·`\ `·`\,`를 정리한다.

| 형식 | 예 | 비교 규칙 |
|---|---|---|
| 단일 값·식·등식(쉼표 없음) | `-1`, `x=3`, `y=(x-2)^2-1` | 기존 경로 그대로(원문 그대로 파싱) |
| 천 단위 쉼표 | `1,000` = `1000` | 괄호 없는 최상위 단일 수가 `^-?[1-9]\d{0,2}(,\d{3})+$`일 때만 하나의 수로 합침(`0,001`은 합치지 않음). 순서쌍·집합 안에서는 합치지 않음 |
| 순서쌍(ordered) | `(1,3)`, `\left(1,3\right)`, `(x,y)=(2,2)`, `M(1,3)`, `P_1(2,2)` | 길이가 같고 원소마다 동치일 때만 참 — 순서 중요 |
| 집합(set) | `\{1,3\}` = `\{3,1\}` | 양방향 동치 매칭 — 순서·중복 무관 |
| 여러 해(solutions) | `x=1, x=3`, `1, 3` | 모든 항이 같은 Symbol의 `x=값`이거나 모두 순수한 값. 집합과 서로 비교 가능 |

- 좌변이 서로 다른 Symbol의 튜플(`(x,y)=…`)이면 우변을 비교한다. 점 이름은 대문자 한 글자 +
  선택적 아래첨자만 뗀다(`P_{1}` = `P_1`).
- **양쪽 모두에 있을 때만** 같아야 하는 정보: 좌변 Symbol 순서(`(x,y)=(1,3)` ≠ `(y,x)=(1,3)`),
  점 이름(`A(1,3)` ≠ `B(1,3)`), 해 목록의 Symbol(`x=1, x=3` ≠ `y=1, y=3`). 한쪽에만 있으면 떼고
  값만 비교한다(`(x,y)=(2,2)` = `(2,2)`, `M(1,3)` = `(1,3)`, `x=1, x=3` = `\{1,3\}`).
- 원소에 선행 0이 있는 수(`000`, `01`)는 파싱 실패로 본다 — `(1,000)` ≠ `(1,0)`.
- 항상 `false`: 종류가 다른 비교(`(1,3)` vs `\{1,3\}`·`1,3`·`3`), 구간·부등식 표기(`[1,3]`,
  `(1,3]`, `1<x<3`), 연립 형태(`x=2, y=2` vs `(2,2)`), 다른 Symbol이 섞인 목록(`x=1, y=3`),
  원소가 `Eq`인 튜플·집합, 원소 하나라도 파싱 실패, 원소 10개 초과.
- 지원하지 않음(미룸): `\text{또는}` 구분자(`x=1 \text{ 또는 } x=3`).

## 수동 통합 테스트 예시

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/verify-work-lines \
  -H "Content-Type: application/json" \
  -d '{"lines":[{"lineNo":1,"latex":"y=x^2-4x+3"},{"lineNo":2,"latex":"y=(x-2)^2-1"}]}'

curl -X POST http://localhost:8000/verify-work-lines \
  -H "Content-Type: application/json" \
  -d '{"lines":[{"lineNo":1,"latex":"y=x^2-4x+3"},{"lineNo":2,"latex":"y=(x-2)^2+1"}]}'

curl -X POST http://localhost:8000/verify-final-answer \
  -H "Content-Type: application/json" \
  -d '{"problemAnswerLatex":"-1","solutionAnswerLatex":"-1"}'
```

Node API(`apps/api`)와 함께 확인하려면 `apps/api/.env`에 `CAS_SERVICE_URL=http://localhost:8000`을
설정한 뒤 API 서버를 띄운다.

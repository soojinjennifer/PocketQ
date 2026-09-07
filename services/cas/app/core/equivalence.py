"""Phase 1 동치성 판정 — 등식 변형 동치성 검사 + 완전제곱식류 극값 결론 판정만 지원한다.

**범위 제한(오너 승인)**: 부등식 방향 반전, 미적분(도함수·적분), 수열(점화식·일반항) 검증은
Phase 2로 명시적으로 연기됐다 — 이 모듈은 절대 그 범위를 다루지 않는다.

**2026-09 소폭 확장 1(오너 승인)**: 학생이 "y=(x-2)^2-1" 같은 변형 뒤 "최솟값은 -1"처럼 극값만
결론 내리는 흔한 패턴(중·고등 이차함수 최대·최소 단원의 전형적 마무리 줄)이 stage-qa-agent
회귀에서 항상 "부적합"으로 오판정되는 것이 발견되어, SymPy 내장 `minimum`/`maximum`(실수 전체
도메인)을 이용한 극값 비교만 추가했다 — 임의의 도함수 계산이나 일반 최적화 로직을 새로 만들지
않았다(과설계 금지 원칙 유지).

**2026-09 소폭 확장 2(오너 승인)**: 실기기 회귀에서 "Σ(k=1~15)a_k=10"(구하는 대상 자체가
시그마 합인 등식) vs "10"(순수 값) 비교가 항상 실패하는 것이 발견됐다 — 기존 로직이
`symbol = value` 형태(좌/우변이 단일 `Symbol`)만 값 추출을 허용했기 때문이다. 등식의 한쪽이
이미 자유 기호 없는 순수 상수이면(좌변이 `Symbol`이 아니라 `Sum` 등의 식이어도) 그 상수값을
그대로 비교하도록 확장했다 — 새 계산(합 전개 등)을 하지 않고 이미 파싱된 상수값끼리만
비교하므로 과설계가 아니다.
"""

import logging

import sympy
from sympy import S
from sympy.calculus.util import maximum, minimum

logger = logging.getLogger(__name__)


def _extremum_matches(expr: sympy.Basic, value: sympy.Basic) -> bool:
    """자유 변수가 하나뿐인 `expr`의 최솟값 또는 최댓값이 `value`와 일치하는지 확인한다.

    SymPy가 판단할 수 없거나(비다항식 등) 자유 변수가 0개/2개 이상이면 조용히 `False`로
    수렴한다 — 예외를 전파하지 않는다(파싱 실패와 동일한 "판정 불가 → 보수적 False" 원칙).
    """
    free_symbols = expr.free_symbols
    if len(free_symbols) != 1:
        return False
    symbol = next(iter(free_symbols))

    try:
        for extremum_fn in (minimum, maximum):
            extremum = extremum_fn(expr, symbol, domain=S.Reals)
            if sympy.simplify(extremum - value) == 0:
                return True
    except (NotImplementedError, TypeError, ValueError) as exc:
        logger.warning("극값 계산 실패(판정 불가로 처리): %s -> %s", expr, exc)

    return False


def is_equivalent(expr1: sympy.Basic, expr2: sympy.Basic) -> bool:
    """두 SymPy 객체가 대수적으로 동치인지 판정한다.

    - 둘 다 등식(`sympy.Eq`)이면 양변 차의 차가 0인지 확인한다:
      `simplify((lhs1 - rhs1) - (lhs2 - rhs2)) == 0`.
    - 둘 다 등식이 아니면(단일 수식/값) 직접 차를 비교한다: `simplify(expr1 - expr2) == 0`.
    - 하나만 등식이면(예: 문제 정답은 "x=3"인데 이어풀기 최종 답은 "3"만 적은 경우) 등식 쪽이
      `symbol = value` 형태일 때만 그 값을 꺼내 나머지 값과 비교한다 — 값이 직접 일치하지
      않으면, `symbol = f(x)` 형태의 `f(x)`가 갖는 최솟값/최댓값과 일치하는지도 확인한다
      (`_extremum_matches`, 예: "y=(x-2)^2-1" 다음 줄이 "최솟값은 -1"인 완전제곱식 극값 결론
      패턴). 둘 다 아니면, 등식의 한쪽이 이미 자유 기호 없는 순수 상수이면(예: "Σ(...)=10"의
      우변 `10`) 그 값을 비교한다. 그마저도 아니면(양쪽 다 자유 기호를 포함한 식) 의미 있게
      비교할 근거가 없으므로 보수적으로 `False`를 반환한다.

    극단적으로 복잡한 수식에 대한 `nsimplify`/`expand` 등 보조 시도는 Phase 1 범위에서
    의도적으로 넣지 않는다(과설계 금지, 오너 지시) — `simplify` 기반 최소 구현으로 충분하다.
    """
    if isinstance(expr1, sympy.Eq) and isinstance(expr2, sympy.Eq):
        diff = sympy.simplify((expr1.lhs - expr1.rhs) - (expr2.lhs - expr2.rhs))
        return diff == 0

    if not isinstance(expr1, sympy.Eq) and not isinstance(expr2, sympy.Eq):
        diff = sympy.simplify(expr1 - expr2)
        return diff == 0

    eq, value = (expr1, expr2) if isinstance(expr1, sympy.Eq) else (expr2, expr1)
    if eq.lhs.is_Symbol:
        diff = sympy.simplify(eq.rhs - value)
        return diff == 0 or _extremum_matches(eq.rhs, value)
    if eq.rhs.is_Symbol:
        diff = sympy.simplify(eq.lhs - value)
        return diff == 0 or _extremum_matches(eq.lhs, value)

    # 2026-09 소폭 확장(오너 승인, stage-qa-agent 실기기 회귀 발견): 문제의 구하는 대상이 그
    # 자체로 식인 경우(예: "Σ(k=1~15)a_k=10"), 좌변이 `Symbol`이 아니라 `Sum` 등의 식이어도
    # 반대편이 이미 자유 기호가 없는 순수 상수라면 그 값을 그대로 비교한다 — 새 계산(합 전개 등)
    # 을 하지 않고 이미 파싱된 상수값끼리만 비교하므로 과설계가 아니다.
    if not eq.rhs.free_symbols:
        if sympy.simplify(eq.rhs - value) == 0:
            return True
    if not eq.lhs.free_symbols:
        if sympy.simplify(eq.lhs - value) == 0:
            return True

    logger.warning(
        "등식/단일 수식 형태가 달라 의미 있게 비교할 수 없습니다: %s vs %s", expr1, expr2
    )
    return False

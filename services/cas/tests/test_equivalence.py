import sympy

from app.core.equivalence import is_equivalent
from app.core.parser import parse_to_sympy


def test_equivalent_equations_true():
    # y = x^2 - 4x + 3 <-> y = (x-2)^2 - 1 (완전제곱식 변형, 동치)
    e1 = parse_to_sympy("y=x^2-4x+3")
    e2 = parse_to_sympy("y=(x-2)^2-1")

    assert is_equivalent(e1, e2) is True


def test_non_equivalent_equations_false():
    # 상수항이 달라 동치가 아니다.
    e1 = parse_to_sympy("y=x^2-4x+3")
    e2 = parse_to_sympy("y=(x-2)^2+1")

    assert is_equivalent(e1, e2) is False


def test_equivalent_single_values_true():
    e1 = parse_to_sympy("-1")
    e2 = parse_to_sympy("-1")

    assert is_equivalent(e1, e2) is True


def test_equivalent_single_expressions_true():
    e1 = parse_to_sympy("x^2-4x+3")
    e2 = parse_to_sympy("(x-2)^2-1")

    assert is_equivalent(e1, e2) is True


def test_non_equivalent_single_values_false():
    e1 = parse_to_sympy("-1")
    e2 = parse_to_sympy("2")

    assert is_equivalent(e1, e2) is False


def test_mixed_equation_and_symbol_value_equivalent_true():
    # "x=3"(등식) vs "3"(값)처럼 한쪽만 등식이고 lhs가 단일 기호면 그 값을 비교한다.
    eq = parse_to_sympy("x=3")
    value = parse_to_sympy("3")

    assert is_equivalent(eq, value) is True
    assert is_equivalent(value, eq) is True


def test_mixed_equation_and_symbol_value_non_equivalent_false():
    eq = parse_to_sympy("x=3")
    value = parse_to_sympy("4")

    assert is_equivalent(eq, value) is False


def test_mixed_equation_without_bare_symbol_side_is_conservatively_false():
    # 양변 모두 단일 기호가 아닌 등식과 값은 의미 있게 비교할 근거가 없어 보수적으로 False.
    eq = parse_to_sympy("x+1=4")
    value = parse_to_sympy("3")

    assert is_equivalent(eq, value) is False


def test_boundary_zero_equals_zero():
    e1 = parse_to_sympy("0")
    e2 = sympy.Integer(0)

    assert is_equivalent(e1, e2) is True


def test_completed_square_minimum_conclusion_is_equivalent():
    # "y=(x-2)^2-1" 다음 줄에 최솟값만 "-1"로 결론 내리는 흔한 패턴(2026-09 소폭 확장,
    # stage-qa-agent 회귀에서 항상 False로 오판정되던 것을 발견해 추가).
    eq = parse_to_sympy("y=(x-2)^2-1")
    value = parse_to_sympy("-1")

    assert is_equivalent(eq, value) is True
    assert is_equivalent(value, eq) is True


def test_completed_square_wrong_minimum_conclusion_is_not_equivalent():
    eq = parse_to_sympy("y=(x-2)^2-1")
    value = parse_to_sympy("0")

    assert is_equivalent(eq, value) is False


def test_downward_parabola_maximum_conclusion_is_equivalent():
    eq = parse_to_sympy("y=-(x-2)^2+5")
    value = parse_to_sympy("5")

    assert is_equivalent(eq, value) is True


def test_sum_expression_equation_matches_constant_value():
    # 2026-09 실기기 회귀 발견: 구하는 대상 자체가 시그마 합인 등식("Σ(k=1~15)a_k=10")과
    # 순수 값("10")을 비교 — 좌변이 Symbol이 아니라 Sum 식이어도 우변이 이미 상수이므로
    # 비교 가능해야 한다.
    eq = parse_to_sympy(r"\sum_{k=1}^{15}a_k=10")
    value = parse_to_sympy("10")

    assert is_equivalent(eq, value) is True
    assert is_equivalent(value, eq) is True


def test_sum_expression_equation_wrong_value_is_not_equivalent():
    eq = parse_to_sympy(r"\sum_{k=1}^{15}a_k=10")
    value = parse_to_sympy("11")

    assert is_equivalent(eq, value) is False


def test_neither_side_constant_remains_conservatively_false():
    # 등식 양쪽 다 자유 기호를 포함한 식이면(비교 근거 없음) 여전히 보수적으로 False.
    eq = parse_to_sympy("x+y=z")
    value = parse_to_sympy("3")

    assert is_equivalent(eq, value) is False

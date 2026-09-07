import sympy

from app.core.parser import parse_to_sympy


def test_parses_valid_equation_to_eq():
    result = parse_to_sympy("y=x^2-4x+3")

    assert isinstance(result, sympy.Eq)
    assert result.lhs == sympy.Symbol("y")
    assert sympy.simplify(result.rhs - (sympy.Symbol("x") ** 2 - 4 * sympy.Symbol("x") + 3)) == 0


def test_parses_equation_with_braces_and_spaces():
    result = parse_to_sympy("y = x^{2} - 4x + 3")

    assert isinstance(result, sympy.Eq)


def test_parses_single_expression():
    result = parse_to_sympy("x^2-4x+3")

    assert not isinstance(result, sympy.Eq)
    x = sympy.Symbol("x")
    assert sympy.simplify(result - (x**2 - 4 * x + 3)) == 0


def test_parses_single_numeric_value():
    result = parse_to_sympy("-1")

    assert result == sympy.Integer(-1)


def test_strips_text_annotation_block_before_parsing():
    # `\text{...}`는 자연어 주석(학생이 결론 줄에 흔히 쓰는 형태)이라 파싱 전에 제거하고
    # 남은 수식만 파싱해야 한다(2026-09 stage-qa-agent 회귀 발견 — 이전엔 파싱 실패로
    # 항상 "판정 불가"가 되어, 정답에 도달한 학생에게 잘못된 오류 진단이 나갔다).
    result = parse_to_sympy(r"\text{최솟값은 } -1")

    assert result == sympy.Integer(-1)


def test_strips_dollar_delimiters_before_parsing():
    assert parse_to_sympy(r"$-1$") == sympy.Integer(-1)
    assert parse_to_sympy(r"$$-1$$") == sympy.Integer(-1)


def test_strips_paren_and_bracket_delimiters_before_parsing():
    assert parse_to_sympy(r"\(-1\)") == sympy.Integer(-1)
    result = parse_to_sympy(r"\[x=3\]")
    assert isinstance(result, sympy.Eq)


def test_parse_failure_returns_none_for_garbage_input():
    result = parse_to_sympy("최솟값은 -1입니다.")

    assert result is None


def test_empty_string_returns_none():
    assert parse_to_sympy("") is None
    assert parse_to_sympy("   ") is None

"""순서쌍·집합·여러 해 답 판정(`app.core.answer_forms`) 테스트.

R3 실제 사례(§8.16): `(2, 2)` vs `\\[\\n(2,2)\\n\\]`처럼 쉼표 목록을 lark 파서가 받지 못해 항상
`verified=false`가 되던 문제를 다룬다. 판정은 라우터(`/verify-final-answer`)를 통해 끝까지
확인한다 — 라우터가 `answer_forms`를 실제로 부르는지까지 함께 검증하기 위해서다.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.answer_forms import classify_answer, composite_equivalent
from app.main import app

client = TestClient(app)


def _verify(problem: str, solution: str) -> bool:
    response = client.post(
        "/verify-final-answer",
        json={"problemAnswerLatex": problem, "solutionAnswerLatex": solution},
    )
    assert response.status_code == 200
    return response.json()["verified"]


TRUE_PAIRS = [
    # R3 실제 사례 2건(원문 그대로)
    ("(2, 2)", "\\[\n(2,2)\n\\]"),
    ("(1, 3)", "\\((1,3)\\)"),
    (r"\left(1,3\right)", "(1,3)"),
    (r"(-2+3,\ 1+2)", "(1,3)"),
    (r"(1,\,3)", "(1,3)"),
    (r"(\frac12,3)", "(0.5,3)"),
    ("(x,y)=(2,2)", "(2,2)"),
    ("(2,2)", "(x,y)=(2,2)"),
    (r"\{1,3\}", r"\{3,1\}"),
    (r"\left\{1,3\right\}", r"\{3,1\}"),
    (r"\{1,1,3\}", r"\{3,1\}"),
    ("x=1, x=3", "x=3, x=1"),
    ("x=1, x=3", r"\{1,3\}"),
    (r"\{1,3\}", "x=1, x=3"),
    ("1, 3", "x=3, x=1"),
    ("1,000", "1000"),
    ("-1,000,000", "-1000000"),
    ("M(1,3)", "(1,3)"),
    ("P_1(2,2)", "(2,2)"),
    # 재작업 1: 양쪽 모두 점 이름이 있으면 이름이 같아야 한다 — `P_{1}`과 `P_1`은 같은 이름.
    ("P_{1}(2,2)", "P_1(2,2)"),
    ("M(1,3)", "M(1,3)"),
    ("(x,y)=(1,3)", "(x,y)=(1,3)"),
    ("(x,y)=(1,3)", "M(1,3)"),
    ("x=1,x=3", "1,3"),
    ("x=1,x=3", r"\{3,1\}"),
    ("12,345,678", "12345678"),
    ("$(2,2)$", "(2,2)"),
]

FALSE_PAIRS = [
    ("(1,3)", "(3,1)"),
    ("(1,3)", "[1,3]"),
    ("(1,3)", r"\{1,3\}"),
    ("(1,3)", "1,3"),
    ("(1,3)", "(1,3,0)"),
    ("(1,3)", "3"),
    ("(1,3)", "(1,3]"),
    ("(1,3)", "1<x<3"),
    ("[1,3]", "[1,3]"),
    ("(1,3]", "(1,3]"),
    ("(2,2)", "(2,3)"),
    ("x=1,x=3", "x=1"),
    ("x=1,y=3", "x=1,x=3"),
    ("x=1,y=3", "x=1,y=3"),
    ("x=2,y=2", "(2,2)"),
    ("1,000", "1,0"),
    ("(x,x)=(2,2)", "(2,2)"),
    ("(1,2)=(2,2)", "(2,2)"),
    ("m(1,3)", "(1,3)"),
    (r"x=1\text{ 또는 }x=3", "x=1, x=3"),
]

# 재작업 1/3(stage-qa CONDITIONAL PASS, 장부 §8.16.1) — 거짓 양성 회귀.
REWORK1_FALSE_PAIRS = [
    # MEDIUM-1: 양쪽 모두 좌변이 있으면 좌변 Symbol 순서까지 같아야 한다.
    ("(x,y)=(1,3)", "(y,x)=(1,3)"),
    ("(a,b)=(1,3)", "(b,a)=(1,3)"),
    ("(x,y)=(1,3)", "(a,b)=(1,3)"),
    # MEDIUM-2: 양쪽 모두 `변수=값`이면 같은 Symbol일 때만 비교한다(단일 해 `x=3` vs `y=3`과 일관).
    ("x=1,x=3", "y=1,y=3"),
    ("x=1,x=3", "y=3,y=1"),
    ("x=2,x=-2", "a=2,a=-2"),
    ("x=3", "y=3"),
    # 점 이름: 양쪽 모두 이름이 있으면 같아야 한다.
    ("A(1,3)", "B(1,3)"),
    ("P(0,0)", "Q(0,0)"),
    ("P_{1}(2,2)", "Q(2,2)"),
    ("P_1(2,2)", "P_2(2,2)"),
    # 퇴화한 천 단위: 첫 그룹이 0으로 시작하면 합치지 않는다.
    ("0,001", "1"),
    ("000,000", "0"),
    ("-0,001", "-1"),
    # 괄호·집합 안에서는 천 단위를 합치지 않고, 선행 0 원소(`000`)는 파싱 실패로 본다.
    ("(1,000)", "(1,0)"),
    ("(1,000)", "1000"),
    (r"\{1,000\}", r"\{1,0\}"),
    ("x=1,x=000", "x=1,x=0"),
    ("1,0001", "10001"),
]


@pytest.mark.parametrize(("problem", "solution"), REWORK1_FALSE_PAIRS)
def test_rework1_false_positives_are_false(problem: str, solution: str):
    assert _verify(problem, solution) is False


def test_one_sided_lhs_keeps_matching():
    # 한쪽에만 좌변이 있으면 그대로 참을 유지한다(오케스트레이터 결정).
    # 근거: 원 문제 정답은 보통 `(2,2)`처럼 값만 있고, 학생·이어풀기 답이 `(x,y)=(2,2)`처럼
    # 변수를 밝혀 쓰는 경우가 흔하다. 반대편에 비교할 변수 정보가 없으므로 값의 순서(순서쌍은
    # 이미 순서까지 비교)만으로 판정한다. 양쪽 모두 변수를 밝혔을 때만 변수 순서가 판정에
    # 들어간다(`(x,y)=(1,3)` vs `(y,x)=(1,3)`은 false).
    assert _verify("(x,y)=(2,2)", "(2,2)") is True
    assert _verify("(2,2)", "(x,y)=(2,2)") is True
    assert _verify("(x,y)=(1,3)", "(1,3)") is True
    assert _verify("(x,y)=(1,3)", "(3,1)") is False


def test_one_sided_point_name_keeps_matching():
    assert _verify("M(1,3)", "(1,3)") is True
    assert _verify("(1,3)", "B(1,3)") is True


def test_solutions_symbol_only_when_both_sides_have_it():
    # 한쪽이 순수 값 목록·집합이면 기존 동작(값만 비교)을 유지한다.
    assert _verify("x=1,x=3", "1,3") is True
    assert _verify("y=1,y=3", r"\{1,3\}") is True
    assert _verify("x=1,x=3", "x=3,x=1") is True


def test_leading_zero_element_is_parse_failure():
    assert classify_answer("(1,000)").kind == "invalid"
    assert classify_answer("0,001").kind == "invalid"
    assert classify_answer("(1,0)").kind == "ordered"
    assert classify_answer("(0.5,10)").kind == "ordered"
    assert classify_answer("(1.05,0)").kind == "ordered"


@pytest.mark.parametrize(("problem", "solution"), TRUE_PAIRS)
def test_equivalent_composite_answers_verified_true(problem: str, solution: str):
    assert _verify(problem, solution) is True


@pytest.mark.parametrize(("problem", "solution"), FALSE_PAIRS)
def test_non_equivalent_composite_answers_verified_false(problem: str, solution: str):
    assert _verify(problem, solution) is False


def test_element_parse_failure_is_false():
    assert _verify("(1,2+)", "(1,2)") is False
    assert _verify("(1,2+)", "(1,2+)") is False
    assert _verify(r"\{1,2+\}", r"\{1,2+\}") is False
    assert _verify("x=1, x=2+", "x=1, x=2+") is False


def test_more_than_ten_elements_is_false():
    eleven = r"\{" + ",".join(str(n) for n in range(1, 12)) + r"\}"
    assert _verify(eleven, eleven) is False


def test_ten_elements_is_still_supported():
    ten = r"\{" + ",".join(str(n) for n in range(1, 11)) + r"\}"
    ten_reversed = r"\{" + ",".join(str(n) for n in range(10, 0, -1)) + r"\}"
    assert _verify(ten, ten_reversed) is True


def test_tuple_with_equation_element_is_false():
    assert _verify("(x=1,2)", "(1,2)") is False
    assert _verify("(x=1,y=2)", "(x=1,y=2)") is False
    assert _verify(r"\{x=1,x=2\}", r"\{1,2\}") is False


def test_mixed_solutions_list_is_false():
    # `x=값`과 순수 값이 섞인 목록은 해 목록으로 보지 않는다.
    assert _verify("x=1, 3", "x=1, x=3") is False


class TestClassifyAnswer:
    def test_no_comma_keeps_original_latex_for_existing_path(self):
        form = classify_answer(r"\(y=(x-2)^2-1\)")
        assert form.kind == "scalar"
        assert form.latex == r"\(y=(x-2)^2-1\)"

    def test_thousands_separator_collapses_to_scalar(self):
        form = classify_answer("1,000")
        assert form.kind == "scalar"
        assert form.latex == "1000"

    def test_thousands_requires_strict_pattern(self):
        # 천 단위로 합치지 않는다.
        # 재작업 1부터 선행 0 원소(`00`·`0000`·`000`)는 파싱 실패라 invalid다.
        assert classify_answer("1,00").kind == "invalid"
        assert classify_answer("1,0000").kind == "invalid"
        assert classify_answer("1000,000").kind == "invalid"
        assert classify_answer("1,20").kind == "solutions"
        assert classify_answer("0,001").kind == "invalid"

    @pytest.mark.parametrize(
        ("latex", "kind", "size"),
        [
            ("(2, 2)", "ordered", 2),
            (r"\left(1,3\right)", "ordered", 2),
            ("M(1,3)", "ordered", 2),
            ("(x,y)=(2,2)", "ordered", 2),
            (r"\{1,3\}", "set", 2),
            ("x=1, x=3", "solutions", 2),
            ("1, 3, 5", "solutions", 3),
        ],
    )
    def test_kinds(self, latex: str, kind: str, size: int):
        form = classify_answer(latex)
        assert form.kind == kind
        assert len(form.elements) == size

    @pytest.mark.parametrize(
        "latex",
        ["[1,3]", "(1,3]", "(1,3", "1,3)", "f(1,3)", "(1,(2,3))", "x=1,y=3", "x=1, 3"],
    )
    def test_unsupported_forms_are_invalid(self, latex: str):
        assert classify_answer(latex).kind == "invalid"

    def test_composite_equivalent_rejects_scalar_and_invalid(self):
        assert composite_equivalent(classify_answer("3"), classify_answer("(1,3)")) is False
        assert composite_equivalent(classify_answer("[1,3]"), classify_answer("[1,3]")) is False

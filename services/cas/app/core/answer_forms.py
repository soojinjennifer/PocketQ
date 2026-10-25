"""최종 답의 쉼표 목록 형태(순서쌍·집합·여러 해) 판정 — `/verify-final-answer` 전용.

**배경(장부 §8.16, R3 실제 사례 2건)**: SymPy 1.14 lark LaTeX 파서는 괄호 안의 쉼표 목록을
받지 못한다(`(2,2)` → LarkError). 그래서 좌표 답 이어풀기가 항상 `verified=false`가 됐다.
`parse_to_sympy`와 `step_verify`는 건드리지 않고, 최종 답 비교에서만 쉼표 목록을 원소로 나눠
원소마다 기존 `parse_to_sympy`/`is_equivalent`로 판정한다.

처리 순서
1. 기존 `_strip_wrappers`로 감싼 표기(`$…$`, `\\(…\\)`, `\\[…\\]`, `\\text{…}`)를 벗긴다.
2. `\\left`·`\\right`·`\\ `·`\\,`를 정리한다.
3. 쉼표가 없으면 **원문 그대로** 기존 경로(`scalar`)로 보낸다 — 기존 동작 diff 0.
4. 천 단위 쉼표(`^-?[1-9]\\d{0,2}(,\\d{3})+$`)는 괄호 없는 최상위 단일 수일 때만 합쳐
   기존 경로로 보낸다. `0,001`처럼 첫 그룹이 0으로 시작하면 합치지 않는다(재작업 1).
5. `(x,y)=(…)`처럼 좌변이 서로 다른 Symbol의 튜플이면 우변만 비교하되 좌변을 기억한다.
   **양쪽 모두** 좌변이 있으면 좌변 Symbol 순서까지 같아야 참이다
   (`(x,y)=(1,3)` ≠ `(y,x)=(1,3)`, 재작업 1).
6. 점 이름(대문자 한 글자 + 선택적 아래첨자, 예: `M(1,3)`, `P_1(2,2)`)을 떼되 기억한다.
   **양쪽 모두** 이름이 있으면 이름이 같아야 참이다(`A(1,3)` ≠ `B(1,3)`, 재작업 1).
   `P_{1}`과 `P_1`은 같은 이름이다.
7. 괄호 깊이를 보고 최상위 쉼표로만 나눠 종류를 정한다.
   - `ordered`: `( … )` 하나로 감싸이고 원소 2개 이상 — 순서 중요
   - `set`: `\\{ … \\}` — 순서·중복 무관
   - `solutions`: 괄호 없는 목록, 모든 항이 같은 Symbol의 `x=값`이거나 모두 순수한 값.
     **양쪽 모두** `x=값` 목록이면 같은 Symbol일 때만 비교한다
     (`x=1,x=3` ≠ `y=1,y=3` — 단일 해 `x=3` ≠ `y=3`과 일관, 재작업 1).
   - 그 밖(`[1,3]`, `(1,3]`, `f(1,3)`, `x=1,y=3` 등)은 `invalid` → 항상 false
8. 원소 원문에 선행 0이 있는 수(`000`, `01`)는 파싱 실패로 본다 — `(1,000)`이 원소별로
   `(1,0)`과 같아지는 거짓 양성을 막는다(재작업 1).

지원하지 않음(미룸): `\\text{또는}` 구분자, 구간 표기, 연립 해(`x=2, y=2` ↔ `(2,2)`).
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Literal

import sympy

from app.core.equivalence import is_equivalent
from app.core.parser import _strip_wrappers, parse_to_sympy

logger = logging.getLogger(__name__)

AnswerKind = Literal["scalar", "ordered", "set", "solutions", "invalid"]

MAX_ELEMENTS = 10

_LEFT_RIGHT_RE = re.compile(r"\\(?:left|right)(?![A-Za-z])")
_SPACE_COMMAND_RE = re.compile(r"\\[ ,]")
_THOUSANDS_RE = re.compile(r"^-?[1-9]\d{0,2}(,\d{3})+$")
# 앞에 숫자·소수점이 없는 `0` 바로 뒤에 숫자가 오면 선행 0이다(`000`, `01`).
# `10`, `0.5`, `1.05`는 해당 없음.
_LEADING_ZERO_RE = re.compile(r"(?<![\d.])0\d")
_POINT_NAME_RE = re.compile(r"^[A-Z](?:_(?:\{[A-Za-z0-9]+\}|[A-Za-z0-9]))?\s*(?=\()")

_OPENERS = {"(": ")", "[": "]", "{": "}", "\\{": "\\}"}
_CLOSERS = frozenset(_OPENERS.values())


@dataclass(frozen=True)
class AnswerForm:
    """한쪽 답의 판정 결과.

    `scalar`이면 `latex`를 기존 경로(`parse_to_sympy` + `is_equivalent`)에 그대로 넘긴다.
    `ordered`/`set`/`solutions`이면 `elements`가 원소별 SymPy 값이다.
    `lhs`는 `(x,y)=…`의 좌변 Symbol 튜플, `point`는 점 이름(`M`, `P_1`),
    `symbol`은 `x=값` 목록의 Symbol이다(없으면 `None`). 양쪽에 모두 있을 때만 서로 같아야 한다.
    """

    kind: AnswerKind
    latex: str = ""
    elements: tuple[sympy.Expr, ...] = field(default_factory=tuple)
    lhs: tuple[sympy.Symbol, ...] | None = None
    point: str | None = None
    symbol: sympy.Symbol | None = None


_INVALID = AnswerForm(kind="invalid")


def _tokens(s: str) -> list[tuple[int, int, str]]:
    """괄호 판정용 토큰(시작, 끝, 토큰). `\\{`·`\\}`와 `\\명령`은 한 덩어리로 본다."""
    tokens: list[tuple[int, int, str]] = []
    i = 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            if s[i + 1] in "{}":
                end = i + 2
            elif s[i + 1].isalpha():
                end = i + 1
                while end < len(s) and s[end].isalpha():
                    end += 1
            else:
                end = i + 2
        else:
            end = i + 1
        tokens.append((i, end, s[i:end]))
        i = end
    return tokens


def _split_top_level(s: str, separator: str) -> list[str] | None:
    """괄호 깊이 0의 `separator`로만 나눈다. 괄호가 맞지 않으면 `None`."""
    stack: list[str] = []
    parts: list[str] = []
    part_start = 0
    for start, end, token in _tokens(s):
        if token in _OPENERS:
            stack.append(token)
        elif token in _CLOSERS:
            if not stack or _OPENERS[stack[-1]] != token:
                return None
            stack.pop()
        elif token == separator and not stack:
            parts.append(s[part_start:start])
            part_start = end
    if stack:
        return None
    parts.append(s[part_start:])
    return [part.strip() for part in parts]


def _outer_wrap(s: str) -> tuple[str, str] | None:
    """`s` 전체가 괄호 하나로 감싸여 있으면 (여는 괄호, 안쪽)을, 아니면 `None`을 돌려준다."""
    tokens = _tokens(s)
    if not tokens or tokens[0][2] not in _OPENERS:
        return None
    stack: list[str] = []
    for start, end, token in tokens:
        if token in _OPENERS:
            stack.append(token)
        elif token in _CLOSERS:
            if not stack or _OPENERS[stack[-1]] != token:
                return None
            stack.pop()
            if not stack:
                if end != len(s):
                    return None
                opener = tokens[0][2]
                return opener, s[tokens[0][1] : start]
    return None


def _normalize(latex: str) -> str:
    s = _strip_wrappers(latex)
    s = _LEFT_RIGHT_RE.sub("", s)
    s = _SPACE_COMMAND_RE.sub(" ", s)
    return s.strip()


_NO_LHS: tuple[sympy.Symbol, ...] | None = None


def _strip_symbol_tuple_lhs(s: str) -> tuple[str, tuple[sympy.Symbol, ...] | None] | None:
    """`(x,y)=(2,2)` → (`(2,2)`, (x, y)). 좌변 튜플이 없으면 (`s`, None).

    좌변이 튜플인데 서로 다른 Symbol이 아니면 `None`(invalid).
    """
    sides = _split_top_level(s, "=")
    if sides is None or len(sides) != 2:
        return s, _NO_LHS
    lhs, rhs = sides
    wrap = _outer_wrap(lhs)
    if wrap is None or wrap[0] != "(":
        return s, _NO_LHS
    names = _split_top_level(wrap[1], ",")
    if names is None or len(names) < 2:
        return s, _NO_LHS
    parsed = [parse_to_sympy(name) if name else None for name in names]
    symbols = [p for p in parsed if isinstance(p, sympy.Symbol)]
    if len(symbols) != len(parsed) or len(set(symbols)) != len(symbols):
        return None
    return rhs, tuple(symbols)


def _strip_point_name(s: str) -> tuple[str, str | None]:
    """`M(1,3)`·`P_1(2,2)` → (`(1,3)`, `M`)·(`(2,2)`, `P_1`).

    뒤가 괄호 하나로 끝나지 않으면 (`s`, None).

    이름은 `{}`·공백을 지워 정규화한다(`P_{1}` = `P_1`).
    """
    match = _POINT_NAME_RE.match(s)
    if match is None:
        return s, None
    rest = s[match.end() :]
    wrap = _outer_wrap(rest)
    if wrap is None or wrap[0] != "(":
        return s, None
    name = re.sub(r"[{}\s]", "", match.group(0))
    return rest, name


def _parse_value(item: str) -> sympy.Expr | None:
    """원소 하나를 순수한 값(`Expr`)으로 파싱한다. 실패하거나 `Eq` 등 관계식이면 `None`."""
    if not item or _LEADING_ZERO_RE.search(item):
        return None
    parsed = parse_to_sympy(item)
    if not isinstance(parsed, sympy.Expr):
        return None
    return parsed


def _parse_values(items: list[str]) -> tuple[sympy.Expr, ...] | None:
    values: list[sympy.Expr] = []
    for item in items:
        value = _parse_value(item)
        if value is None:
            return None
        values.append(value)
    return tuple(values)


def _parse_solutions(
    items: list[str],
) -> tuple[tuple[sympy.Expr, ...], sympy.Symbol | None] | None:
    """같은 Symbol의 `x=값`들이면 (값들, Symbol), 모두 순수한 값이면 (값들, None)."""
    if any(_LEADING_ZERO_RE.search(item) for item in items):
        return None
    parsed = [parse_to_sympy(item) if item else None for item in items]
    if all(isinstance(p, sympy.Eq) for p in parsed):
        equations = [p for p in parsed if isinstance(p, sympy.Eq)]
        symbol = equations[0].lhs
        if not isinstance(symbol, sympy.Symbol):
            return None
        values: list[sympy.Expr] = []
        for equation in equations:
            if equation.lhs != symbol or not isinstance(equation.rhs, sympy.Expr):
                return None
            values.append(equation.rhs)
        return tuple(values), symbol
    if all(isinstance(p, sympy.Expr) for p in parsed):
        return tuple(p for p in parsed if isinstance(p, sympy.Expr)), None
    return None


def classify_answer(latex: str) -> AnswerForm:
    """최종 답 문자열 하나의 형태를 판정한다(설명은 모듈 docstring)."""
    s = _normalize(latex)
    if "," not in s:
        return AnswerForm(kind="scalar", latex=latex)
    if _THOUSANDS_RE.match(s):
        return AnswerForm(kind="scalar", latex=s.replace(",", ""))

    stripped = _strip_symbol_tuple_lhs(s)
    if stripped is None:
        return _INVALID
    s, lhs = stripped
    s, point = _strip_point_name(s)

    kind: AnswerKind
    wrap = _outer_wrap(s)
    if wrap is not None:
        opener, inner = wrap
        if opener == "(":
            kind = "ordered"
        elif opener == "\\{":
            kind = "set"
        else:
            return _INVALID
        items = _split_top_level(inner, ",")
        if items is None or (kind == "ordered" and len(items) < 2):
            return _INVALID
    else:
        kind = "solutions"
        items = _split_top_level(s, ",")
        if items is None or len(items) < 2:
            return _INVALID

    if len(items) > MAX_ELEMENTS:
        return _INVALID

    if kind == "solutions":
        solutions = _parse_solutions(items)
        if solutions is None:
            return _INVALID
        elements, symbol = solutions
        return AnswerForm(kind=kind, elements=elements, symbol=symbol)

    values = _parse_values(items)
    if values is None:
        return _INVALID
    return AnswerForm(kind=kind, elements=values, lhs=lhs, point=point)


def _element_equivalent(a: sympy.Expr, b: sympy.Expr) -> bool:
    try:
        return bool(is_equivalent(a, b))
    except Exception as exc:  # noqa: BLE001 — 원소 판정 실패는 "같지 않음"으로 흡수한다.
        logger.warning("원소 동치 판정 실패(false로 처리): %s vs %s -> %s", a, b, exc)
        return False


def composite_equivalent(a: AnswerForm, b: AnswerForm) -> bool:
    """`ordered`/`set`/`solutions` 형태끼리 비교한다. 그 밖의 조합은 항상 false.

    - ordered ↔ ordered: 길이가 같고 원소마다 동치일 때만 참(순서 중요).
      양쪽 모두 좌변(`(x,y)=`)이 있으면 좌변 Symbol 순서가, 양쪽 모두 점 이름이 있으면 이름이
      같아야 한다.
    - set/solutions ↔ set/solutions: 양방향 동치 매칭(순서·중복 무관). 양쪽 모두 `x=값` 목록이면
      같은 Symbol이어야 한다.
    """
    composite_kinds = ("ordered", "set", "solutions")
    if a.kind not in composite_kinds or b.kind not in composite_kinds:
        return False
    if a.lhs is not None and b.lhs is not None and a.lhs != b.lhs:
        return False
    if a.point is not None and b.point is not None and a.point != b.point:
        return False
    if a.symbol is not None and b.symbol is not None and a.symbol != b.symbol:
        return False

    if a.kind == "ordered" or b.kind == "ordered":
        if a.kind != b.kind or len(a.elements) != len(b.elements):
            return False
        return all(_element_equivalent(x, y) for x, y in zip(a.elements, b.elements, strict=True))

    a_covered = all(any(_element_equivalent(x, y) for y in b.elements) for x in a.elements)
    b_covered = all(any(_element_equivalent(y, x) for x in a.elements) for y in b.elements)
    return a_covered and b_covered

"""LaTeX -> SymPy 파싱.

`sympy.parsing.latex.parse_latex`는 두 백엔드(antlr/lark)를 지원하며 기본값은 antlr다.
antlr 백엔드는 별도 grammar 컴파일과 `antlr4-python3-runtime` 설치가 필요하지만, lark
백엔드는 순수 파이썬(`lark` 패키지)만으로 동작해 별도 grammar 컴파일이 필요 없다 — 이 서비스는
항상 `backend="lark"`를 명시적으로 지정한다.

등식(`=` 포함) 문자열 처리: 실제로 `parse_latex(s, backend="lark")`에 `y=x^2-4x+3` 같은
문자열을 그대로 넘겨 테스트해본 결과, 별도 전처리 없이 `sympy.Eq(y, x**2 - 4*x + 3)`를
직접 반환한다(실측 확인 완료, 2026-09) — `=` 기준으로 좌우변을 나눠 각각 파싱한 뒤
`sympy.Eq()`로 재구성하는 방식은 필요하지 않았다.
"""

import logging
import re

import sympy
from lark.exceptions import LarkError
from sympy.parsing.latex import parse_latex

logger = logging.getLogger(__name__)

# 자연어 주석(예: 학생이 결론 줄에 "최솟값은 -1이다"처럼 쓰는 경우)을 감싸는
# `\text{...}` 블록. 수식이 아니므로 파싱 전 제거한다(2026-09 stage-qa-agent 회귀 발견 —
# `\text{최솟값은 } -1` 같은 줄이 그대로면 파싱 실패로 항상 "판정 불가"가 됐다).
_TEXT_BLOCK_RE = re.compile(r"\\text\{[^}]*\}")


def _strip_wrappers(latex_str: str) -> str:
    """수식 구분자(`$...$`/`\\(...\\)`/`\\[...\\]`)와 `\\text{...}` 주석 블록을 제거한다.

    LLM/KaTeX가 관용적으로 붙이는 델리미터이지만 `parse_latex`는 이를 이해하지 못해
    그대로 두면 파싱이 실패한다(2026-09 stage-qa-agent 회귀 발견). 실제 수식 내용은
    그대로 두고 감싸는 표기만 벗겨낸다 — 과도한 정규화(임의 치환 등)는 하지 않는다.
    """
    s = _TEXT_BLOCK_RE.sub(" ", latex_str).strip()

    if s.startswith("$$") and s.endswith("$$") and len(s) >= 4:
        s = s[2:-2]
    elif s.startswith("$") and s.endswith("$") and len(s) >= 2:
        s = s[1:-1]
    s = s.strip()

    if s.startswith("\\(") and s.endswith("\\)"):
        s = s[2:-2]
    elif s.startswith("\\[") and s.endswith("\\]"):
        s = s[2:-2]

    return s.strip()


def parse_to_sympy(latex_str: str) -> sympy.Basic | None:
    """LaTeX 문자열을 SymPy 객체(`Eq` 또는 일반 수식/값)로 파싱한다.

    파싱에 실패하면(문법 오류, 빈 문자열, 지원하지 않는 LaTeX 구문 등) 예외를 전파하지 않고
    `None`을 반환한다 — 호출부(`routers/*.py`)가 "판정 불가" 상태를 명시적으로 구분해
    보수적으로 처리할 수 있게 한다. 실패 원인은 로그로만 남긴다.
    """
    stripped = _strip_wrappers(latex_str)
    if not stripped:
        logger.warning("빈 LaTeX 문자열은 파싱할 수 없습니다.")
        return None

    try:
        return parse_latex(stripped, backend="lark")
    except LarkError as exc:
        logger.warning("LaTeX 파싱 실패(lark 문법 오류): %r -> %s", latex_str, exc)
        return None
    except Exception as exc:  # noqa: BLE001 — 파싱 실패는 항상 "판정 불가"로 흡수해야 한다.
        logger.warning("LaTeX 파싱 중 예상치 못한 오류: %r -> %s", latex_str, exc)
        return None

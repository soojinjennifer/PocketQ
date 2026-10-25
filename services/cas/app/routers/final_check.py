"""RESUME-5 대응 — 이어풀기 최종 답이 원 문제의 정답과 일치하는지 검증."""

import logging

from fastapi import APIRouter

from app.core.answer_forms import classify_answer, composite_equivalent
from app.core.equivalence import is_equivalent
from app.core.parser import parse_to_sympy
from app.core.schemas import VerifyFinalAnswerRequest, VerifyFinalAnswerResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _verify_scalar(problem_latex: str, solution_latex: str) -> bool:
    """쉼표 목록이 아닌 답(기존 경로) — 두 답을 각각 파싱해 대수적으로 동치인지 판정한다.

    **파싱 실패 처리(오너 결정)**: 응답 스키마(`{ verified: boolean }`)를 확장하지 않으므로,
    둘 중 하나라도 파싱에 실패해 "판정 불가" 상태가 되면 별도로 표현하지 않고 보수적으로
    `verified: false`로 응답한다(로그만 남긴다).
    """
    problem_answer = parse_to_sympy(problem_latex)
    solution_answer = parse_to_sympy(solution_latex)

    if problem_answer is None or solution_answer is None:
        logger.warning(
            "최종 답 검증 판정 불가(파싱 실패) — verified: false로 보수 처리: "
            "problemAnswerLatex=%r, solutionAnswerLatex=%r",
            problem_latex,
            solution_latex,
        )
        return False

    return is_equivalent(problem_answer, solution_answer)


@router.post("/verify-final-answer", response_model=VerifyFinalAnswerResponse)
def verify_final_answer(request: VerifyFinalAnswerRequest) -> VerifyFinalAnswerResponse:
    """`problemAnswerLatex`(원 문제 정답)와 `solutionAnswerLatex`(이어풀기 최종 답)가 같은 답인지
    판정한다.

    - 둘 다 쉼표 목록이 아니면 기존 경로(`_verify_scalar`)를 그대로 쓴다.
    - 하나라도 순서쌍·집합·여러 해 목록이면 `answer_forms`로 원소별 판정한다(종류가 다르면 false).
    - **예외 안전장치**: 어떤 예외가 나도 500 대신 200과 `verified: false`로 응답한다
      (예: `x<3` vs `3`처럼 `is_equivalent`가 비스칼라 값을 받아 TypeError가 나는 경우).
    """
    try:
        problem_form = classify_answer(request.problemAnswerLatex)
        solution_form = classify_answer(request.solutionAnswerLatex)
        if problem_form.kind == "scalar" and solution_form.kind == "scalar":
            verified = _verify_scalar(problem_form.latex, solution_form.latex)
        else:
            verified = composite_equivalent(problem_form, solution_form)
    except Exception as exc:  # noqa: BLE001 — 판정 중 예외는 항상 보수적 false로 흡수한다.
        logger.warning(
            "최종 답 검증 중 예외 — verified: false로 보수 처리: "
            "problemAnswerLatex=%r, solutionAnswerLatex=%r -> %s: %s",
            request.problemAnswerLatex,
            request.solutionAnswerLatex,
            type(exc).__name__,
            exc,
        )
        return VerifyFinalAnswerResponse(verified=False)

    return VerifyFinalAnswerResponse(verified=bool(verified))

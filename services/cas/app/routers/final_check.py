"""RESUME-5 대응 — 이어풀기 최종 답이 원 문제의 정답과 일치하는지 검증."""

import logging

from fastapi import APIRouter

from app.core.equivalence import is_equivalent
from app.core.parser import parse_to_sympy
from app.core.schemas import VerifyFinalAnswerRequest, VerifyFinalAnswerResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/verify-final-answer", response_model=VerifyFinalAnswerResponse)
def verify_final_answer(request: VerifyFinalAnswerRequest) -> VerifyFinalAnswerResponse:
    """`problemAnswerLatex`(원 문제 정답)와 `solutionAnswerLatex`(이어풀기 최종 답)를 각각
    파싱해 대수적으로 동치인지 판정한다.

    **파싱 실패 처리(오너 결정)**: 응답 스키마(`{ verified: boolean }`)를 확장하지 않으므로,
    둘 중 하나라도 파싱에 실패해 "판정 불가" 상태가 되면 별도로 표현하지 않고 보수적으로
    `verified: false`로 응답한다(로그만 남긴다).
    """
    problem_answer = parse_to_sympy(request.problemAnswerLatex)
    solution_answer = parse_to_sympy(request.solutionAnswerLatex)

    if problem_answer is None or solution_answer is None:
        logger.warning(
            "최종 답 검증 판정 불가(파싱 실패) — verified: false로 보수 처리: "
            "problemAnswerLatex=%r, solutionAnswerLatex=%r",
            request.problemAnswerLatex,
            request.solutionAnswerLatex,
        )
        return VerifyFinalAnswerResponse(verified=False)

    verified = is_equivalent(problem_answer, solution_answer)
    return VerifyFinalAnswerResponse(verified=verified)

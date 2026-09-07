"""DIAG-1 대응 — 학생 풀이 각 줄의 수학적 타당성 검증."""

import logging

from fastapi import APIRouter

from app.core.equivalence import is_equivalent
from app.core.parser import parse_to_sympy
from app.core.schemas import (
    CasStepVerification,
    VerifyWorkLinesRequest,
    VerifyWorkLinesResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/verify-work-lines", response_model=VerifyWorkLinesResponse)
def verify_work_lines(request: VerifyWorkLinesRequest) -> VerifyWorkLinesResponse:
    """학생 풀이를 줄 번호 순서대로 비교해 각 줄이 직전 줄과 대수적으로 동치인지 판정한다.

    n번째 줄의 `isValid`는 "(n-1)번째 줄과 대수적으로 동치인가"를 뜻한다. 첫 줄은 비교 대상이
    없으므로 파싱 성공 여부와 무관하게 항상 `isValid: true`다.

    **파싱 실패/판정 불가 처리(오너 결정)**: `CasStepVerification`(Node `shared-types`) 타입을
    `{ lineNo, isValid }`에서 확장하지 않기로 했으므로, 파싱에 실패해 "판정 불가" 상태가 돼도
    별도 필드로 표현할 수 없다. 이 경우 이 서비스는 로그를 남기고 Node 쪽에는 보수적으로
    `isValid: false`로 응답한다 — 즉 Node/LLM 레이어는 CAS가 실제로 "틀렸다"고 판정한 줄과
    "판정할 수 없었던" 줄을 구분하지 못한 채 둘 다 "부적합"으로 취급하게 된다.
    """
    lines = sorted(request.lines, key=lambda line: line.lineNo)
    results: list[CasStepVerification] = []
    previous_parsed = None

    for index, line in enumerate(lines):
        parsed = parse_to_sympy(line.latex)

        if index == 0:
            # 첫 줄은 비교 대상이 없으니 항상 유효로 간주한다(지시사항 그대로).
            results.append(CasStepVerification(lineNo=line.lineNo, isValid=True))
            previous_parsed = parsed
            continue

        if parsed is None or previous_parsed is None:
            logger.warning(
                "줄 %d 판정 불가(이번 줄 또는 직전 줄 파싱 실패) — isValid: false로 보수 처리",
                line.lineNo,
            )
            results.append(CasStepVerification(lineNo=line.lineNo, isValid=False))
            previous_parsed = parsed
            continue

        valid = is_equivalent(previous_parsed, parsed)
        results.append(CasStepVerification(lineNo=line.lineNo, isValid=valid))
        previous_parsed = parsed

    return VerifyWorkLinesResponse(results=results)

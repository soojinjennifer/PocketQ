"""요청/응답 Pydantic 모델.

`shared-types`(Node/TS)의 `WorkLine`/`CasStepVerification` 형태와 최대한 필드명을 맞춰
Node 쪽(`casClient.ts`)이 그대로 매핑할 수 있게 한다. `CasStepVerification`은 오너 결정에
따라 `{ lineNo, isValid }`에서 확장하지 않는다(예: 파싱 불가 상태를 별도 필드로 표현하지 않음).
"""

from pydantic import BaseModel


class WorkLineIn(BaseModel):
    lineNo: int
    latex: str


class VerifyWorkLinesRequest(BaseModel):
    lines: list[WorkLineIn]


class CasStepVerification(BaseModel):
    lineNo: int
    isValid: bool


class VerifyWorkLinesResponse(BaseModel):
    results: list[CasStepVerification]


class VerifyFinalAnswerRequest(BaseModel):
    problemAnswerLatex: str
    solutionAnswerLatex: str


class VerifyFinalAnswerResponse(BaseModel):
    verified: bool


class HealthResponse(BaseModel):
    status: str

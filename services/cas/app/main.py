"""FastAPI 앱 진입점 — 라우터 등록과 `/health`만 담당한다."""

from fastapi import FastAPI

from app.routers import final_check, step_verify

app = FastAPI(
    title="PocketQ CAS Service",
    description=(
        "PocketQ DIAG-1/RESUME-5용 CAS(Computer Algebra System) 검증 서비스. "
        "Phase 1: 등식 변형 동치성 검사만 지원한다 — 부등식 방향 반전/미적분/수열 검증은 "
        "Phase 2로 연기됐다."
    ),
    version="0.1.0",
)

app.include_router(step_verify.router)
app.include_router(final_check.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

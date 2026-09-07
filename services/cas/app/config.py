"""서비스 전역 설정. 로컬 개발용 최소 설정만 담는다 — 프로덕션 배포 설정은 이 범위 밖이다."""

import os


class Settings:
    """`PORT` 환경변수(있으면)로 기본 포트를 오버라이드한다. 실제 기동은 `uvicorn` CLI의
    `--port` 옵션으로 지정하며(README 참고), 이 값은 문서/스크립트 기본값 용도로만 쓰인다."""

    port: int = int(os.environ.get("PORT", "8000"))


settings = Settings()

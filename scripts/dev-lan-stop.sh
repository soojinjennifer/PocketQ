#!/usr/bin/env bash
# dev-lan.sh로 띄운 포켓큐 API/Web 개발 서버를 종료한다.

pkill -f -- "--env-file=.env src/server.ts" 2>/dev/null && echo "API 서버 종료" || echo "실행 중인 API 서버 없음"
pkill -f "vite/bin/vite.js -- --host" 2>/dev/null && echo "Web 서버 종료" || echo "실행 중인 Web 서버 없음"

# 패턴 매칭으로 못 잡은 잔여 프로세스가 있으면 포트 기준으로 한 번 더 정리한다.
for PORT in 4000 5173; do
  PIDS="$(lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$PIDS" ]; then
    kill $PIDS 2>/dev/null || true
    echo "포트 $PORT 남은 프로세스 종료: $PIDS"
  fi
done

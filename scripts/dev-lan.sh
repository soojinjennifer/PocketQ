#!/usr/bin/env bash
# WhyMath 개발 서버를 현재 LAN IP에 맞춰 기동한다.
#
# iPad 등 다른 기기에서 접속하려면 mkcert 인증서와 .env의 CORS/API 주소가
# 이 컴퓨터의 현재 LAN IP와 일치해야 하는데, Wi-Fi 재연결/재부팅으로 IP가
# 자주 바뀐다. 이 스크립트는 매번:
#   1) 현재 LAN IP를 감지하고
#   2) apps/web, apps/api의 mkcert 인증서를 그 IP로 재발급하고
#   3) apps/web/.env, apps/api/.env의 IP 관련 값을 갱신하고
#   4) 기존에 떠 있던 dev 서버를 정리한 뒤
#   5) API(4000)/Web(5173) 서버를 백그라운드로 다시 띄운다.
#
# 사용법: ./scripts/dev-lan.sh
# 중지:   ./scripts/dev-lan-stop.sh
# 로그:   tail -f .dev-logs/api.log .dev-logs/web.log

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

echo "1) LAN IP 감지 중..."
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$LAN_IP" ]; then
  LAN_IP="$(ifconfig | awk '/inet /{print $2}' | grep -v '^127\.' | head -n1)"
fi
if [ -z "$LAN_IP" ]; then
  echo "   LAN IP를 찾지 못했습니다. Wi-Fi 연결을 확인해주세요." >&2
  exit 1
fi
echo "   -> $LAN_IP"

echo "2) mkcert 인증서 재발급 중..."
if ! command -v mkcert >/dev/null 2>&1; then
  echo "   mkcert가 설치돼 있지 않습니다. 'brew install mkcert'로 설치해주세요." >&2
  exit 1
fi
mkcert -cert-file apps/web/.cert/cert.pem -key-file apps/web/.cert/key.pem localhost 127.0.0.1 "$LAN_IP" >/dev/null
mkcert -cert-file apps/api/.cert/cert.pem -key-file apps/api/.cert/key.pem localhost 127.0.0.1 "$LAN_IP" >/dev/null
echo "   -> 완료"

echo "3) .env 갱신 중..."
sed -i '' -E "s#^VITE_API_BASE_URL=.*#VITE_API_BASE_URL=https://${LAN_IP}:4000#" apps/web/.env
sed -i '' -E "s#^CORS_ORIGIN=.*#CORS_ORIGIN=http://localhost:5173,https://localhost:5173,https://${LAN_IP}:5173#" apps/api/.env
echo "   -> 완료"

echo "4) 기존 dev 서버 정리 중..."
pkill -f -- "--env-file=.env src/server.ts" 2>/dev/null && echo "   -> 기존 API 서버 종료" || echo "   -> 실행 중인 API 서버 없음"
pkill -f "vite/bin/vite.js -- --host" 2>/dev/null && echo "   -> 기존 Web 서버 종료" || echo "   -> 실행 중인 Web 서버 없음"
sleep 1
# 패턴 매칭으로 못 잡은 잔여 프로세스가 있으면 포트 기준으로 한 번 더 정리한다(안전망).
for PORT in 4000 5173; do
  PIDS="$(lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$PIDS" ]; then
    kill $PIDS 2>/dev/null || true
  fi
done
sleep 1

echo "5) 서버 기동 중..."
(cd apps/api && nohup pnpm dev > "$LOG_DIR/api.log" 2>&1 &)
(cd apps/web && nohup pnpm dev -- --host > "$LOG_DIR/web.log" 2>&1 &)

sleep 4

echo ""
echo "=================================================="
if curl -sk -o /dev/null -w "%{http_code}" "https://${LAN_IP}:4000/health" 2>/dev/null | grep -q 200; then
  echo "API  : https://${LAN_IP}:4000   OK"
else
  echo "API  : https://${LAN_IP}:4000   확인 필요 (.dev-logs/api.log 참고)"
fi
if curl -sk -o /dev/null -w "%{http_code}" "https://${LAN_IP}:5173" 2>/dev/null | grep -q 200; then
  echo "Web  : https://${LAN_IP}:5173   OK"
else
  echo "Web  : https://${LAN_IP}:5173   확인 필요 (.dev-logs/web.log 참고)"
fi
echo ""
echo "iPad 접속 주소: https://${LAN_IP}:5173/"
echo "로그 보기: tail -f .dev-logs/api.log .dev-logs/web.log"
echo "중지: ./scripts/dev-lan-stop.sh"
echo "=================================================="

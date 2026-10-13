#!/usr/bin/env bash
# 배포 서버에서 실행한다. GitHub Actions가 올려 준 이미지 파일을 불러와 사각을 무중단으로 바꿔 끼운다.
#
# 블루-그린 배포: 8390 포트는 nginx(myblog-proxy)가 받고, 뒤에서 myblog-blue / myblog-green 중 하나가 손님을 받는다.
#   1. 쉬고 있는 색으로 새 서버를 띄운다 (옛 서버는 계속 손님을 받는다)
#   2. 새 서버가 정상으로 응답할 때까지 기다린다. 안 뜨면 새 서버만 지우고 끝낸다 (사이트는 그대로)
#   3. nginx가 새 서버로 보내도록 바꾸고 다시 읽는다 (끊김 없음)
#   4. 옛 서버는 하던 요청을 끝내고 내려간다 (graceful shutdown)
# 로그인 세션은 Redis에 있어서 서버가 바뀌어도 로그인이 유지된다.
# 주의: 새 서버가 뜰 때 DB 구조(Flyway)가 바뀌는데 옛 서버도 잠깐 같은 DB를 쓴다. 컬럼을 지우거나 이름을 바꾸는 변경은 두 번에 나눠 배포한다.
#   사용: DB_ADDRESS=... DB_PORT=... DB_NAME=... DB_SCHEMA=... DB_USERNAME=... DB_PASSWORD=... \
#         [NOTICE_OWNER_EMAIL=...] [SMTP_HOST=... SMTP_PORT=... SMTP_USERNAME=... SMTP_PASSWORD=... MAIL_FROM=...] \
#         [SITE_URL=...] [KAKAO_CLIENT_ID=... KAKAO_CLIENT_SECRET=...] [GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...] \
#         ./deploy.sh <이미지 파일(.tar.gz)> <이미지 태그>
set -euo pipefail

IMAGE_FILE="${1:?이미지 파일 경로를 주세요}"
TAG="${2:-latest}"
IMAGE="myblog:${TAG}"
APP=myblog          # 컨테이너 이름은 myblog-blue / myblog-green
LEGACY_APP=myblog   # 블루-그린 전에 쓰던 컨테이너 이름 (8390을 직접 잡고 있었다)
PROXY=myblog-proxy
PROXY_IMAGE=nginx:1.27-alpine
REDIS=myblog-redis
NETWORK=myblog-net
PORT=8390
DATA_DIR="${MYBLOG_DATA_DIR:-$HOME/myblog-data}"

: "${DB_ADDRESS:?DB_ADDRESS가 없어요}" "${DB_PORT:?DB_PORT가 없어요}" "${DB_NAME:?DB_NAME이 없어요}"
: "${DB_USERNAME:?DB_USERNAME이 없어요}" "${DB_PASSWORD:?DB_PASSWORD가 없어요}"
DB_SCHEMA="${DB_SCHEMA:-public}"

# docker 권한이 없으면 sudo로 (비밀번호 없이 sudo가 되는 경우만)
DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if sudo -n docker info >/dev/null 2>&1; then
    DOCKER=(sudo -n docker)
  else
    echo "docker를 실행할 수 없어요. 이 계정을 docker 그룹에 넣어 주세요: sudo usermod -aG docker \$USER" >&2
    exit 1
  fi
fi

echo "==> 이미지 불러오기: ${IMAGE_FILE}"
"${DOCKER[@]}" load -i "${IMAGE_FILE}"

"${DOCKER[@]}" network inspect "${NETWORK}" >/dev/null 2>&1 || "${DOCKER[@]}" network create "${NETWORK}"

echo "==> Redis 확인"
if "${DOCKER[@]}" ps -a --format '{{.Names}}' | grep -qx "${REDIS}"; then
  "${DOCKER[@]}" start "${REDIS}" >/dev/null
else
  "${DOCKER[@]}" run -d --name "${REDIS}" --network "${NETWORK}" --restart unless-stopped redis:7
fi

# DB가 같은 서버에 있으면(localhost) 컨테이너 안에서는 host.docker.internal 로 접속한다
DB_HOST="${DB_ADDRESS}"
EXTRA_ARGS=()
if [[ "${DB_HOST}" == "localhost" || "${DB_HOST}" == "127.0.0.1" ]]; then
  DB_HOST=host.docker.internal
  EXTRA_ARGS+=(--add-host=host.docker.internal:host-gateway)
fi

mkdir -p "${DATA_DIR}/images"
PROXY_CONF_DIR="${DATA_DIR}/proxy/conf.d"
PROXY_CONF="${PROXY_CONF_DIR}/default.conf"
mkdir -p "${PROXY_CONF_DIR}"
ENV_FILE="${DATA_DIR}/app.env"
(
  umask 077
  cat > "${ENV_FILE}" <<ENV
DB_URL=jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}?currentSchema=${DB_SCHEMA},public
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
SPRING_FLYWAY_SCHEMAS=${DB_SCHEMA}
REDIS_HOST=${REDIS}
REDIS_PORT=6379
SESSION_SECURE_COOKIE=true
SITE_URL=${SITE_URL:-https://sagak.java21.net}
ENV
  # 공지사항을 쓰는 회원 이메일 (선택). 값이 있을 때만 넣는다
  if [[ -n "${NOTICE_OWNER_EMAIL:-}" ]]; then
    echo "NOTICE_OWNER_EMAIL=${NOTICE_OWNER_EMAIL}" >> "${ENV_FILE}"
  fi
  # 메일 서버 (선택). SMTP_HOST가 있을 때만 실제 메일을 보낸다. 없으면 로그 모드
  if [[ -n "${SMTP_HOST:-}" ]]; then
    {
      echo "MYBLOG_MAIL_MODE=smtp"
      echo "SMTP_HOST=${SMTP_HOST}"
      echo "SMTP_PORT=${SMTP_PORT:-587}"
      echo "SMTP_USERNAME=${SMTP_USERNAME:-}"
      echo "SMTP_PASSWORD=${SMTP_PASSWORD:-}"
      if [[ -n "${MAIL_FROM:-}" ]]; then echo "MAIL_FROM=${MAIL_FROM}"; fi
    } >> "${ENV_FILE}"
  fi
  # 소셜 로그인 (선택). 키가 있는 제공자만 켜진다. 제공자가 돌려보낼 주소는 SITE_URL/login/oauth2/code/{kakao|google}
  if [[ -n "${KAKAO_CLIENT_ID:-}" ]]; then
    {
      echo "KAKAO_CLIENT_ID=${KAKAO_CLIENT_ID}"
      echo "KAKAO_CLIENT_SECRET=${KAKAO_CLIENT_SECRET:-}"
    } >> "${ENV_FILE}"
  fi
  if [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then
    {
      echo "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
      echo "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}"
    } >> "${ENV_FILE}"
  fi
)

# 지금 손님을 받는 색은 nginx 설정에 적힌 서버 이름으로 안다 (처음이면 없음)
ACTIVE=""
if [[ -f "${PROXY_CONF}" ]]; then
  ACTIVE="$(grep -o "${APP}-\(blue\|green\)" "${PROXY_CONF}" | head -1 || true)"
fi
if [[ "${ACTIVE}" == "${APP}-blue" ]]; then NEXT="${APP}-green"; else NEXT="${APP}-blue"; fi

echo "==> 새 서버 띄우기: ${NEXT} (${IMAGE}), 지금 서버: ${ACTIVE:-없음}"
"${DOCKER[@]}" rm -f "${NEXT}" >/dev/null 2>&1 || true
"${DOCKER[@]}" run -d --name "${NEXT}" --network "${NETWORK}" --restart unless-stopped \
  --env-file "${ENV_FILE}" -v "${DATA_DIR}/images:/data/images" \
  ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} "${IMAGE}" >/dev/null

# 새 서버는 바깥 포트가 없어서, 같은 네트워크에 잠깐 띄운 nginx 이미지의 wget으로 확인한다
healthy() {
  "${DOCKER[@]}" run --rm --network "${NETWORK}" "${PROXY_IMAGE}" \
    wget -q -O /dev/null -T 3 "http://${NEXT}:8390/api/topics" >/dev/null 2>&1
}

echo "==> 새 서버가 뜰 때까지 기다리기"
ok=false
for _ in $(seq 1 60); do
  if healthy; then ok=true; break; fi
  if [[ "$("${DOCKER[@]}" inspect -f '{{.State.Running}}' "${NEXT}" 2>/dev/null)" != "true" ]]; then
    break
  fi
  sleep 3
done
if [[ "${ok}" != true ]]; then
  echo "새 서버가 정상으로 뜨지 않았어요. 사이트는 옛 서버(${ACTIVE:-없음})로 그대로 둡니다. 최근 로그:" >&2
  "${DOCKER[@]}" logs --tail 80 "${NEXT}" >&2 || true
  "${DOCKER[@]}" rm -f "${NEXT}" >/dev/null 2>&1 || true
  exit 1
fi

echo "==> 손님을 ${NEXT}로 넘기기"
[[ -f "${PROXY_CONF}" ]] && cp "${PROXY_CONF}" "${PROXY_CONF}.bak"
cat > "${PROXY_CONF}" <<NGINX
# deploy.sh가 배포 때마다 다시 쓴다. 지금 손님을 받는 서버: ${NEXT}
server {
    listen ${PORT};
    client_max_body_size 8m;   # 사진 올리기 (서버 한도 7MB보다 조금 크게)

    location / {
        proxy_pass http://${NEXT}:8390;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
NGINX

if [[ "$("${DOCKER[@]}" inspect -f '{{.State.Running}}' "${PROXY}" 2>/dev/null)" == "true" ]]; then
  if ! "${DOCKER[@]}" exec "${PROXY}" nginx -t >/dev/null 2>&1; then
    echo "nginx 설정이 잘못됐어요. 옛 설정으로 되돌리고 새 서버를 지웁니다." >&2
    [[ -f "${PROXY_CONF}.bak" ]] && mv "${PROXY_CONF}.bak" "${PROXY_CONF}"
    "${DOCKER[@]}" rm -f "${NEXT}" >/dev/null 2>&1 || true
    exit 1
  fi
  "${DOCKER[@]}" exec "${PROXY}" nginx -s reload
else
  # 처음 한 번만: 예전 방식 컨테이너가 8390을 잡고 있으면 비키고 nginx를 띄운다 (이때만 1~2초 끊긴다)
  echo "==> 처음이라 nginx(${PROXY})를 8390에 띄웁니다"
  "${DOCKER[@]}" rm -f "${LEGACY_APP}" >/dev/null 2>&1 || true
  "${DOCKER[@]}" rm -f "${PROXY}" >/dev/null 2>&1 || true
  "${DOCKER[@]}" run -d --name "${PROXY}" --network "${NETWORK}" --restart unless-stopped \
    -p "${PORT}:${PORT}" -v "${PROXY_CONF_DIR}:/etc/nginx/conf.d:ro" "${PROXY_IMAGE}" >/dev/null
fi
rm -f "${PROXY_CONF}.bak"

if [[ -n "${ACTIVE}" && "${ACTIVE}" != "${NEXT}" ]]; then
  echo "==> 옛 서버 내리기: ${ACTIVE} (하던 요청은 끝내고)"
  sleep 2
  "${DOCKER[@]}" stop -t 35 "${ACTIVE}" >/dev/null 2>&1 || true
  "${DOCKER[@]}" rm -f "${ACTIVE}" >/dev/null 2>&1 || true
fi

"${DOCKER[@]}" image prune -f >/dev/null || true
echo "배포 완료: ${NEXT}가 http://<서버 주소>:${PORT} 에서 손님을 받습니다"

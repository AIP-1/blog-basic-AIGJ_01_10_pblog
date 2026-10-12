#!/usr/bin/env bash
# 배포 서버에서 실행한다. GitHub Actions가 올려 준 이미지 파일을 불러와 사각을 8390 포트로 다시 띄운다.
#   사용: DB_ADDRESS=... DB_PORT=... DB_NAME=... DB_SCHEMA=... DB_USERNAME=... DB_PASSWORD=... \
#         ./deploy.sh <이미지 파일(.tar.gz)> <이미지 태그>
set -euo pipefail

IMAGE_FILE="${1:?이미지 파일 경로를 주세요}"
TAG="${2:-latest}"
IMAGE="myblog:${TAG}"
APP=myblog
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
ENV
)

echo "==> 앱 다시 띄우기: ${IMAGE} (포트 ${PORT})"
"${DOCKER[@]}" rm -f "${APP}" >/dev/null 2>&1 || true
"${DOCKER[@]}" run -d --name "${APP}" --network "${NETWORK}" --restart unless-stopped \
  -p "${PORT}:8390" --env-file "${ENV_FILE}" -v "${DATA_DIR}/images:/data/images" \
  ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} "${IMAGE}"

healthy() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "http://localhost:${PORT}/api/topics" >/dev/null 2>&1
  else
    "${DOCKER[@]}" logs "${APP}" 2>&1 | grep -q "Started MyBlogApplication"
  fi
}

echo "==> 뜰 때까지 기다리기"
for _ in $(seq 1 60); do
  if healthy; then
    echo "배포 완료: http://<서버 주소>:${PORT}"
    "${DOCKER[@]}" image prune -f >/dev/null || true
    exit 0
  fi
  if [[ "$("${DOCKER[@]}" inspect -f '{{.State.Running}}' "${APP}" 2>/dev/null)" != "true" ]]; then
    break
  fi
  sleep 3
done

echo "앱이 정상으로 뜨지 않았어요. 최근 로그:" >&2
"${DOCKER[@]}" logs --tail 80 "${APP}" >&2 || true
exit 1

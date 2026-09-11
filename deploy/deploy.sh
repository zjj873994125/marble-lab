#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?请配置 DEPLOY_HOST}"
: "${DEPLOY_USER:?请配置 DEPLOY_USER}"
: "${DEPLOY_PATH:?请配置 DEPLOY_PATH}"
: "${DEPLOY_SSH_KEY:?请配置 DEPLOY_SSH_KEY}"
: "${DEPLOY_KNOWN_HOSTS:?请配置 DEPLOY_KNOWN_HOSTS}"
: "${MARBLE_IMAGE:?缺少本次提交的镜像标签}"
DEPLOY_PORT=${DEPLOY_PORT:-22}

# SSH 的远端命令还会经过 shell；只接受简单的主机、账号和绝对路径。
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || exit 1
[[ "$DEPLOY_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]] || exit 1
[[ "$DEPLOY_PORT" =~ ^[0-9]+$ ]] || exit 1
[[ "$DEPLOY_PATH" =~ ^/[a-zA-Z0-9_./-]+$ && "$DEPLOY_PATH" != / ]] || exit 1
[[ "$MARBLE_IMAGE" =~ ^ghcr.io/zjj873994125/marble-lab:sha-[0-9a-f]{40}$ ]] || exit 1

umask 077
ssh_dir=$(mktemp -d)
trap 'rm -f "$ssh_dir/key" "$ssh_dir/known_hosts"; rmdir "$ssh_dir"' EXIT
printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
ssh_options=(-i "$ssh_dir/key" -o BatchMode=yes -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$ssh_dir/known_hosts"
  -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=3)
target="$DEPLOY_USER@$DEPLOY_HOST"
candidate=".compose-${MARBLE_IMAGE##*:}.yaml"

ssh "${ssh_options[@]}" -p "$DEPLOY_PORT" "$target" "mkdir -p -- '$DEPLOY_PATH'"
scp "${ssh_options[@]}" -P "$DEPLOY_PORT" compose.yaml "$target:$DEPLOY_PATH/$candidate"
ssh "${ssh_options[@]}" -p "$DEPLOY_PORT" "$target" \
  "bash -s -- '$DEPLOY_PATH' '$MARBLE_IMAGE' '$candidate'" <<'REMOTE'
set -euo pipefail
cd "$1"
export MARBLE_IMAGE="$2"
candidate="$3"

# 只更新本项目；拉取失败不会停止当前容器，健康失败会使 Actions 失败。
docker compose -p marble-lab -f "$candidate" pull marble-lab
docker compose -p marble-lab -f "$candidate" up -d --wait --wait-timeout 120 marble-lab
mv -f -- "$candidate" compose.yaml
printf 'MARBLE_IMAGE=%s\n' "$MARBLE_IMAGE" > release.env
docker compose -p marble-lab -f compose.yaml ps
REMOTE

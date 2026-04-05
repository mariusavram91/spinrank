#!/usr/bin/env bash

set -euo pipefail

PROJECT_NAME="${SPINRANK_E2E_PROJECT:-spinrank-e2e}"
COMPOSE_ARGS=(-p "$PROJECT_NAME" --profile e2e)
STARTED_STACK=0

cleanup() {
  if [[ "$STARTED_STACK" -eq 1 ]]; then
    docker compose "${COMPOSE_ARGS[@]}" down
  fi
}

trap cleanup EXIT

is_running() {
  local service="$1"
  local container_id
  container_id="$(docker compose "${COMPOSE_ARGS[@]}" ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$container_id" ]]; then
    return 1
  fi
  local status
  status="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
  [[ "$status" == "running" ]]
}

if ! is_running frontend-e2e || ! is_running worker-e2e; then
  STARTED_STACK=1
  docker compose "${COMPOSE_ARGS[@]}" up -d frontend-e2e worker-e2e
fi

docker compose "${COMPOSE_ARGS[@]}" run --rm --no-deps -T e2e npm run test:e2e -- --workers=1 --output=/tmp/spinrank-playwright-prepush

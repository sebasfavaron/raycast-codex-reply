#!/usr/bin/env bash
set -euo pipefail

BRIDGE_DIR="${HOME}/.codex/raycast-codex-reply"
REPLY_PATH="${BRIDGE_DIR}/reply.json"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-900}"
SLEEP_SECONDS="${SLEEP_SECONDS:-1}"
PROMPT_TEXT="${1:-}"
PROMPT_ID="${2:-prompt-$(date +%s)}"
SOURCE_NAME="${3:-codex}"

if [ -z "${PROMPT_TEXT}" ]; then
  echo "usage: $0 '<prompt>' [prompt-id] [source]" >&2
  exit 1
fi

"$(dirname "$0")/request-reply.sh" "${PROMPT_TEXT}" "${PROMPT_ID}" "${SOURCE_NAME}"

start_ts="$(date +%s)"

while true; do
  if [ -f "${REPLY_PATH}" ]; then
    reply_id="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["id"])' "${REPLY_PATH}")"
    if [ "${reply_id}" = "${PROMPT_ID}" ]; then
      python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["reply"])' "${REPLY_PATH}"
      exit 0
    fi
  fi

  now_ts="$(date +%s)"
  if [ $((now_ts - start_ts)) -ge "${TIMEOUT_SECONDS}" ]; then
    echo "timed out waiting for reply" >&2
    exit 124
  fi

  sleep "${SLEEP_SECONDS}"
done

#!/usr/bin/env bash
set -euo pipefail

BRIDGE_DIR="${HOME}/.codex/raycast-codex-reply"
PROMPT_PATH="${BRIDGE_DIR}/approval-prompt.json"
REPLY_PATH="${BRIDGE_DIR}/approval-response.json"
DEFAULT_DEEPLINK="raycast://extensions/sebas/raycast-codex-reply/approve-codex-action"
DEEPLINK="${RAYCAST_CODEX_APPROVAL_DEEPLINK:-$DEFAULT_DEEPLINK}"

mkdir -p "${BRIDGE_DIR}"

PROMPT_TEXT="${1:-}"
PROMPT_ID="${2:-approval-$(date +%s)}"
SOURCE_NAME="${3:-codex-approval}"

if [ -z "${PROMPT_TEXT}" ]; then
  echo "usage: $0 '<prompt>' [prompt-id] [source]" >&2
  exit 1
fi

python3 - "${PROMPT_PATH}" "${PROMPT_ID}" "${PROMPT_TEXT}" "${SOURCE_NAME}" <<'PY'
import json
import sys
from datetime import datetime, timezone

payload = {
    "id": sys.argv[2],
    "prompt": sys.argv[3],
    "source": sys.argv[4],
    "status": "pending",
    "createdAt": datetime.now(timezone.utc).isoformat(),
}

with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
    fh.write("\n")
PY

rm -f "${REPLY_PATH}"
open "${DEEPLINK}"

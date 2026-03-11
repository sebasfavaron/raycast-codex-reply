#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


POLL_SECONDS = 1.0
ROOT = Path(__file__).resolve().parent.parent
STATE_DB = Path.home() / ".codex" / "state_5.sqlite"
BRIDGE_DIR = Path.home() / ".codex" / "raycast-codex-reply"
STATE_PATH = BRIDGE_DIR / "approval-watch-state.json"
WAIT_SCRIPT = ROOT / "scripts" / "wait-for-approval.sh"
LOG_PATH = Path("/tmp/codex-approval-watch.log")


def log(message: str) -> None:
    ts = time.strftime("%Y-%m-%dT%H:%M:%S")
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(f"{ts}\t{message}\n")


def load_state() -> dict[str, str]:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_state(payload: dict[str, str]) -> None:
    BRIDGE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def latest_rollout() -> tuple[str, Path] | None:
    if not STATE_DB.exists():
        return None
    with sqlite3.connect(STATE_DB) as conn:
        row = conn.execute(
            "select id, rollout_path from threads order by updated_at desc limit 1"
        ).fetchone()
    if not row:
        return None
    thread_id, rollout_path = row
    path = Path(rollout_path)
    if not path.exists():
        return None
    return thread_id, path


def parse_ts(raw: str) -> datetime | None:
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def latest_rollout_prompt(rollout_path: Path, started_after: datetime | None = None) -> tuple[str, str, str]:
    last_message = ""
    last_approval = ""
    last_approval_ts = ""
    with rollout_path.open("r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            obj_ts_raw = obj.get("timestamp", "")
            obj_ts = parse_ts(obj_ts_raw) if obj_ts_raw else None
            if started_after and obj_ts and obj_ts < started_after:
                continue

            if obj.get("type") == "event_msg":
                payload = obj.get("payload", {})
                if payload.get("type") == "task_complete" and payload.get("last_agent_message"):
                    last_message = payload["last_agent_message"]
                    continue
                if payload.get("type") == "agent_message" and payload.get("message"):
                    last_message = payload["message"]
                    continue

            if obj.get("type") == "response_item":
                payload = obj.get("payload", {})
                if payload.get("type") == "function_call" and payload.get("name") == "exec_command":
                    try:
                        args = json.loads(payload.get("arguments", "{}"))
                    except json.JSONDecodeError:
                        args = {}
                    if args.get("sandbox_permissions") == "require_escalated" and args.get("justification"):
                        last_approval = args["justification"].strip()
                        last_approval_ts = obj_ts_raw
                if payload.get("type") == "message" and payload.get("role") == "assistant":
                    texts = [
                        item.get("text", "")
                        for item in payload.get("content", [])
                        if isinstance(item, dict) and item.get("type") == "output_text"
                    ]
                    joined = "\n".join(part for part in texts if part).strip()
                    if joined:
                        last_message = joined
    return last_message, last_approval, last_approval_ts


def is_approval_prompt(message: str) -> bool:
    stripped = message.strip()
    return stripped.startswith("Do you want me to ")


def send_key_to_warp(reply: str) -> None:
    if reply == "esc":
        script = """
try
  tell application "Warp" to activate
  delay 0.2
  tell application "System Events"
    key code 53
  end tell
end try
"""
        subprocess.run(["osascript", "-e", script], check=False)
        return

    script = f"""
try
  tell application "Warp" to activate
  delay 0.2
  tell application "System Events"
    keystroke "{reply}"
  end tell
end try
"""
    subprocess.run(["osascript", "-e", script], check=False)


def main() -> int:
    log("approval watcher started")
    started_after = datetime.now(timezone.utc)
    while True:
        rollout = latest_rollout()
        if rollout is None:
            time.sleep(POLL_SECONDS)
            continue

        thread_id, rollout_path = rollout
        message, approval_prompt, approval_ts = latest_rollout_prompt(rollout_path, started_after)
        effective_prompt = approval_prompt or message
        if not is_approval_prompt(effective_prompt):
            time.sleep(POLL_SECONDS)
            continue

        signature = hashlib.sha256(f"{thread_id}\n{approval_ts}\n{effective_prompt}".encode("utf-8")).hexdigest()
        state = load_state()
        if state.get("last_signature") == signature:
            time.sleep(POLL_SECONDS)
            continue

        prompt_id = f"approval-{signature[:12]}"
        log(f"approval prompt detected for {thread_id}")
        result = subprocess.run(
            [str(WAIT_SCRIPT), effective_prompt, prompt_id, "codex-approval-watch"],
            check=False,
            capture_output=True,
            text=True,
        )
        reply = result.stdout.strip().lower()
        if reply:
            send_key_to_warp(reply)
            log(f"approval reply sent: {reply}")
            save_state({"last_signature": signature, "last_reply": reply, "last_approval_ts": approval_ts})
        else:
            log(f"approval reply missing; rc={result.returncode}; stderr={result.stderr.strip()}")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("approval watcher stopped")
        sys.exit(0)

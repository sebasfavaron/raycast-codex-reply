# raycast-codex-reply

Local Raycast extension for one job: reply to Codex from a tiny Raycast form without leaving fullscreen apps like movie playback.

## What It Does

This repo turns Raycast into a lightweight human-reply UI for Codex.

- Codex asks for input
- a local hook opens Raycast
- Raycast shows the last Codex message above a reply field
- your answer is saved locally
- a terminal workflow can wait for that answer and continue

Current setup also supports a practical fallback flow:

- save reply
- copy reply to clipboard
- optionally return focus to `Warp`
- paste and send automatically

## Flow

1. A local script writes the current prompt to `~/.codex/raycast-codex-reply/current-prompt.json`
2. The script opens Raycast through a deeplink
3. Raycast shows the last Codex message plus a minimal reply form
4. Submit saves `reply.json` and copies the text to the clipboard
5. A waiting terminal script prints the reply back to stdout

## Files

- `src/reply-to-codex.tsx`: Raycast UI
- `src/approve-codex-action.tsx`: Raycast UI for single-key approvals
- `scripts/request-reply.sh`: open Raycast with a prompt
- `scripts/wait-for-reply.sh`: open Raycast and block until a reply arrives
- `scripts/wait-for-approval.sh`: open Raycast and wait for a one-key approval reply
- `scripts/run-approval-watcher.sh`: watch Codex rollouts for approval prompts and send a key to Warp

## Install

```bash
npm install
npm run dev
```

Then import the extension in Raycast when the dev tool prompts you.

## Use

Open Raycast manually:

```bash
./scripts/request-reply.sh "Need your answer here"
```

Wait in a terminal workflow:

```bash
./scripts/wait-for-reply.sh "Need your answer here"
```

Run the approval watcher:

```bash
./scripts/run-approval-watcher.sh
```

## Notes

- The deeplink path assumes local extension owner `sebas` and extension name `raycast-codex-reply`
- Adjust the deeplink in `scripts/request-reply.sh` if Raycast assigns a different owner/name on import
- In Sebas's current local setup, `~/.codex/hooks/notify_macos.sh` can use this repo as the human-reply bridge
- The approval watcher is separate from `notify`; it watches the latest Codex rollout for approval prompts that start with `Do you want me to `

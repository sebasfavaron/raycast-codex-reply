import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  Toast,
  closeMainWindow,
  popToRoot,
  showHUD,
  showToast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type PromptState = {
  id: string;
  prompt: string;
  createdAt: string;
  source: string;
  status: string;
};

type ReplyPayload = {
  id: string;
  prompt: string;
  reply: string;
  respondedAt: string;
  source: string;
};

const bridgeDir = path.join(os.homedir(), ".codex", "raycast-codex-reply");
const currentPromptPath = path.join(bridgeDir, "current-prompt.json");
const replyPath = path.join(bridgeDir, "reply.json");

function ensureBridgeDir() {
  fs.mkdirSync(bridgeDir, { recursive: true });
}

function loadPrompt(): PromptState {
  ensureBridgeDir();
  if (!fs.existsSync(currentPromptPath)) {
    return {
      id: `prompt-${Date.now()}`,
      prompt: "",
      createdAt: new Date().toISOString(),
      source: "raycast",
      status: "idle",
    };
  }

  try {
    const raw = fs.readFileSync(currentPromptPath, "utf8");
    return JSON.parse(raw) as PromptState;
  } catch {
    return {
      id: `prompt-${Date.now()}`,
      prompt: "",
      createdAt: new Date().toISOString(),
      source: "raycast",
      status: "invalid",
    };
  }
}

function persistReply(payload: ReplyPayload) {
  ensureBridgeDir();
  fs.writeFileSync(replyPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function markPromptAnswered(promptState: PromptState) {
  fs.writeFileSync(
    currentPromptPath,
    `${JSON.stringify({ ...promptState, status: "answered" }, null, 2)}\n`,
    "utf8",
  );
}

export default function Command() {
  const promptState = useMemo(() => loadPrompt(), []);
  const initialPrompt = promptState.prompt;
  const promptId = promptState.id;
  const source = promptState.source;
  const [reply, setReply] = useState("");
  const promptFallback =
    "No prompt loaded. Run the helper script to preload one.";
  const promptLabel =
    initialPrompt && initialPrompt !== "Codex turn completed."
      ? initialPrompt
      : `${initialPrompt || promptFallback}\n\nNote: your current Codex notify hook sometimes sends an empty payload, so the exact assistant message is not always available yet.`;

  useEffect(() => {
    void showToast({
      style: Toast.Style.Animated,
      title: "Reply mode",
      message: "Write a short answer and submit",
    });
  }, []);

  async function submit(values: { reply: string }) {
    const trimmed = values.reply.trim();
    if (!trimmed) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Empty reply",
        message: "Type something first",
      });
      return;
    }

    persistReply({
      id: promptId,
      prompt: initialPrompt,
      reply: trimmed,
      respondedAt: new Date().toISOString(),
      source,
    });
    markPromptAnswered(promptState);
    await Clipboard.copy(trimmed);
    await closeMainWindow();
    await popToRoot();
    await showHUD("Reply saved and copied");
  }

  return (
    <Form
      navigationTitle="Reply to Codex"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Reply" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Last Codex Message" text={promptLabel} />
      <Form.Description
        title="Context"
        text={`Prompt ID: ${promptId}\nSource: ${source}\nStatus: ${promptState.status}`}
      />
      <Form.TextArea
        id="reply"
        title="Reply"
        autoFocus
        placeholder="Type your answer..."
        value={reply}
        onChange={setReply}
      />
    </Form>
  );
}

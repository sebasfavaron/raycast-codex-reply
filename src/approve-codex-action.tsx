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

type ApprovalState = {
  id: string;
  prompt: string;
  createdAt: string;
  source: string;
  status: string;
};

type ApprovalPayload = {
  id: string;
  prompt: string;
  reply: string;
  respondedAt: string;
  source: string;
};

const bridgeDir = path.join(os.homedir(), ".codex", "raycast-codex-reply");
const approvalPromptPath = path.join(bridgeDir, "approval-prompt.json");
const approvalReplyPath = path.join(bridgeDir, "approval-response.json");

function ensureBridgeDir() {
  fs.mkdirSync(bridgeDir, { recursive: true });
}

function loadPrompt(): ApprovalState {
  ensureBridgeDir();
  if (!fs.existsSync(approvalPromptPath)) {
    return {
      id: `approval-${Date.now()}`,
      prompt: "",
      createdAt: new Date().toISOString(),
      source: "raycast",
      status: "idle",
    };
  }

  try {
    return JSON.parse(
      fs.readFileSync(approvalPromptPath, "utf8"),
    ) as ApprovalState;
  } catch {
    return {
      id: `approval-${Date.now()}`,
      prompt: "",
      createdAt: new Date().toISOString(),
      source: "raycast",
      status: "invalid",
    };
  }
}

function persistReply(payload: ApprovalPayload) {
  ensureBridgeDir();
  fs.writeFileSync(
    approvalReplyPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

function markPromptAnswered(promptState: ApprovalState) {
  fs.writeFileSync(
    approvalPromptPath,
    `${JSON.stringify({ ...promptState, status: "answered" }, null, 2)}\n`,
    "utf8",
  );
}

export default function Command() {
  const promptState = useMemo(() => loadPrompt(), []);
  const [selection, setSelection] = useState("y");
  const [customReply, setCustomReply] = useState("");

  useEffect(() => {
    void showToast({
      style: Toast.Style.Animated,
      title: "Approval mode",
      message: "Choose a single key",
    });
  }, []);

  async function submit(values: { choice: string; customReply: string }) {
    const rawReply = values.customReply.trim().toLowerCase() || values.choice;
    const normalizedReply =
      rawReply === "escape" || rawReply === "esc"
        ? "esc"
        : rawReply.slice(0, 1).toLowerCase();
    const reply = normalizedReply;
    if (!reply) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Empty approval",
        message: "Choose or type one letter",
      });
      return;
    }

    persistReply({
      id: promptState.id,
      prompt: promptState.prompt,
      reply,
      respondedAt: new Date().toISOString(),
      source: promptState.source,
    });
    markPromptAnswered(promptState);
    await Clipboard.copy(reply);
    await closeMainWindow();
    await popToRoot();
    await showHUD(`Approval saved: ${reply}`);
  }

  return (
    <Form
      navigationTitle="Approve Codex Action"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Approval" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Last Codex Message"
        text={
          promptState.prompt ||
          "No approval prompt loaded. Run the helper script first."
        }
      />
      <Form.Description
        title="Context"
        text={`Prompt ID: ${promptState.id}\nSource: ${promptState.source}\nStatus: ${promptState.status}`}
      />
      <Form.Dropdown
        id="choice"
        title="Choice"
        value={selection}
        onChange={setSelection}
      >
        <Form.Dropdown.Item value="y" title="y - approve" />
        <Form.Dropdown.Item value="a" title="a - always for edits" />
        <Form.Dropdown.Item value="p" title="p - persist prefix" />
        <Form.Dropdown.Item value="n" title="n - deny" />
        <Form.Dropdown.Item value="esc" title="esc - cancel" />
      </Form.Dropdown>
      <Form.TextField
        id="customReply"
        title="Override"
        autoFocus
        placeholder="Optional key: y, n, a, p, esc"
        value={customReply}
        onChange={setCustomReply}
      />
    </Form>
  );
}

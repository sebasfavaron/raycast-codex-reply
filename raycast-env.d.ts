/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `reply-to-codex` command */
  export type ReplyToCodex = ExtensionPreferences & {}
  /** Preferences accessible in the `approve-codex-action` command */
  export type ApproveCodexAction = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `reply-to-codex` command */
  export type ReplyToCodex = {}
  /** Arguments passed to the `approve-codex-action` command */
  export type ApproveCodexAction = {}
}


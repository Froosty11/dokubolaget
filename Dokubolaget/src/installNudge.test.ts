import { expect, test } from "bun:test";
import { chooseInstallNudge, type InstallEnv } from "./installNudge";

const base: InstallEnv = { isWeb: true, standalone: false, isIOS: false, canPrompt: false, dismissed: false };

test("no nudge on native (already an app)", () => {
  expect(chooseInstallNudge({ ...base, isWeb: false, canPrompt: true })).toBe("none");
});

test("no nudge when already installed (standalone)", () => {
  expect(chooseInstallNudge({ ...base, standalone: true, canPrompt: true })).toBe("none");
});

test("no nudge once dismissed", () => {
  expect(chooseInstallNudge({ ...base, dismissed: true, canPrompt: true })).toBe("none");
});

test("shows the install button when the browser offers a prompt", () => {
  expect(chooseInstallNudge({ ...base, canPrompt: true })).toBe("prompt");
});

test("shows iOS Share instructions on iOS Safari (no prompt event there)", () => {
  expect(chooseInstallNudge({ ...base, isIOS: true })).toBe("ios");
});

test("no nudge on a desktop browser that offers no prompt", () => {
  expect(chooseInstallNudge({ ...base })).toBe("none");
});

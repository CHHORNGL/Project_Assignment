import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const FRONTEND_DIR = path.resolve(import.meta.dirname, "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(FRONTEND_DIR, "src", relPath), "utf8");
}

test("ProfilePage integrates interactive AvatarCropModal with canvas output", () => {
  const modal = readSrc("components/user/AvatarCropModal.tsx");
  const profile = readSrc("pages/user/ProfilePage.tsx");

  assert.ok(modal.includes("canvas.toBlob"));
  assert.ok(modal.includes("Drag to reposition"));
  assert.ok(modal.includes("Rotate"));
  assert.ok(modal.includes("Apply Crop"));

  assert.ok(profile.includes("AvatarCropModal"));
  assert.ok(profile.includes("new DataTransfer()"));
  assert.ok(profile.includes("setCropModalOpen(true)"));
});

test("LoginActivityPage and SettingsPage show real device names and location instead of raw IP", () => {
  const activity = readSrc("pages/user/LoginActivityPage.tsx");
  const settings = readSrc("pages/user/SettingsPage.tsx");

  assert.ok(activity.includes("act.device_name"));
  assert.ok(activity.includes("act.location"));
  assert.ok(!activity.includes("act.ip_address"));

  assert.ok(settings.includes("act.device_name"));
  assert.ok(settings.includes("act.location"));
  assert.ok(!settings.includes("act.ip_address"));
});

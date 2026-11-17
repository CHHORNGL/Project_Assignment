import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const FRONTEND_DIR = path.resolve(import.meta.dirname, "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(FRONTEND_DIR, "src", relPath), "utf8");
}

test("Live support chat polling uses reduced cadence and conditional channel refresh", () => {
  const farmerLive = readSrc("pages/farmer/FarmerLiveChatPage.tsx");
  const drawer = readSrc("components/layout/AiCopilotDrawer.tsx");
  const adminChats = readSrc("pages/admin/AdminSupportChatsPage.tsx");

  assert.ok(farmerLive.includes("}, 4500);"));
  assert.ok(farmerLive.includes("pollCountRef.current % 4 === 0"));

  assert.ok(drawer.includes("}, 4500);"));
  assert.ok(drawer.includes("supportPollCountRef.current % 4 === 0"));

  assert.ok(adminChats.includes("}, 6000);"));
  assert.ok(adminChats.includes("}, 3500);"));
});

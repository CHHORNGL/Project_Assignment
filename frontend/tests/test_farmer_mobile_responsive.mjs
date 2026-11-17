import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const FRONTEND_DIR = path.resolve(import.meta.dirname, "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(FRONTEND_DIR, "src", relPath), "utf8");
}

test("FarmerDashboardPage removes invalid p-4.5 spacing and guards grid cards with min-w-0", () => {
  const code = readSrc("pages/farmer/FarmerDashboardPage.tsx");
  assert.ok(!code.includes("p-4.5"), "Invalid Tailwind p-4.5 class must not remain");
  assert.ok(code.includes("p-3.5 sm:p-5"), "KPI cards should use valid responsive p-3.5 sm:p-5 padding");
  assert.ok(code.includes("min-w-0"), "Grid children should use min-w-0 to prevent horizontal overflow");
});

test("Shared farmer shell, apps grid, and bottom dock avoid mobile popover clipping", () => {
  const shell = readSrc("components/layout/WorkspaceShell.tsx");
  const apps = readSrc("components/layout/AppsGridMenu.tsx");
  const dock = readSrc("components/layout/FarmerBottomNav.tsx");

  assert.ok(
    shell.includes("fixed inset-x-3 top-[4.25rem] z-50"),
    "Notifications dropdown should anchor within viewport margins on mobile",
  );
  assert.ok(
    apps.includes("fixed inset-x-3 top-[4.25rem] z-50"),
    "Apps Grid popover should anchor within viewport margins on mobile",
  );
  assert.ok(
    dock.includes("h-[54px] w-[54px]") && dock.includes("sm:h-[64px] sm:w-[64px]"),
    "Farmer bottom dock orb should scale cleanly on narrow phones",
  );
});

test("FarmerChatPage and FarmerLiveChatPage wrap long messages and keep mobile composers unobstructed", () => {
  const aiChat = readSrc("pages/farmer/FarmerChatPage.tsx");
  const liveChat = readSrc("pages/farmer/FarmerLiveChatPage.tsx");

  assert.ok(
    aiChat.includes("h-[calc(100dvh-14.5rem-env(safe-area-inset-bottom))]"),
    "AI chat studio should reserve mobile bottom-dock and safe-area space",
  );
  assert.ok(
    aiChat.includes("pb-[env(safe-area-inset-bottom)]"),
    "AI chat drawer should include bottom safe-area padding",
  );
  assert.ok(
    aiChat.includes("[&_pre]:overflow-x-auto"),
    "AI chat formatted code blocks should scroll instead of widening viewport",
  );

  assert.ok(
    liveChat.includes("grid min-w-0 grid-cols-2 gap-2 sm:gap-3"),
    "Live chat Admin/Expert cards should use a compact 2-column switch on mobile",
  );
  assert.ok(
    liveChat.includes("overflow-x-auto pb-1 sm:flex-wrap"),
    "Live chat staff pills should scroll horizontally on narrow phones",
  );
  assert.ok(
    liveChat.includes("order-1 h-9 w-full min-w-0 flex-none"),
    "Live chat composer input should sit full-width on row 1 on mobile",
  );
  assert.ok(
    liveChat.includes("order-2 ml-auto"),
    "Live chat composer send button should stay accessible on row 2 on mobile",
  );
});

test("Farmer history, news, detail, upgrade, checkout, and wizard handle mobile layout constraints", () => {
  const history = readSrc("pages/farmer/FarmerHistoryPage.tsx");
  const news = readSrc("pages/farmer/FarmerNewsPage.tsx");
  const detail = readSrc("pages/farmer/FarmerDetailPage.tsx");
  const upgrade = readSrc("pages/farmer/FarmerUpgradePage.tsx");
  const checkout = readSrc("pages/farmer/FarmerCheckoutPage.tsx");
  const stepper = readSrc("diagnosis/components/Stepper.tsx");
  const wizard = readSrc("diagnosis/DiagnosisWizardPage.tsx");

  assert.ok(history.includes("grid w-full grid-cols-2 gap-2 sm:flex"));
  assert.ok(history.includes("overflow-x-auto"));
  assert.ok(news.includes("overflow-x-auto pb-1 sm:flex-wrap"));
  assert.ok(detail.includes("grid grid-cols-2 gap-3 sm:grid-cols-4"));
  assert.ok(detail.includes("break-all"));
  assert.ok(upgrade.includes("grid w-full grid-cols-2"));
  assert.ok(upgrade.includes("order-1 relative flex min-w-0"));
  assert.ok(checkout.includes("h-48 w-48 max-w-full"));
  assert.ok(checkout.includes("flex-col items-stretch justify-center gap-2 sm:flex-row"));
  assert.ok(stepper.includes("hidden truncate text-[11px] text-slate-500 dark:text-slate-400 sm:block"));
  assert.ok(wizard.includes("lg:grid-cols-[minmax(0,1fr)_340px]"));
  assert.ok(wizard.includes("max-h-[320px] min-h-[180px] w-full object-cover"));
});

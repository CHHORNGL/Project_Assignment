import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const manifestPath = path.join(repoRoot, "backend/app/static/manifest.webmanifest");
const reactShellPath = path.join(repoRoot, "backend/app/templates/layouts/react_shell.html");
const compiledAppCssPath = path.join(repoRoot, "backend/app/static/app/app.css");
const compiledDiagCssPath = path.join(repoRoot, "backend/app/static/diagnosis-wizard/diagnosis-wizard.css");
const pwaUtilsPath = path.join(repoRoot, "frontend/src/utils/pwa.ts");

test("PWA manifest.webmanifest defines standalone mode and existing icons", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);

  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith("/static/"));
    const diskPath = path.join(repoRoot, "backend/app", icon.src.replace(/^\//, ""));
    assert.equal(fs.existsSync(diskPath), true, `Missing manifest icon file: ${diskPath}`);
  }
});

test("react_shell.html exposes viewport-fit, PWA manifest, and mobile meta tags", () => {
  const html = fs.readFileSync(reactShellPath, "utf8");
  assert.equal(html.includes('viewport-fit=cover'), true);
  assert.equal(html.includes('rel="manifest" href="/manifest.webmanifest"'), true);
  assert.equal(html.includes('name="theme-color"'), true);
  assert.equal(html.includes('name="apple-mobile-web-app-capable" content="yes"'), true);
  assert.equal(html.includes("img/pwa/apple-touch-icon.png"), true);
});

test("compiled CSS bundles include mobile anti-zoom input sizing and overflow-x clip", () => {
  for (const cssPath of [compiledAppCssPath, compiledDiagCssPath]) {
    const css = fs.readFileSync(cssPath, "utf8");
    assert.equal(css.includes("overflow-x:clip"), true, `Expected overflow-x:clip in ${cssPath}`);
    assert.equal(css.includes("16px"), true, `Expected 16px mobile input font-size rule in ${cssPath}`);
    assert.equal(css.includes("min-height:100dvh"), true, `Expected 100dvh support in ${cssPath}`);
  }
});

test("PWA utility guards service worker registration and mobile viewport breakpoint", () => {
  const source = fs.readFileSync(pwaUtilsPath, "utf8");
  assert.equal(source.includes("canRegisterServiceWorker"), true);
  assert.equal(source.includes('register(swPath, { scope: "/" })'), true);
  assert.equal(source.includes("isCompactMobileViewport"), true);
});

test("Farmer mobile shell & routes prevent header overflow and table cramping", () => {
  const shell = fs.readFileSync(path.join(repoRoot, "frontend/src/components/layout/WorkspaceShell.tsx"), "utf8");
  assert.equal(shell.includes("hidden items-center gap-2 md:flex"), true);
  assert.equal(shell.includes("md:hidden"), true);

  const dash = fs.readFileSync(path.join(repoRoot, "frontend/src/pages/farmer/FarmerDashboardPage.tsx"), "utf8");
  assert.equal(dash.includes("Mobile Card List"), true);
  assert.equal(dash.includes("hidden overflow-x-auto sm:block"), true);

  const detail = fs.readFileSync(path.join(repoRoot, "frontend/src/pages/farmer/FarmerDetailPage.tsx"), "utf8");
  assert.equal(detail.includes("flex w-full flex-wrap items-center gap-1"), true);

  const result = fs.readFileSync(path.join(repoRoot, "frontend/src/pages/farmer/FarmerResultPage.tsx"), "utf8");
  assert.equal(result.includes("break-all"), true);

  const checkout = fs.readFileSync(path.join(repoRoot, "frontend/src/pages/farmer/FarmerCheckoutPage.tsx"), "utf8");
  assert.equal(checkout.includes("h-48 w-48 max-w-full"), true);
});

test("Admin mobile shell & routes prevent CSS grid blowout and support compact phones", () => {
  const phoenixShell = fs.readFileSync(
    path.join(repoRoot, "frontend/src/components/layout/PhoenixWorkspaceShell.tsx"),
    "utf8",
  );
  assert.equal(phoenixShell.includes("min-h-dvh"), true);
  assert.equal(phoenixShell.includes("hidden min-[400px]:inline"), true);
  assert.equal(phoenixShell.includes("hidden sm:inline-flex"), true);
  assert.equal(phoenixShell.includes("alwaysFull"), true);

  const langSwitcher = fs.readFileSync(
    path.join(repoRoot, "frontend/src/components/ui/LanguageSwitcher.tsx"),
    "utf8",
  );
  assert.equal(langSwitcher.includes("alwaysFull"), true);

  const primitives = fs.readFileSync(
    path.join(repoRoot, "frontend/src/components/admin/AdminPrimitives.tsx"),
    "utf8",
  );
  assert.equal(primitives.includes("min-w-0 max-w-full"), true);

  const adminGridPages = [
    "AdminDashboardPage.tsx",
    "AdminExpertStatsPage.tsx",
    "AdminSupportRequestsPage.tsx",
    "AdminWorldPage.tsx",
    "AdminSettingsPage.tsx",
    "AdminRolePermissionsPage.tsx",
    "AdminTranslationsPage.tsx",
    "AdminRolesPage.tsx",
    "AdminCropFormPage.tsx",
    "AdminDiseaseFormPage.tsx",
    "AdminMarqueeFormPage.tsx",
    "AdminPremiumSettingsPage.tsx",
    "AdminPromoCodesPage.tsx",
  ];
  for (const file of adminGridPages) {
    const content = fs.readFileSync(path.join(repoRoot, "frontend/src/pages/admin", file), "utf8");
    assert.equal(content.includes("min-w-0"), true, `Expected min-w-0 grid constraint in ${file}`);
  }

  for (const cardFile of ["AdminDashboardPage.tsx", "AdminUsersPage.tsx", "AdminAuditLogsPage.tsx"]) {
    const content = fs.readFileSync(path.join(repoRoot, "frontend/src/pages/admin", cardFile), "utf8");
    assert.equal(content.includes("hidden overflow-x-auto sm:block"), true, `Expected desktop-only table wrapper in ${cardFile}`);
    assert.equal(content.includes("sm:hidden"), true, `Expected mobile card list in ${cardFile}`);
  }
});

test("Expert mobile routes prevent grid blowout, fixed select widths, and raw mobile tables", () => {
  const expertShared = fs.readFileSync(
    path.join(repoRoot, "frontend/src/components/expert/ExpertShared.tsx"),
    "utf8",
  );
  assert.equal(expertShared.includes("w-full min-w-0 py-1 text-xs sm:w-44"), true);
  assert.equal(expertShared.includes("max-h-[90dvh]"), true);

  const farmerChats = fs.readFileSync(
    path.join(repoRoot, "frontend/src/pages/expert/ExpertFarmerChatsPage.tsx"),
    "utf8",
  );
  assert.equal(farmerChats.includes("flex min-w-0 flex-col justify-between"), true);

  const gridMinW0Files = [
    "ExpertDashboardPage.tsx",
    "ExpertReviewDiagnosisPage.tsx",
    "ExpertKnowledgeDashboardPage.tsx",
    "ExpertSupportHubPage.tsx",
    "ExpertCreateRulePage.tsx",
    "ExpertCreateSymptomPage.tsx",
    "ExpertReplyChatPage.tsx",
  ];
  for (const file of gridMinW0Files) {
    const content = fs.readFileSync(path.join(repoRoot, "frontend/src/pages/expert", file), "utf8");
    assert.equal(content.includes("min-w-0"), true, `Expected min-w-0 guard in ${file}`);
  }

  const expertCardTablePages = [
    "ExpertDashboardPage.tsx",
    "ExpertPendingDiagnosesPage.tsx",
    "ExpertDiseasesPage.tsx",
    "ExpertKnowledgeDashboardPage.tsx",
    "ExpertMixedAgriDashboardPage.tsx",
    "ExpertMixedAgriSourcesPage.tsx",
    "ExpertMixedAgriFactsPage.tsx",
  ];
  for (const file of expertCardTablePages) {
    const content = fs.readFileSync(path.join(repoRoot, "frontend/src/pages/expert", file), "utf8");
    assert.equal(content.includes("hidden overflow-x-auto sm:block"), true, `Expected desktop-only table wrapper in ${file}`);
    assert.equal(content.includes("sm:hidden"), true, `Expected mobile card list in ${file}`);
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const readFile = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), "utf8");

test("Skeleton component exports base primitives and domain skeletons with accessible roles", () => {
  const src = readFile("frontend/src/components/ui/Skeleton.tsx");

  const expectedExports = [
    "export function Skeleton(",
    "export function SkeletonText(",
    "export function SkeletonImage(",
    "export function WeatherIntelligenceSkeleton(",
    "export function StationTelemetrySkeleton(",
    "export function NewsFeedSkeleton(",
    "export function ChatThreadSkeleton(",
    "export function AiThinkingSkeleton(",
    "export function PasskeyListSkeleton(",
    "export function LoginActivitySkeleton(",
    "export function QrCodeSkeleton(",
    "export function LiveSuspectsSkeleton(",
  ];

  for (const sig of expectedExports) {
    assert.equal(src.includes(sig), true, `Missing export ${sig} in Skeleton.tsx`);
  }

  assert.equal(src.includes('role="status"'), true);
  assert.equal(src.includes('aria-busy="true"'), true);
  assert.equal(src.includes("img.complete && img.naturalWidth > 0"), true);
});

test("Compiled CSS bundles preserve skeleton shimmer keyframes and reduced-motion rules", () => {
  for (const cssRel of [
    "backend/app/static/app/app.css",
    "backend/app/static/diagnosis-wizard/diagnosis-wizard.css",
  ]) {
    const css = readFile(cssRel);
    assert.equal(css.includes("sk-shimmer"), true, `Expected .sk-shimmer in ${cssRel}`);
    assert.equal(css.includes("sk-shimmer-slide"), true, `Expected sk-shimmer-slide keyframe in ${cssRel}`);
    assert.equal(css.includes("prefers-reduced-motion:reduce") || css.includes("prefers-reduced-motion: reduce"), true);
  }
});

test("react_shell.html renders pre-hydration SSR skeletons without duplicating SSR content", () => {
  const html = readFile("backend/app/templates/layouts/react_shell.html");
  assert.equal(html.includes("agri-sk-root"), true);
  assert.equal(html.includes("agri-sk-auth"), true);
  assert.equal(html.includes("agri-sk-sidebar-on"), true);
  assert.equal(html.includes('aria-busy="true"'), true);
  assert.equal(html.includes("html.dark-mode"), true);
  assert.equal(html.includes("{% if react_ssr_html %}\n{{ react_ssr_html | safe }}\n{% else %}"), true);
});

test("Async React pages and widgets wire matching skeleton loaders", () => {
  const bindings = [
    ["frontend/src/components/farmer/WeatherIntelligenceCard.tsx", "<WeatherIntelligenceSkeleton"],
    ["frontend/src/pages/farmer/FarmerNewsPage.tsx", "<NewsFeedSkeleton"],
    ["frontend/src/pages/farmer/FarmerNewsPage.tsx", "<SkeletonImage"],
    ["frontend/src/pages/farmer/FarmerLiveChatPage.tsx", "<ChatThreadSkeleton"],
    ["frontend/src/pages/farmer/FarmerChatPage.tsx", "<AiThinkingSkeleton"],
    ["frontend/src/components/layout/AiCopilotDrawer.tsx", "<ChatThreadSkeleton"],
    ["frontend/src/components/layout/AiCopilotDrawer.tsx", "<AiThinkingSkeleton"],
    ["frontend/src/pages/user/ProfilePage.tsx", "<PasskeyListSkeleton"],
    ["frontend/src/pages/user/LoginActivityPage.tsx", "<LoginActivitySkeleton"],
    ["frontend/src/pages/farmer/FarmerCheckoutPage.tsx", "<QrCodeSkeleton"],
    ["frontend/src/pages/admin/AdminSupportChatsPage.tsx", "<ChatThreadSkeleton"],
    ["frontend/src/pages/admin/AdminWorldPage.tsx", "<StationTelemetrySkeleton"],
    ["frontend/src/diagnosis/DiagnosisWizardPage.tsx", "<LiveSuspectsSkeleton"],
  ];

  for (const [relPath, snippet] of bindings) {
    const src = readFile(relPath);
    assert.equal(src.includes(snippet), true, `Expected ${snippet} inside ${relPath}`);
  }
});

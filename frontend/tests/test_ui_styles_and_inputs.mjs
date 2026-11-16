import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const compiledAppCssPath = path.join(repoRoot, "backend/app/static/app/app.css");
const srcRoot = path.join(repoRoot, "frontend/src");

function walkTsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsxFiles(full));
    } else if (entry.isFile() && full.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results.sort();
}

test("phoenix-panel component overrides use zero-specificity :where() so utility pl-*/pr-* never overlap icons", () => {
  const css = fs.readFileSync(compiledAppCssPath, "utf8");

  assert.equal(
    css.includes(".phoenix-panel .ai-input{"),
    false,
    "High-specificity '.phoenix-panel .ai-input' overrides pl-9/pl-10 and makes text overlap icons",
  );
  assert.equal(
    css.includes(":where(.phoenix-panel) .ai-input{"),
    true,
    "Expected zero-specificity ':where(.phoenix-panel) .ai-input{' in compiled app.css",
  );

  const phoenixInputIdx = css.indexOf(":where(.phoenix-panel) .ai-input{");
  const pl9Idx = css.indexOf(".pl-9{");
  const pl10Idx = css.indexOf(".pl-10{");
  const pr11Idx = css.indexOf(".pr-11{");

  assert.ok(pl9Idx > phoenixInputIdx, ".pl-9 utility must appear after ':where(.phoenix-panel) .ai-input'");
  assert.ok(pl10Idx > phoenixInputIdx, ".pl-10 utility must appear after ':where(.phoenix-panel) .ai-input'");
  assert.ok(pr11Idx > phoenixInputIdx, ".pr-11 utility must appear after ':where(.phoenix-panel) .ai-input'");
  assert.equal(css.includes("color-scheme:dark"), true, "Expected dark-mode native control color-scheme");
});

test("no TSX component leaves FontAwesome <i> tags or tight pl-8 next to left-3 icons", () => {
  const files = walkTsxFiles(srcRoot);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(
      /<i\s+[^>]*className[^>]*\bfas\b/.test(text),
      false,
      `Found unloaded FontAwesome <i class="fas ..."> tag in ${path.relative(repoRoot, file)}`,
    );

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.includes("absolute") && line.includes("top-1/2") && line.includes("left-3")) {
        const block = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 18)).join("\n");
        if (block.includes("<input") || block.includes("<select")) {
          assert.equal(
            /\bpl-8\b/.test(block),
            false,
            `Too-tight 'pl-8' next to 'left-3' icon near ${path.relative(repoRoot, file)}:${i + 1}`,
          );
          assert.equal(
            /\bpl-(?:9|10|11)\b/.test(block),
            true,
            `Missing pl-9/pl-10/pl-11 next to 'left-3' icon near ${path.relative(repoRoot, file)}:${i + 1}`,
          );
        }
      }
    }
  }
});

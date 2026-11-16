import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

test('isInspectShortcut blocks DevTools, View Source, and Save shortcuts while preserving normal typing', async () => {
  const { isInspectShortcut } = await import('../src/utils/inspectGuard.ts');

  assert.equal(isInspectShortcut({ key: 'F12' }), true);
  assert.equal(isInspectShortcut({ key: 'I', ctrlKey: true, shiftKey: true }), true);
  assert.equal(isInspectShortcut({ key: 'j', ctrlKey: true, shiftKey: true }), true);
  assert.equal(isInspectShortcut({ key: 'C', ctrlKey: true, shiftKey: true }), true);
  assert.equal(isInspectShortcut({ key: 'i', metaKey: true, altKey: true }), true);
  assert.equal(isInspectShortcut({ key: 'u', metaKey: true, altKey: true }), true);
  assert.equal(isInspectShortcut({ key: 'u', ctrlKey: true }), true);
  assert.equal(isInspectShortcut({ key: 's', metaKey: true }), true);

  assert.equal(isInspectShortcut({ key: 'c', ctrlKey: true }), false);
  assert.equal(isInspectShortcut({ key: 'v', metaKey: true }), false);
  assert.equal(isInspectShortcut({ key: 'r', ctrlKey: true }), false);
  assert.equal(isInspectShortcut({ key: 'Enter' }), false);
});

test('isEditableTarget preserves right-click menus inside form controls', async () => {
  const { isEditableTarget } = await import('../src/utils/inspectGuard.ts');

  assert.equal(isEditableTarget({ tagName: 'INPUT' }), true);
  assert.equal(isEditableTarget({ tagName: 'textarea' }), true);
  assert.equal(isEditableTarget({ tagName: 'SELECT' }), true);
  assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);

  assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: false }), false);
  assert.equal(isEditableTarget({ tagName: 'BODY' }), false);
  assert.equal(isEditableTarget(null), false);
});

test('scrubBootstrapData clears window.__APP_BOOTSTRAP__ and removes inline script tags', async () => {
  const { scrubBootstrapData } = await import('../src/utils/inspectGuard.ts');

  const removed = [];
  const fakeNode = {
    textContent: '{"secret":false}',
    remove() {
      removed.push(this.textContent);
    },
  };

  globalThis.window = { __APP_BOOTSTRAP__: { page: { id: 'landing' } } };
  globalThis.document = {
    getElementById(id) {
      return id === 'app-bootstrap' ? fakeNode : null;
    },
  };

  try {
    scrubBootstrapData(['app-bootstrap']);
    assert.equal('__APP_BOOTSTRAP__' in globalThis.window, false);
    assert.equal(fakeNode.textContent, '');
    assert.deepEqual(removed, ['']);
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('production builds disable sourcemaps and server configs strip server banners', () => {
  for (const cfg of ['frontend/vite.config.js', 'frontend/vite.app.config.js']) {
    const content = fs.readFileSync(path.join(repoRoot, cfg), 'utf8');
    assert.equal(content.includes('sourcemap: false'), true, `${cfg} must disable sourcemaps`);
  }

  const staticDirs = [
    path.join(repoRoot, 'backend/app/static/app'),
    path.join(repoRoot, 'backend/app/static/diagnosis-wizard'),
  ];
  for (const dir of staticDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      assert.equal(file.endsWith('.map'), false, `Unexpected source map in static dir: ${file}`);
    }
  }

  const caddy = fs.readFileSync(path.join(repoRoot, 'deploy/Caddyfile'), 'utf8');
  assert.equal(caddy.includes('-Server'), true);
  const gunicornConf = fs.readFileSync(path.join(repoRoot, 'backend/gunicorn.conf.py'), 'utf8');
  assert.equal(gunicornConf.includes('gunicorn.SERVER'), true);
});

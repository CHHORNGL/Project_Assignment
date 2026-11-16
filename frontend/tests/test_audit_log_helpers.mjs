import test from 'node:test';
import assert from 'node:assert/strict';

test('parseAuditDetail extracts structured session telemetry and readable summary', async () => {
  const { parseAuditDetail } = await import('../src/lib/auditLogHelpers.ts');

  const raw =
    'ip=172.20.0.1 rid=d916efa0959e Session initialized activity_id=abc123 sid=tok_456 device=laptop_computer browser=Chrome os=macOS login_route=/staff/login';
  const parsed = parseAuditDetail(raw);

  assert.equal(parsed.summary, 'Session initialized');
  assert.equal(parsed.ip, '172.20.0.1');
  assert.equal(parsed.rid, 'd916efa0959e');
  assert.equal(parsed.browser, 'Chrome');
  assert.equal(parsed.os, 'macOS');
  assert.equal(parsed.device, 'laptop_computer');
  assert.equal(parsed.loginRoute, '/staff/login');
  assert.ok(parsed.fields.some((f) => f.key === 'sid' && f.value === 'tok_456'));
});

test('classifyAuditAction categorizes alerts, auth, rbac, and operations accurately', async () => {
  const { classifyAuditAction } = await import('../src/lib/auditLogHelpers.ts');

  const fail = classifyAuditAction('STAFF_LOGIN_FAILURE', 'status=FAILURE Invalid staff credentials');
  assert.equal(fail.category, 'alerts');
  assert.equal(fail.tone, 'rose');

  const auth = classifyAuditAction('AUTH_SESSION_CREATED', 'Session initialized');
  assert.equal(auth.category, 'auth');
  assert.equal(auth.tone, 'emerald');

  const rbac = classifyAuditAction('UPDATE_ROLE_PERMISSIONS', '');
  assert.equal(rbac.category, 'rbac');
  assert.equal(rbac.tone, 'indigo');

  const ops = classifyAuditAction('EXPERT_GET', '');
  assert.equal(ops.category, 'operations');
  assert.equal(ops.tone, 'slate');
});

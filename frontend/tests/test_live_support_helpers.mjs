import test from 'node:test';
import assert from 'node:assert/strict';

test('mergeSupportMessages deduplicates incoming delta updates and applies read receipts', async () => {
  const { mergeSupportMessages } = await import('../src/lib/liveSupportHelpers.ts');

  const prev = [
    { id: 1, sender_id: 10, message: 'Hello', is_read: false, created_at: '2026-11-16 10:00:00' },
    { id: 2, sender_id: 1, message: 'Hi there', is_read: false, created_at: '2026-11-16 10:00:10' },
    { id: -999, sender_id: 1, message: 'Pending', created_at: '2026-11-16 10:00:20', optimistic: true },
  ];
  const incoming = [
    { id: 2, sender_id: 1, message: 'Hi there', is_read: false, created_at: '2026-11-16 10:00:10' },
    { id: 3, sender_id: 10, message: 'Thanks!', is_read: false, created_at: '2026-11-16 10:00:15' },
  ];

  const merged = mergeSupportMessages(prev, incoming, [2]);
  assert.equal(merged.length, 4);
  assert.equal(merged[1].is_read, true);
  assert.equal(merged[2].id, 3);
  assert.equal(merged[3].optimistic, true);
});

test('buildFarmerSupportQueryUrl encodes target, optional recipientId, and delta cursor', async () => {
  const { buildFarmerSupportQueryUrl } = await import('../src/lib/liveSupportHelpers.ts');

  assert.equal(
    buildFarmerSupportQueryUrl('/farmer/support_chat/messages', {
      target: 'expert',
      envelope: true,
    }),
    '/farmer/support_chat/messages?envelope=1&target=expert',
  );

  assert.equal(
    buildFarmerSupportQueryUrl('/farmer/support_chat/messages', {
      target: 'admin',
      recipientId: 12,
      afterId: 44,
      envelope: true,
    }),
    '/farmer/support_chat/messages?envelope=1&target=admin&recipient_id=12&after_id=44',
  );
});

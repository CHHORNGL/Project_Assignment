const { test } = require('node:test');
const assert = require('node:assert/strict');

function createHarness() {
  const calls = [];
  let sent = 0;
  let draft = null;
  let promiseMod = null;

  async function init() {
    promiseMod = await import('../src/lib/supportChatSecurity.ts');
    const coordinator = promiseMod.createAttachmentSendCoordinator({
      uploadFile: async (file) => {
        calls.push({ url: '/upload', file });
        return { url: '/static/uploads/chats/test.png' };
      },
      sendMessage: async (sendUrl, payload) => {
        calls.push({ url: sendUrl, body: JSON.stringify(payload) });
        sent += 1;
        return { success: true };
      },
    });
    return { mod: promiseMod, coordinator };
  }

  return {
    calls,
    sent: () => sent,
    getDraft: () => draft,
    choosePhoto(file = { name: 'photo.png', type: 'image/png', size: 1024 }) {
      draft = { type: 'image', sendUrl: '/send', file };
    },
    cancelDraft() {
      draft = null;
    },
    clearSentDraft() {
      draft = null;
    },
    init,
  };
}

test('photo selection only previews; cancel sends nothing', async () => {
  const h = createHarness();
  const { mod } = await h.init();
  const file = { name: 'photo.png', type: 'image/png', size: 1024 };
  assert.equal(mod.validateAttachmentFile(file, 'image'), null);
  h.choosePhoto(file);
  assert.ok(h.getDraft());
  assert.equal(h.calls.length, 0);
  h.cancelDraft();
  assert.equal(h.getDraft(), null);
  assert.equal(h.calls.length, 0);
});

test('explicit Send uploads photo and sends caption once', async () => {
  const h = createHarness();
  const { coordinator } = await h.init();
  h.choosePhoto();
  const first = coordinator.submitDraft(h.getDraft(), 'Rice leaf');
  const second = coordinator.submitDraft(h.getDraft(), 'Rice leaf');
  const [ok1, ok2] = await Promise.all([first, second]);
  assert.equal(ok1, true);
  assert.equal(ok2, false);
  h.clearSentDraft();
  assert.deepEqual(h.calls.map((c) => c.url), ['/upload', '/send']);
  const payload = JSON.parse(h.calls[1].body);
  assert.equal(payload.message, 'Rice leaf');
  assert.equal(payload.attachment_type, 'image');
  assert.equal(h.sent(), 1);
  assert.equal(h.getDraft(), null);
});

test('voice and location failures show status without sending', async () => {
  const h = createHarness();
  const { mod } = await h.init();
  const emptyAudioErr = mod.validateAttachmentFile({ size: 0, type: 'audio/webm' }, 'audio');
  assert.match(emptyAudioErr, /empty/);
  const noGps = await mod.resolveLocationDraftCoords({ geolocation: null });
  assert.match(noGps.statusMessage, /unavailable/);
  assert.equal(h.calls.length, 0);
});

test('location success prepares map preview and sends location payload', async () => {
  const h = createHarness();
  const { mod, coordinator } = await h.init();
  const mockGeo = {
    getCurrentPosition(success) {
      success({ coords: { latitude: 11.5564, longitude: 104.9282, accuracy: 15 } });
    },
  };
  const loc = await mod.resolveLocationDraftCoords({ geolocation: mockGeo });
  const ok = await coordinator.submitDraft(
    { type: 'location', sendUrl: '/send', url: loc.coordString },
    '',
  );
  assert.equal(ok, true);
  assert.equal(h.sent(), 1);
  const sendCall = h.calls.find((c) => c.url === '/send');
  assert.ok(sendCall);
  const payload = JSON.parse(sendCall.body);
  assert.equal(payload.attachment_type, 'location');
  assert.equal(payload.attachment_url, '11.556400,104.928200');
});

test('location without hardware GPS prepares map preview and allows sending', async () => {
  const h = createHarness();
  const { mod, coordinator } = await h.init();
  const loc = await mod.resolveLocationDraftCoords({ geolocation: null });
  const ok = await coordinator.submitDraft(
    { type: 'location', sendUrl: '/send', url: loc.coordString },
    '',
  );
  assert.equal(ok, true);
  assert.equal(h.sent(), 1);
  const sendCall = h.calls.find((c) => c.url === '/send');
  assert.ok(sendCall);
  const payload = JSON.parse(sendCall.body);
  assert.equal(payload.attachment_type, 'location');
  assert.equal(payload.attachment_url, '11.556400,104.928200');
});

const test = require('node:test');
const assert = require('node:assert/strict');

test('attack markup stays literal text, including existing stored messages', async () => {
  const { normalizeSupportMessageAttachment } = await import('../src/lib/supportChatSecurity.ts');
  const payload = '<img src=x onerror=alert(document.cookie)>សួស្តី';
  const rendered = normalizeSupportMessageAttachment({ message: payload });
  assert.equal(rendered.text, payload);
  assert.equal(rendered.kind, null);
  assert.equal(rendered.url, null);
});

test('unsafe attachment URLs create no media nodes', async () => {
  const { normalizeSupportMessageAttachment } = await import('../src/lib/supportChatSecurity.ts');
  for (const url of [
    'javascript:alert(1)',
    '//evil.example/image.png',
    '/static/uploads/chats/x" onerror="alert(1)',
  ]) {
    const rendered = normalizeSupportMessageAttachment({
      message: '',
      attachment_type: 'image',
      attachment_url: url,
    });
    assert.equal(rendered.kind, null);
    assert.equal(rendered.url, null);
  }
});

test('valid uploaded images, audio and coordinates still render', async () => {
  const { normalizeSupportMessageAttachment, isSafeSupportImageUrl } = await import(
    '../src/lib/supportChatSecurity.ts'
  );
  assert.equal(typeof isSafeSupportImageUrl, 'function');
  for (const [kind, url] of [
    ['image', '/static/uploads/chats/' + 'a'.repeat(32) + '.png'],
    ['image', '/static/uploads/chats/' + 'a'.repeat(32) + '.JPG'],
    ['image', 'http://localhost:5000/static/uploads/chats/' + 'a'.repeat(32) + '.png?v=1'],
    ['audio', '/static/uploads/chats/' + 'b'.repeat(32) + '.webm'],
    ['location', '11.55,104.92'],
  ]) {
    const rendered = normalizeSupportMessageAttachment({ attachment_type: kind, attachment_url: url });
    assert.equal(rendered.kind, kind);
    if (kind === 'location') {
      assert.equal(rendered.location.href, 'https://maps.google.com/?q=11.55%2C104.92');
      assert.match(rendered.location.label, /View on Map/);
    } else {
      assert.equal(rendered.url, url);
    }
  }
});

test('valid image URLs pass fullscreen safety checks while malicious URLs fail', async () => {
  const { isSafeSupportImageUrl } = await import('../src/lib/supportChatSecurity.ts');
  const validUrl = '/static/uploads/chats/' + 'c'.repeat(32) + '.PNG';
  assert.equal(isSafeSupportImageUrl(validUrl), true);
  assert.equal(isSafeSupportImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeSupportImageUrl('//evil.example/a.png'), false);
});

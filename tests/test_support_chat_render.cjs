const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element(tag) {
    return {
        tag, children: [], style: {},
        appendChild(child) { this.children.push(child); },
        set innerHTML(value) { throw new Error('User content must not enter innerHTML'); },
    };
}
const context = { window: {}, document: { createElement: element } };
vm.runInNewContext(fs.readFileSync('app/static/js/support_chat_render.js', 'utf8'), context);
const render = context.window.renderSupportMessage;

test('attack markup stays literal text, including existing stored messages', () => {
    const root = element('div');
    const payload = '<img src=x onerror=alert(document.cookie)>សួស្តី';
    render(root, { message: payload });
    assert.equal(root.children.length, 1);
    assert.equal(root.children[0].textContent, payload);
});

test('unsafe attachment URLs create no media nodes', () => {
    for (const url of ['javascript:alert(1)', '//evil.example/image.png',
                        '/static/uploads/chats/x" onerror="alert(1)']) {
        const root = element('div');
        render(root, { message: '', attachment_type: 'image', attachment_url: url });
        assert.equal(root.children.length, 1);
    }
});

test('valid uploaded images, audio and coordinates still render', () => {
    assert.equal(typeof context.window.openSupportImageFullscreen, 'function');
    for (const [kind, tag, url] of [
        ['image', 'img', '/static/uploads/chats/' + 'a'.repeat(32) + '.png'],
        ['audio', 'audio', '/static/uploads/chats/' + 'b'.repeat(32) + '.webm'],
        ['location', 'a', '11.55,104.92'],
    ]) {
        const root = element('div');
        render(root, { attachment_type: kind, attachment_url: url });
        assert.equal(root.children[1].tag, tag);
        if (tag === 'a') {
            assert.equal(root.children[1].href, 'https://maps.google.com/?q=11.55%2C104.92');
            assert.equal(root.children[1].rel, 'noopener noreferrer');
            assert.equal(root.children[1].className, 'support-location-link');
            assert.match(root.children[1].textContent, /View on Map/);
        } else if (tag === 'img') {
            assert.equal(root.children[1].src, url);
            assert.equal(root.children[1].className, 'support-chat-image');
            assert.equal(root.children[1].style.cursor, 'zoom-in');
        } else {
            assert.equal(root.children[1].src, url);
        }
    }
});


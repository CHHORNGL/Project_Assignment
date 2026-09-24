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
const context = { window: {}, document: { createElement: element }, URL };
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
        ['image', 'img', '/static/uploads/chats/' + 'a'.repeat(32) + '.JPG'],
        ['image', 'img', 'http://localhost:5000/static/uploads/chats/' + 'a'.repeat(32) + '.png?v=1'],
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

test('openSupportImageFullscreen opens valid images in dialog', () => {
    let created = null;
    const testDoc = {
        createElement(tag) {
            const el = element(tag);
            el.showModal = () => { el.open = true; };
            el.close = () => { el.open = false; };
            el.querySelector = (sel) => {
                if (sel === '.support-fullscreen-image') {
                    if (!el._img) el._img = element('img');
                    return el._img;
                }
                return null;
            };
            if (tag === 'dialog') created = el;
            return el;
        },
        body: element('body')
    };
    testDoc.getElementById = (id) => (created && created.id === id ? created : null);

    const testCtx = { window: {}, document: testDoc, URL: { pathname: '/test' } };
    vm.runInNewContext(fs.readFileSync('app/static/js/support_chat_render.js', 'utf8'), testCtx);
    const openFs = testCtx.window.openSupportImageFullscreen;

    // Call with valid URL
    const validUrl = '/static/uploads/chats/' + 'c'.repeat(32) + '.PNG';
    openFs(validUrl);
    assert.ok(created);
    assert.equal(created.tag, 'dialog');
    assert.equal(created.open, true);
    assert.equal(created.querySelector('.support-fullscreen-image').src, validUrl);
});



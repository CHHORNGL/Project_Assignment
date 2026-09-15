const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  const nodes = new Map();
  function node() {
    return { handlers: {}, value: '', files: [], disabled: false, open: false,
      setAttribute() {}, addEventListener(name, fn) {this.handlers[name] = fn;},
      querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); },
      querySelectorAll() {return [];}, replaceChildren() {}, appendChild() {},
      showModal() {this.open = true;}, close() {this.open = false; this.handlers.close?.();},
      click() {return this.handlers.click?.();} };
  }
  let dialog;
  const calls = [];
  const context = {window: {addEventListener(){}}, document: {body: node(), createElement(tag) {const n = node(); if(tag === 'dialog') dialog = n; return n;}},
    URL: {createObjectURL: ()=>'blob:test', revokeObjectURL(){}}, FormData: class {append(){}},
    clearInterval(){}, setInterval(){}, navigator: {},
    fetch: async (url, options) => {calls.push({url, options}); return {ok: true, json: async()=>url === '/upload' ? {url:'/static/uploads/chats/test.png'} : {success:true}};}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('app/static/js/support_chat_attachments.js','utf8'), context);
  const controls = {imgBtn:node(), micBtn:node(), locBtn:node(), fileInput:node()};
  let sent = 0;
  context.window.initSupportAttachments({...controls, uploadUrl:'/upload', getSendUrl:()=>'/send', onSent:()=>sent++});
  function choose() {controls.fileInput.files = [{name:'photo.png',type:'image/png'}]; controls.fileInput.handlers.change();}
  return {nodes, calls, dialog, controls, choose, sent:()=>sent};
}
test('photo selection only previews; cancel sends nothing', () => {
  const s = setup(); s.choose();
  assert.equal(s.dialog.open,true); assert.equal(s.calls.length,0);
  s.nodes.get('[data-cancel]').click();
  assert.equal(s.dialog.open,false); assert.equal(s.calls.length,0);
});
test('explicit Send uploads photo and sends caption once', async () => {
  const s = setup(); s.choose(); s.nodes.get('textarea').value = 'Rice leaf';
  const send = s.nodes.get('[data-send]');
  const first = send.click(); await send.click(); await first;
  assert.deepEqual(s.calls.map(c=>c.url), ['/upload','/send']);
  const payload = JSON.parse(s.calls[1].options.body);
  assert.equal(payload.message,'Rice leaf'); assert.equal(payload.attachment_type,'image');
  assert.equal(s.sent(),1); assert.equal(s.dialog.open,false);
});
test('voice and location failures show status without sending', async () => {
  const s = setup(); s.controls.micBtn.click();
  await s.nodes.get('[data-record]').click();
  assert.match(s.nodes.get('[role="status"]').textContent,/unavailable/);
  s.nodes.get('[data-cancel]').click(); s.controls.locBtn.click();
  assert.match(s.nodes.get('[role="status"]').textContent,/unavailable/);
  assert.equal(s.calls.length,0);
});

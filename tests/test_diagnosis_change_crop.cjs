const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const template = fs.readFileSync('app/templates/farmer/diagnose.html', 'utf8');
const render = template.slice(template.indexOf('    function renderSymptoms('), template.indexOf('    // Change crop button click'));

function setup() {
  const elements = new Map();
  function element(id) {
    const node = { id, children: [], dataset: {}, style: {}, classList: { add() {}, remove() {} },
      setAttribute() {}, addEventListener() {}, scrollIntoView() {},
      appendChild(child) { this.children.push(child); if (child.id) elements.set(child.id, child); },
      set innerHTML(value) { this.children = []; },
    };
    if (id) elements.set(id, node);
    return node;
  }
  const groups = [2, 3, 4, 5].map(id => {
    const box = element('category-' + id);
    return { querySelector: () => box };
  });
  const context = { document: { getElementById: id => elements.get(id), createElement: () => element(),
    querySelectorAll: selector => selector === '.diag-category-group' ? groups : [] },
    cropsData: { 1: [{ id: 10, name: 'Leaf spot' }], 2: [], 3: [{ id: 30, name: 'Yellow leaves' }] },
    selected: new Map(), selectedCropId: '1', isKm: false, categoryOf: () => 2,
    syncState() { context.syncs++; }, syncs: 0,
    sympSearchInput: { value: 'old search' }, sympSearchClear: { style: {} },
  };
  for (const name of ['sympCats', 'hiddenCrop', 'activeCropBanner', 'activeCropEmoji', 'activeCropName',
    'cropPickerCollapsible', 'sideCropEmoji', 'sideCropName', 'sideCropHint', 'dockCropEmoji', 'dockCropName', 'sympWrap']) context[name] = element();
  vm.createContext(context);
  vm.runInContext(render, context);
  return { context, elements, element };
}

test('populated -> empty -> populated crop preserves symptom containers and updates state', () => {
  const { context: c, elements } = setup();
  c.renderSymptoms('1');
  assert.equal(elements.get('category-2').children.length, 1);
  c.renderSymptoms('2');
  assert.equal(elements.get('category-2').children.length, 0);
  assert.equal(elements.get('symptoms-empty-message').hidden, false);
  c.renderSymptoms('3');
  assert.equal(elements.get('category-2').children[0].dataset.symptomId, 30);
  assert.equal(elements.get('symptoms-empty-message').hidden, true);
  assert.equal(c.syncs, 3);
});

test('reselecting the same crop keeps choices; different crop resets choices and search', () => {
  const { context: c, element } = setup();
  const tile = element();
  tile.dataset = { cropId: '1', cropName: 'Rice', cropEmoji: '' };
  c.selected.set('Leaf spot', { id: 10, name: 'Leaf spot' });
  c.setSelectedCrop(tile);
  assert.equal(c.selected.size, 1);
  tile.dataset.cropId = '3';
  c.setSelectedCrop(tile);
  assert.equal(c.selected.size, 0);
  assert.equal(c.hiddenCrop.value, '3');
  assert.equal(c.sympSearchInput.value, '');
});

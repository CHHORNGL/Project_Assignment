const { test } = require('node:test');
const assert = require('node:assert/strict');

test('populated -> empty -> populated crop preserves symptom containers and updates state', async () => {
  const { groupSymptomsForCrop } = await import('../src/lib/diagnosisHelpers.ts');
  const cropsData = {
    1: [{ id: 10, name: 'Leaf spot' }],
    2: [],
    3: [{ id: 30, name: 'Yellow leaves' }],
  };

  const step1 = groupSymptomsForCrop(cropsData, '1', () => 2);
  assert.equal(step1.categories[2].length, 1);
  assert.equal(step1.isEmpty, false);

  const step2 = groupSymptomsForCrop(cropsData, '2', () => 2);
  assert.equal(step2.categories[2].length, 0);
  assert.equal(step2.isEmpty, true);

  const step3 = groupSymptomsForCrop(cropsData, '3', () => 2);
  assert.equal(step3.categories[2][0].id, 30);
  assert.equal(step3.isEmpty, false);
});

test('reselecting the same crop keeps choices; different crop resets choices and search', async () => {
  const { selectCropState } = await import('../src/lib/diagnosisHelpers.ts');
  let state = {
    cropId: '1',
    selectedNames: ['Leaf spot'],
    searchQuery: 'old search',
  };

  state = selectCropState(state, '1');
  assert.equal(state.selectedNames.length, 1);
  assert.equal(state.searchQuery, 'old search');

  state = selectCropState(state, '3');
  assert.equal(state.selectedNames.length, 0);
  assert.equal(state.cropId, '3');
  assert.equal(state.searchQuery, '');
});

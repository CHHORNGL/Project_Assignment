import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleLiveEvaluation } from '../frontend/src/diagnosis/liveEvaluation.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('crop changes discard late responses and request the new crop', async () => {
  const pending = [];
  const results = [];
  let settled = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => new Promise(resolve => pending.push({ url, options, resolve }));
  const start = crop => scheduleLiveEvaluation({
    url: '/farmer/api/diagnose/live-evaluation', csrfToken: 'token',
    payload: { crop_id: crop, symptoms: ['1'], denied_symptoms: [] }, delay: 0,
    onSuccess: data => results.push(data.best), onError: assert.fail,
    onSettled: () => settled++,
  });
  try {
    const cancel = start('1');
    await tick();
    cancel();
    start('2');
    await tick();
    assert.equal(pending[0].options.signal.aborted, true);
    assert.equal(pending[1].url, '/farmer/api/diagnose/live-evaluation');
    assert.equal(JSON.parse(pending[1].options.body).crop_id, '2');
    assert.equal(pending[1].options.headers['X-CSRFToken'], 'token');
    pending[1].resolve({ ok: true, json: async () => ({ ok: true, best: 'new crop' }) });
    await tick();
    pending[0].resolve({ ok: true, json: async () => ({ ok: true, best: 'old crop' }) });
    await tick();
    assert.deepEqual(results, ['new crop']);
    assert.equal(settled, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('failed requests are visible and can be retried with identical symptoms', async () => {
  const originalFetch = globalThis.fetch;
  const errors = [];
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: false, json: async () => ({ error: 'Too many requests.' }) };
  };
  const options = { url: '/farmer/api/diagnose/live-evaluation', payload: {}, delay: 0,
    onSuccess: assert.fail, onError: error => errors.push(error.message), onSettled() {} };
  try {
    scheduleLiveEvaluation(options);
    await tick();
    scheduleLiveEvaluation(options);
    await tick();
    assert.equal(calls, 2);
    assert.deepEqual(errors, ['Too many requests.', 'Too many requests.']);
    const cancel = scheduleLiveEvaluation({ ...options, delay: 30 });
    cancel();
    await tick();
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

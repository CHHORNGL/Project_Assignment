const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const cacheKey = 'agri_weather_intel_payload_v3_en';
function snapshot(overrides = {}) {
  return { current: {temp_c: 29}, location: {latitude: 11.5564, longitude: 104.9282},
    meta: {source: 'live', lang: 'en', generated_at: new Date().toISOString()}, ...overrides };
}
async function render(response, saved) {
  const nodes = new Map();
  const storage = new Map(saved ? [[cacheKey, JSON.stringify({payload: saved})]] : []);
  const timers = new Map();
  let nextTimer = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {textContent: '', innerHTML: '', dataset: {
      weatherEndpoint: '/weather-intelligence/api/v1/summary', lang: 'en',
      fallbackLat: '11.5564', fallbackLon: '104.9282',
    }});
    return nodes.get(id);
  };
  vm.runInNewContext(fs.readFileSync('app/static/js/weather_intelligence.js', 'utf8'), {
    document: {getElementById: node}, navigator: {}, AbortController,
    window: {setTimeout(fn, ms) {timers.set(++nextTimer, {fn, ms}); return nextTimer;},
      clearTimeout(id) {timers.delete(id);}},
    localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    fetch: async () => ({ok: true, json: async () => typeof response === 'function' ? response() : response}),
  });
  await new Promise(resolve => setImmediate(resolve));
  return {node, storage, timers};
}
const limited = snapshot({current: {temp_c: null}, meta: {
  source: 'fallback', degraded: true, error_code: 'provider_rate_limited', retry_after_seconds: 900,
}});

test('rate limit shows clear status and schedules retry without caching empty values', async () => {
  const result = await render(limited);
  assert.match(result.node('wi-status').textContent, /provider limit reached/);
  assert.equal(result.node('wi-temp').textContent, '--');
  assert.equal(result.storage.size, 0);
  assert.deepEqual([...result.timers.values()].map(timer => timer.ms), [900000]);
});
test('provider fallback preserves valid browser weather and labels it as saved', async () => {
  const saved = snapshot();
  const result = await render(limited, saved);
  assert.equal(result.node('wi-temp').textContent, 29);
  assert.match(result.node('wi-status').textContent, /Showing saved weather/);
  assert.equal(JSON.parse(result.storage.get(cacheKey)).payload.meta.source, 'live');
});
test('expired browser weather is not served', async () => {
  const saved = snapshot({meta: {source: 'live', lang: 'en',
    generated_at: new Date(Date.now() - 7 * 3600000).toISOString()}});
  const result = await render(limited, saved);
  assert.equal(result.node('wi-temp').textContent, '--');
  assert.doesNotMatch(result.node('wi-status').textContent, /Showing saved weather/);
});
test('weather for a different location is not used as fallback', async () => {
  const result = await render(limited, snapshot({location: {latitude: 15, longitude: 105}}));
  assert.equal(result.node('wi-temp').textContent, '--');
});
test('successful recovery renders and caches live weather', async () => {
  const result = await render(snapshot());
  assert.equal(result.node('wi-temp').textContent, 29);
  assert.match(result.node('wi-status').textContent, /Live/);
  assert.equal(JSON.parse(result.storage.get(cacheKey)).payload.current.temp_c, 29);
  assert.equal(result.timers.size, 0);
});
test('automatic cooldown retry recovers the same open dashboard', async () => {
  let calls = 0;
  const result = await render(() => ++calls === 1 ? limited : snapshot());
  assert.match(result.node('wi-status').textContent, /provider limit reached/);
  await [...result.timers.values()][0].fn();
  assert.equal(calls, 2);
  assert.equal(result.node('wi-temp').textContent, 29);
  assert.match(result.node('wi-status').textContent, /Live/);
  assert.equal(result.timers.size, 0);
});
test('working backup shows weather with provider attribution instead of unavailable', async () => {
  const result = await render(snapshot({meta: {source: 'live', provider: 'met-norway',
    generated_at: new Date().toISOString(), degraded: false}}));
  assert.equal(result.node('wi-temp').textContent, 29);
  assert.match(result.node('wi-status').textContent, /MET Norway forecast/);
  assert.doesNotMatch(result.node('wi-status').textContent, /unavailable|limit reached/);
  assert.match(result.node('wi-attribution').innerHTML, /Forecast adapted from/);
  assert.match(result.node('wi-attribution').innerHTML, /https:\/\/www.met.no\/en/);
  assert.match(result.node('wi-attribution').innerHTML, /creativecommons.org/);
});

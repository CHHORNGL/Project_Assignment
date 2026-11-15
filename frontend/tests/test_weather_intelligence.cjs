const { test } = require('node:test');
const assert = require('node:assert/strict');

const cacheKey = 'agri_weather_intel_payload_v3_en';
const coords = { lat: 11.5564, lon: 104.9282 };

function snapshot(overrides = {}) {
  return {
    current: { temp_c: 29 },
    location: { latitude: 11.5564, longitude: 104.9282 },
    meta: { source: 'live', lang: 'en', generated_at: new Date().toISOString() },
    ...overrides,
  };
}

function makeStorage(saved) {
  const store = new Map(saved ? [[cacheKey, JSON.stringify({ payload: saved })]] : []);
  return {
    map: store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
}

const limited = snapshot({
  current: { temp_c: null },
  meta: {
    source: 'fallback',
    degraded: true,
    error_code: 'provider_rate_limited',
    retry_after_seconds: 900,
  },
});

test('rate limit shows clear status and schedules retry without caching empty values', async () => {
  const { loadCachedWeatherPayload, saveCachedWeatherPayload, resolveWeatherOutcome } = await import(
    '../src/lib/weatherHelpers.ts'
  );
  const storage = makeStorage();
  const saved = loadCachedWeatherPayload(storage, 'en', coords);
  const outcome = resolveWeatherOutcome(limited, saved, 'en');
  saveCachedWeatherPayload(storage, 'en', limited);

  assert.match(outcome.statusText, /provider limit reached/);
  assert.equal(outcome.displayPayload.current.temp_c, null);
  assert.equal(storage.map.size, 0);
  assert.equal(outcome.retryDelayMs, 900000);
});

test('provider fallback preserves valid browser weather and labels it as saved', async () => {
  const { loadCachedWeatherPayload, saveCachedWeatherPayload, resolveWeatherOutcome } = await import(
    '../src/lib/weatherHelpers.ts'
  );
  const storage = makeStorage(snapshot());
  const saved = loadCachedWeatherPayload(storage, 'en', coords);
  const outcome = resolveWeatherOutcome(limited, saved, 'en');
  saveCachedWeatherPayload(storage, 'en', limited);

  assert.equal(outcome.displayPayload.current.temp_c, 29);
  assert.match(outcome.statusText, /Showing saved weather/);
  assert.equal(JSON.parse(storage.map.get(cacheKey)).payload.meta.source, 'live');
});

test('expired browser weather is not served', async () => {
  const { loadCachedWeatherPayload, resolveWeatherOutcome } = await import('../src/lib/weatherHelpers.ts');
  const expired = snapshot({
    meta: { source: 'live', lang: 'en', generated_at: new Date(Date.now() - 7 * 3600000).toISOString() },
  });
  const storage = makeStorage(expired);
  const saved = loadCachedWeatherPayload(storage, 'en', coords);
  const outcome = resolveWeatherOutcome(limited, saved, 'en');

  assert.equal(saved, null);
  assert.equal(outcome.displayPayload.current.temp_c, null);
  assert.doesNotMatch(outcome.statusText, /Showing saved weather/);
});

test('weather for a different location is not used as fallback', async () => {
  const { loadCachedWeatherPayload, resolveWeatherOutcome } = await import('../src/lib/weatherHelpers.ts');
  const storage = makeStorage(snapshot({ location: { latitude: 15, longitude: 105 } }));
  const saved = loadCachedWeatherPayload(storage, 'en', coords);
  const outcome = resolveWeatherOutcome(limited, saved, 'en');

  assert.equal(saved, null);
  assert.equal(outcome.displayPayload.current.temp_c, null);
});

test('successful recovery renders and caches live weather', async () => {
  const { loadCachedWeatherPayload, saveCachedWeatherPayload, resolveWeatherOutcome } = await import(
    '../src/lib/weatherHelpers.ts'
  );
  const storage = makeStorage();
  const live = snapshot();
  const saved = loadCachedWeatherPayload(storage, 'en', coords);
  const outcome = resolveWeatherOutcome(live, saved, 'en');
  saveCachedWeatherPayload(storage, 'en', live);

  assert.equal(outcome.displayPayload.current.temp_c, 29);
  assert.match(outcome.statusText, /Live/);
  assert.equal(JSON.parse(storage.map.get(cacheKey)).payload.current.temp_c, 29);
  assert.equal(outcome.retryDelayMs, null);
});

test('automatic cooldown retry recovers the same open dashboard', async () => {
  const { resolveWeatherOutcome, saveCachedWeatherPayload } = await import('../src/lib/weatherHelpers.ts');
  const storage = makeStorage();
  const first = resolveWeatherOutcome(limited, null, 'en');
  assert.match(first.statusText, /provider limit reached/);
  assert.equal(first.retryDelayMs, 900000);

  const live = snapshot();
  const second = resolveWeatherOutcome(live, null, 'en');
  saveCachedWeatherPayload(storage, 'en', live);
  assert.equal(second.displayPayload.current.temp_c, 29);
  assert.match(second.statusText, /Live/);
  assert.equal(second.retryDelayMs, null);
});

test('working backup shows weather with provider attribution instead of unavailable', async () => {
  const { resolveWeatherOutcome } = await import('../src/lib/weatherHelpers.ts');
  const backup = snapshot({
    meta: {
      source: 'live',
      provider: 'met-norway',
      generated_at: new Date().toISOString(),
      degraded: false,
    },
  });
  const outcome = resolveWeatherOutcome(backup, null, 'en');

  assert.equal(outcome.displayPayload.current.temp_c, 29);
  assert.match(outcome.statusText, /MET Norway forecast/);
  assert.doesNotMatch(outcome.statusText, /unavailable|limit reached/);
  assert.equal(outcome.attribution.prefix, 'Forecast adapted from');
  assert.equal(outcome.attribution.providerUrl, 'https://www.met.no/en');
  assert.match(outcome.attribution.licenseUrl, /creativecommons\.org/);
});

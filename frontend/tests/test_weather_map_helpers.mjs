import test from 'node:test';
import assert from 'node:assert/strict';

test('buildWindyEmbedUrl encodes active weather overlay, coordinates, model, and isobars', async () => {
  const { buildWindyEmbedUrl, WEATHER_LAYERS } = await import('../src/lib/weatherMapHelpers.ts');

  const layerKeys = WEATHER_LAYERS.map((l) => l.key);
  assert.ok(layerKeys.includes('wind'));
  assert.ok(layerKeys.includes('temp'));
  assert.ok(layerKeys.includes('rh'));
  assert.ok(layerKeys.includes('rain'));
  assert.ok(layerKeys.includes('cape'));

  const tempUrl = new URL(
    buildWindyEmbedUrl({ lat: 11.5564, lon: 104.9282, zoom: 7, overlay: 'temp', product: 'ecmwf', showPressure: true }),
  );
  assert.equal(tempUrl.origin, 'https://embed.windy.com');
  assert.equal(tempUrl.searchParams.get('overlay'), 'temp');
  assert.equal(tempUrl.searchParams.get('pressure'), 'true');
  assert.equal(tempUrl.searchParams.get('zoom'), '7');

  const radarUrl = new URL(
    buildWindyEmbedUrl({ lat: 35.6762, lon: 139.6503, zoom: 4, overlay: 'radar', showPressure: true }),
  );
  assert.equal(radarUrl.searchParams.get('overlay'), 'radar');
  assert.equal(radarUrl.searchParams.get('pressure'), 'false');
});

test('formatWindCardinal and getTemperatureBand classify bearings and cold/hot states', async () => {
  const { formatWindCardinal, getTemperatureBand } = await import('../src/lib/weatherMapHelpers.ts');

  assert.equal(formatWindCardinal(0), 'N');
  assert.equal(formatWindCardinal(45), 'NE');
  assert.equal(formatWindCardinal(225), 'SW');
  assert.equal(formatWindCardinal(359), 'N');
  assert.equal(formatWindCardinal(null), '—');

  assert.equal(getTemperatureBand(5).label, 'Cold');
  assert.equal(getTemperatureBand(20).label, 'Cool');
  assert.equal(getTemperatureBand(28).label, 'Warm');
  assert.equal(getTemperatureBand(36).label, 'Hot');
});

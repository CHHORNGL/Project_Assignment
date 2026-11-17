import test from 'node:test';
import assert from 'node:assert/strict';

test('3D hero framing avoids frustum clipping across narrow, square, and wide viewports', async () => {
  const {
    computeEffectiveModelRadius,
    computeHeroCameraDistance,
    computeHeroCameraCoords,
  } = await import('../src/lib/modelShowcaseHelpers.ts');

  const radius = computeEffectiveModelRadius(1.963, 1.98, 1.039);
  assert.ok(radius >= 1.0 && radius <= 1.25);

  const fovDeg = 32;
  const vFovRad = (fovDeg * Math.PI) / 180;

  for (const aspect of [0.65, 1.0, 1.6]) {
    const dist = computeHeroCameraDistance(radius, fovDeg, aspect);
    const halfV = dist * Math.tan(vFovRad / 2);
    const halfH = halfV * aspect;

    assert.ok(halfV > radius, `Vertical frustum half-span (${halfV}) must exceed radius (${radius}) at aspect ${aspect}`);
    assert.ok(halfH > radius, `Horizontal frustum half-span (${halfH}) must exceed radius (${radius}) at aspect ${aspect}`);

    const [x, y, z] = computeHeroCameraCoords(dist);
    assert.ok(x > 0 && z > 0 && y > 0, 'Hero camera should frame +X/+Z 3/4 portrait toward hero typography');
  }
});

test('Light and Dark studio lighting presets separate surface highlights and rim accents cleanly', async () => {
  const { getStudioLightingPreset } = await import('../src/lib/modelShowcaseHelpers.ts');

  const light = getStudioLightingPreset(false);
  const dark = getStudioLightingPreset(true);

  assert.ok(light.toneMappingExposure < dark.toneMappingExposure, 'Light mode prevents white ceramic blowout');
  assert.ok(light.shadowOpacity > dark.shadowOpacity, 'Light mode casts firmer ground shadow');
  assert.ok(dark.rimIntensity > light.rimIntensity, 'Dark mode accentuates rim silhouette against dark ground');
  assert.equal(dark.rimColor, 0x38bdf8);
});

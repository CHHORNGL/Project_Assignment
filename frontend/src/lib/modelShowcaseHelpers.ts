export const HERO_AZIMUTH = 0.44;
export const HERO_ELEVATION = 0.12;
export const TARGET_Y_OFFSET = 0.0;

export interface StudioLightingPreset {
  toneMappingExposure: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  keyColor: number;
  keyIntensity: number;
  fillColor: number;
  fillIntensity: number;
  rimColor: number;
  rimIntensity: number;
  shadowOpacity: number;
  stageOpacity: number;
}

/**
 * Return studio exposure, directional lights, and floor-shadow weights tuned
 * to separate bright armor panels in both Light and Dark themes.
 */
export function getStudioLightingPreset(isDark: boolean): StudioLightingPreset {
  if (isDark) {
    return {
      toneMappingExposure: 1.06,
      hemiSkyColor: 0xf1f5f9,
      hemiGroundColor: 0x1e293b,
      hemiIntensity: 0.62,
      keyColor: 0xf8fafc,
      keyIntensity: 1.85,
      fillColor: 0xcbd5e1,
      fillIntensity: 0.72,
      rimColor: 0x38bdf8,
      rimIntensity: 1.45,
      shadowOpacity: 0.06,
      stageOpacity: 0.92,
    };
  }

  return {
    toneMappingExposure: 0.94,
    hemiSkyColor: 0xffffff,
    hemiGroundColor: 0xcbd5e1,
    hemiIntensity: 0.56,
    keyColor: 0xfffaf3,
    keyIntensity: 1.52,
    fillColor: 0xdbeafe,
    fillIntensity: 0.85,
    rimColor: 0x93c5fd,
    rimIntensity: 1.1,
    shadowOpacity: 0.11,
    stageOpacity: 0.88,
  };
}

/**
 * Compute an effective silhouette radius from normalized box dimensions so
 * tall portraits fill the frame without wide diagonal corners dwarfing them.
 */
export function computeEffectiveModelRadius(
  width: number,
  height: number,
  depth: number,
): number {
  return Math.max(height * 0.54, Math.hypot(width, depth) * 0.5, 0.85);
}

/**
 * Calculate camera distance guaranteeing zero vertical or horizontal frustum
 * clipping for any container aspect ratio.
 */
export function computeHeroCameraDistance(
  effectiveRadius: number,
  fovDeg: number,
  aspect: number,
): number {
  const safeAspect = Math.max(aspect, 0.48);
  const vFovRad = (fovDeg * Math.PI) / 180;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * safeAspect);
  const limitingHalfFov = Math.min(vFovRad, hFovRad) * 0.5;
  const margin = safeAspect < 1 ? 1.28 : 1.24;
  return (effectiveRadius / Math.sin(limitingHalfFov)) * margin;
}

/**
 * Return initial editorial 3/4 portrait coordinates facing slightly left toward
 * hero typography while framing the subject comfortably above bottom controls.
 */
export function computeHeroCameraCoords(
  distance: number,
  targetY: number = TARGET_Y_OFFSET,
): [number, number, number] {
  const cosElev = Math.cos(HERO_ELEVATION);
  return [
    Math.sin(HERO_AZIMUTH) * cosElev * distance,
    Math.sin(HERO_ELEVATION) * distance + targetY,
    Math.cos(HERO_AZIMUTH) * cosElev * distance,
  ];
}

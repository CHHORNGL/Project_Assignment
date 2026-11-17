import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  TARGET_Y_OFFSET,
  computeEffectiveModelRadius,
  computeHeroCameraCoords,
  computeHeroCameraDistance,
  getStudioLightingPreset,
} from "@/lib/modelShowcaseHelpers";

interface InteractiveModelShowcaseProps {
  modelUrl: string;
  isKhmer: boolean;
  isDark?: boolean;
  className?: string;
}

interface StudioSceneRig {
  THREE: typeof import("three");
  renderer: import("three").WebGLRenderer;
  hemiLight: import("three").HemisphereLight;
  keyLight: import("three").DirectionalLight;
  fillLight: import("three").DirectionalLight;
  rimLight: import("three").DirectionalLight;
  shadowPlaneMat: import("three").ShadowMaterial;
  stageDiscMat: import("three").MeshBasicMaterial;
  lightStageTex: import("three").CanvasTexture;
  darkStageTex: import("three").CanvasTexture;
}

function detectDocumentDark(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains("dark-mode") ||
    document.documentElement.classList.contains("dark")
  );
}

function createStageDiscTexture(
  THREE: typeof import("three"),
  dark: boolean,
): import("three").CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    if (dark) {
      grad.addColorStop(0.0, "rgba(56, 189, 248, 0.20)");
      grad.addColorStop(0.28, "rgba(148, 163, 184, 0.14)");
      grad.addColorStop(0.58, "rgba(56, 189, 248, 0.05)");
      grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    } else {
      grad.addColorStop(0.0, "rgba(15, 23, 42, 0.16)");
      grad.addColorStop(0.32, "rgba(15, 23, 42, 0.09)");
      grad.addColorStop(0.65, "rgba(51, 65, 85, 0.025)");
      grad.addColorStop(1.0, "rgba(15, 23, 42, 0)");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(half, half, half * 0.64, 0, Math.PI * 2);
    ctx.strokeStyle = dark
      ? "rgba(125, 211, 252, 0.16)"
      : "rgba(15, 23, 42, 0.07)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function applyThemeToRig(rig: StudioSceneRig, dark: boolean) {
  const preset = getStudioLightingPreset(dark);
  const { renderer, hemiLight, keyLight, fillLight, rimLight, shadowPlaneMat, stageDiscMat } = rig;

  renderer.toneMappingExposure = preset.toneMappingExposure;
  hemiLight.color.setHex(preset.hemiSkyColor);
  hemiLight.groundColor.setHex(preset.hemiGroundColor);
  hemiLight.intensity = preset.hemiIntensity;

  keyLight.color.setHex(preset.keyColor);
  keyLight.intensity = preset.keyIntensity;

  fillLight.color.setHex(preset.fillColor);
  fillLight.intensity = preset.fillIntensity;

  rimLight.color.setHex(preset.rimColor);
  rimLight.intensity = preset.rimIntensity;

  shadowPlaneMat.opacity = preset.shadowOpacity;
  stageDiscMat.map = dark ? rig.darkStageTex : rig.lightStageTex;
  stageDiscMat.opacity = preset.stageOpacity;
  stageDiscMat.needsUpdate = true;
}

export function InteractiveModelShowcase({
  modelUrl,
  isKhmer,
  isDark: isDarkProp,
  className,
}: InteractiveModelShowcaseProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<StudioSceneRig | null>(null);

  const [docDark, setDocDark] = useState<boolean>(() => detectDocumentDark());
  const resolvedDark = isDarkProp ?? docDark;
  const darkRef = useRef(resolvedDark);
  darkRef.current = resolvedDark;

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number>(8);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
      : false,
  );

  useEffect(() => {
    if (isDarkProp !== undefined || typeof document === "undefined") return;
    const sync = () => setDocDark(detectDocumentDark());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [isDarkProp]);

  useEffect(() => {
    if (rigRef.current) {
      applyThemeToRig(rigRef.current, resolvedDark);
    }
  }, [resolvedDark]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      setReducedMotion(mql.matches);
    };
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    const outerContainer = containerRef.current;
    if (!container || !outerContainer) return;

    let disposed = false;
    let rafId = 0;
    let cleanupFn: (() => void) | null = null;

    setReady(false);
    setFailed(false);
    setLoadProgress(8);

    void (async () => {
      try {
        const [
          THREE,
          { GLTFLoader },
          { OrbitControls },
          { RoomEnvironment },
        ] = await Promise.all([
          import("three"),
          import("three/examples/jsm/loaders/GLTFLoader.js"),
          import("three/examples/jsm/controls/OrbitControls.js"),
          import("three/examples/jsm/environments/RoomEnvironment.js"),
        ]);

        if (disposed) return;

        const width = Math.max(container.clientWidth, 260);
        const height = Math.max(container.clientHeight, 260);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        container.innerHTML = "";
        renderer.domElement.style.display = "block";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.setAttribute(
          "aria-label",
          isKhmer ? "គំរូ 3D អន្តរកម្ម" : "Interactive 3D AI agronomy model",
        );
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();

        const pmrem = new THREE.PMREMGenerator(renderer);
        const roomEnv = new RoomEnvironment();
        const envRT = pmrem.fromScene(roomEnv, 0.06);
        scene.environment = envRT.texture;
        roomEnv.dispose();

        const camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 100);
        let boundRadius = 1.08;
        let targetScaleFinal = 1;
        let heroDistance = computeHeroCameraDistance(boundRadius, camera.fov, width / height);
        const heroTarget = new THREE.Vector3(0, TARGET_Y_OFFSET, 0);
        camera.position.set(...computeHeroCameraCoords(heroDistance, TARGET_Y_OFFSET));

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.055;
        // Disable wheel zoom so hero scrolling stays smooth down the landing page.
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.minPolarAngle = Math.PI * 0.24;
        controls.maxPolarAngle = Math.PI * 0.68;
        controls.autoRotateSpeed = 0.85;
        controls.target.copy(heroTarget);
        controls.update();

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.56);
        scene.add(hemiLight);

        const keyLight = new THREE.DirectionalLight(0xfffaf3, 1.52);
        keyLight.position.set(3.2, 4.8, 3.8);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.bias = -0.0004;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 16;
        keyLight.shadow.camera.left = -2.2;
        keyLight.shadow.camera.right = 2.2;
        keyLight.shadow.camera.top = 2.2;
        keyLight.shadow.camera.bottom = -2.2;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.85);
        fillLight.position.set(-4.2, 1.8, 2.2);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.1);
        rimLight.position.set(-1.5, 3.0, -4.5);
        scene.add(rimLight);

        const lightStageTex = createStageDiscTexture(THREE, false);
        const darkStageTex = createStageDiscTexture(THREE, true);

        const stageDiscGeo = new THREE.CircleGeometry(1.55, 64);
        const stageDiscMat = new THREE.MeshBasicMaterial({
          map: lightStageTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.88,
        });
        const stageDisc = new THREE.Mesh(stageDiscGeo, stageDiscMat);
        stageDisc.rotation.x = -Math.PI / 2;
        stageDisc.position.y = -1.04;
        scene.add(stageDisc);

        const shadowPlaneGeo = new THREE.CircleGeometry(1.45, 48);
        const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.11 });
        const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = -1.035;
        shadowPlane.receiveShadow = true;
        scene.add(shadowPlane);

        const rig: StudioSceneRig = {
          THREE,
          renderer,
          hemiLight,
          keyLight,
          fillLight,
          rimLight,
          shadowPlaneMat,
          stageDiscMat,
          lightStageTex,
          darkStageTex,
        };
        rigRef.current = rig;
        applyThemeToRig(rig, darkRef.current);

        const modelPivot = new THREE.Group();
        scene.add(modelPivot);

        let loadedRoot: import("three").Object3D | null = null;
        let loadReadyTime = 0;
        let isDragging = false;
        let contextLost = false;
        let isViewportVisible = true;
        let isTabVisible =
          typeof document === "undefined" || document.visibilityState === "visible";

        const pointerTarget = { x: 0, y: 0 };
        const pointerCurrent = { x: 0, y: 0 };

        const updateHeroFit = (viewportW: number, viewportH: number, snapCamera = false) => {
          const aspect = viewportW / viewportH;
          heroDistance = computeHeroCameraDistance(boundRadius, camera.fov, aspect);
          if (snapCamera) {
            camera.position.set(...computeHeroCameraCoords(heroDistance, TARGET_Y_OFFSET));
            controls.target.copy(heroTarget);
            controls.update();
          }
        };

        const startRenderLoop = () => {
          if (disposed || rafId !== 0 || contextLost || !isViewportVisible || !isTabVisible) {
            return;
          }
          let prevTime = performance.now();
          let elapsed = 0;

          const tick = (now: number) => {
            if (disposed || contextLost || !isViewportVisible || !isTabVisible) {
              rafId = 0;
              return;
            }
            rafId = window.requestAnimationFrame(tick);
            const dt = Math.min((now - prevTime) / 1000, 0.05);
            prevTime = now;
            elapsed += dt;

            if (loadedRoot) {
              if (loadReadyTime > 0) {
                const age = Math.min((now - loadReadyTime) / 700, 1);
                const ease = 1 - Math.pow(1 - age, 3);
                const s = THREE.MathUtils.lerp(0.93, 1, ease);
                modelPivot.scale.setScalar(s);
              }

              const allowIdleMotion = !reducedMotion && !isDragging;
              const bobOffset = allowIdleMotion ? Math.sin(elapsed * 1.15) * 0.022 : 0;
              modelPivot.position.y = bobOffset;
              const discPulse = allowIdleMotion ? 1 - Math.sin(elapsed * 1.15) * 0.025 : 1;
              stageDisc.scale.setScalar(discPulse);

              const damp = 1 - Math.exp(-6 * dt);
              pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * damp;
              pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * damp;
              modelPivot.rotation.y = pointerCurrent.x * 0.12;
              modelPivot.rotation.x = pointerCurrent.y * 0.06;
            }

            controls.autoRotate = Boolean(loadedRoot && !reducedMotion && !isDragging);
            controls.update();
            renderer.render(scene, camera);
          };

          rafId = window.requestAnimationFrame(tick);
        };

        const stopRenderLoop = () => {
          if (rafId !== 0) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
          }
        };

        const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

        const loader = new GLTFLoader();
        loader.load(
          modelUrl,
          (gltf) => {
            if (disposed) return;

            const root = gltf.scene;
            const rawBox = new THREE.Box3().setFromObject(root);
            const rawSize = rawBox.getSize(new THREE.Vector3());
            const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);
            targetScaleFinal = 1.98 / maxDim;

            root.scale.multiplyScalar(targetScaleFinal);
            root.updateMatrixWorld(true);

            const scaledBox = new THREE.Box3().setFromObject(root);
            const center = scaledBox.getCenter(new THREE.Vector3());
            root.position.sub(center);
            root.updateMatrixWorld(true);

            const centeredBox = new THREE.Box3().setFromObject(root);
            const centeredSize = centeredBox.getSize(new THREE.Vector3());
            boundRadius = computeEffectiveModelRadius(
              centeredSize.x,
              centeredSize.y,
              centeredSize.z,
            );

            const stageY = centeredBox.min.y - 0.045;
            stageDisc.position.y = stageY;
            shadowPlane.position.y = stageY + 0.005;

            root.traverse((obj) => {
              if (obj instanceof THREE.Mesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach((mat) => {
                  if (!mat) return;
                  if ("envMapIntensity" in mat && typeof mat.envMapIntensity === "number") {
                    mat.envMapIntensity = 0.82;
                  }
                  const mapKeys = [
                    "map",
                    "normalMap",
                    "roughnessMap",
                    "metalnessMap",
                    "emissiveMap",
                    "aoMap",
                  ] as const;
                  for (const k of mapKeys) {
                    const tex = (mat as unknown as Record<string, unknown>)[k];
                    if (tex instanceof THREE.Texture) {
                      tex.anisotropy = maxAnisotropy;
                    }
                  }
                });
              }
            });

            modelPivot.scale.setScalar(0.93);
            modelPivot.add(root);
            loadedRoot = root;
            loadReadyTime = performance.now();

            const rect = container.getBoundingClientRect();
            updateHeroFit(
              Math.max(rect.width, 260),
              Math.max(rect.height, 260),
              true,
            );
            setLoadProgress(100);
            setReady(true);
            startRenderLoop();
          },
          (xhr) => {
            if (disposed) return;
            if (xhr.lengthComputable && xhr.total > 0) {
              const pct = Math.min(96, Math.max(10, Math.round((xhr.loaded / xhr.total) * 100)));
              setLoadProgress(pct);
            }
          },
          () => {
            if (!disposed) {
              setFailed(true);
              setReady(false);
            }
          },
        );

        const onControlsStart = () => {
          isDragging = true;
        };
        const onControlsEnd = () => {
          isDragging = false;
        };
        controls.addEventListener("start", onControlsStart);
        controls.addEventListener("end", onControlsEnd);

        const onPointerMove = (e: PointerEvent) => {
          if (reducedMotion || isDragging) return;
          const rect = outerContainer.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
          pointerTarget.x = Math.max(-1, Math.min(1, nx));
          pointerTarget.y = Math.max(-1, Math.min(1, ny));
        };
        const onPointerLeave = () => {
          pointerTarget.x = 0;
          pointerTarget.y = 0;
        };
        outerContainer.addEventListener("pointermove", onPointerMove, { passive: true });
        outerContainer.addEventListener("pointerleave", onPointerLeave, { passive: true });

        const onContextLost = (e: Event) => {
          e.preventDefault();
          contextLost = true;
          stopRenderLoop();
        };
        const onContextRestored = () => {
          contextLost = false;
          startRenderLoop();
        };
        renderer.domElement.addEventListener("webglcontextlost", onContextLost);
        renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

        const onVisibilityChange = () => {
          isTabVisible = document.visibilityState === "visible";
          if (isTabVisible) {
            startRenderLoop();
          } else {
            stopRenderLoop();
          }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        const intersectionObserver = new IntersectionObserver(
          (entries) => {
            isViewportVisible = entries[0]?.isIntersecting ?? true;
            if (isViewportVisible) {
              startRenderLoop();
            } else {
              stopRenderLoop();
            }
          },
          { threshold: 0.05 },
        );
        intersectionObserver.observe(outerContainer);

        const resizeObserver = new ResizeObserver((entries) => {
          const rect = entries[0]?.contentRect;
          if (!rect || rect.width < 10 || rect.height < 10) return;
          camera.aspect = rect.width / rect.height;
          camera.updateProjectionMatrix();
          renderer.setSize(rect.width, rect.height);
          const currentDist = camera.position.distanceTo(controls.target);
          const minNeededDist = computeHeroCameraDistance(
            boundRadius,
            camera.fov,
            camera.aspect,
          );
          heroDistance = minNeededDist;
          if (currentDist < minNeededDist * 0.96) {
            const dir = camera.position.clone().sub(controls.target).normalize();
            camera.position.copy(controls.target).addScaledVector(dir, minNeededDist);
            controls.update();
          }
        });
        resizeObserver.observe(container);

        startRenderLoop();

        cleanupFn = () => {
          stopRenderLoop();
          rigRef.current = null;
          resizeObserver.disconnect();
          intersectionObserver.disconnect();
          document.removeEventListener("visibilitychange", onVisibilityChange);
          outerContainer.removeEventListener("pointermove", onPointerMove);
          outerContainer.removeEventListener("pointerleave", onPointerLeave);
          renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
          renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
          controls.removeEventListener("start", onControlsStart);
          controls.removeEventListener("end", onControlsEnd);
          controls.dispose();
          if (loadedRoot) {
            loadedRoot.traverse((obj) => {
              if (obj instanceof THREE.Mesh) {
                obj.geometry?.dispose();
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach((mat) => {
                  if (!mat) return;
                  Object.values(mat).forEach((value) => {
                    if (value instanceof THREE.Texture) {
                      value.dispose();
                    }
                  });
                  mat.dispose();
                });
              }
            });
          }
          stageDiscGeo.dispose();
          stageDiscMat.dispose();
          lightStageTex.dispose();
          darkStageTex.dispose();
          shadowPlaneGeo.dispose();
          shadowPlaneMat.dispose();
          envRT.dispose();
          pmrem.dispose();
          renderer.dispose();
          if (renderer.domElement.parentElement === container) {
            container.removeChild(renderer.domElement);
          }
        };
      } catch {
        if (!disposed) {
          setFailed(true);
          setReady(false);
        }
      }
    })();

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (cleanupFn) cleanupFn();
    };
  }, [modelUrl, isKhmer, reducedMotion]);

  return (
    <div
      id="nxModelShowcase"
      ref={containerRef}
      className={cn(
        "group/stage relative w-full select-none",
        className || "h-[340px] sm:h-[420px] lg:h-[480px]",
      )}
    >
      {/* Borderless Studio Ambient Aura harmonizing 3D model tones with page surface */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-4 rounded-full transition-opacity duration-700",
          ready ? "opacity-100" : "opacity-55",
          resolvedDark
            ? "bg-[radial-gradient(circle_at_50%_46%,_rgba(56,189,248,0.16),_rgba(148,163,184,0.06)_48%,_transparent_74%)]"
            : "bg-[radial-gradient(circle_at_50%_48%,_rgba(14,165,233,0.09),_rgba(15,23,42,0.04)_48%,_transparent_74%)]",
        )}
      />

      {/* Progressive Borderless Loader Ring before GLB completes streaming */}
      {!ready && !failed && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
        >
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/75 shadow-sm ring-1 ring-black/10 backdrop-blur-md dark:bg-neutral-900/75 dark:ring-white/10">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
              <circle
                cx="24"
                cy="24"
                r="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-neutral-200 dark:text-neutral-800"
              />
              <circle
                cx="24"
                cy="24"
                r="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={119.38}
                strokeDashoffset={119.38 * (1 - loadProgress / 100)}
                className="text-sky-500 transition-[stroke-dashoffset] duration-300 dark:text-sky-400"
              />
            </svg>
            <span className="absolute text-[10px] font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
              {loadProgress}%
            </span>
          </div>
          <span className="text-[11px] font-medium tracking-wide text-neutral-500 dark:text-neutral-400">
            {isKhmer ? "កំពុងផ្ទុកគំរូ 3D..." : "Initializing 3D Studio..."}
          </span>
        </div>
      )}

      {/* WebGL Canvas Mount */}
      <div
        ref={mountRef}
        className={cn(
          "relative z-10 h-full w-full cursor-grab transition-opacity duration-700 active:cursor-grabbing",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

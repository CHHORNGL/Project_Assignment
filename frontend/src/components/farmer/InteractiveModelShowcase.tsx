import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface InteractiveModelShowcaseProps {
  modelUrl: string;
  isKhmer: boolean;
  className?: string;
}

export function InteractiveModelShowcase({
  modelUrl,
  isKhmer,
  className,
}: InteractiveModelShowcaseProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let rafId = 0;
    let cleanupFn: (() => void) | null = null;

    setReady(false);

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
        renderer.toneMappingExposure = 1.08;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        container.innerHTML = "";
        renderer.domElement.style.display = "block";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.setAttribute(
          "aria-label",
          isKhmer ? "គំរូ 3D អន្តរកម្ម" : "Interactive 3D print model",
        );
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();

        const pmrem = new THREE.PMREMGenerator(renderer);
        const roomEnv = new RoomEnvironment();
        const envRT = pmrem.fromScene(roomEnv, 0.04);
        scene.environment = envRT.texture;
        roomEnv.dispose();

        const camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 100);
        camera.position.set(2.35, 1.35, 2.55);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        // Disable wheel zoom so hero scrolling stays smooth down the landing page.
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.maxPolarAngle = Math.PI * 0.85;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.2;
        controls.target.set(0, 0, 0);
        controls.update();

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x737373, 0.65);
        scene.add(hemiLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
        keyLight.position.set(3.5, 5.5, 4.0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.bias = -0.0005;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xe5e5e5, 0.75);
        fillLight.position.set(-4.0, 2.0, -3.0);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.85);
        rimLight.position.set(0.0, 3.5, -5.0);
        scene.add(rimLight);

        const shadowPlaneGeo = new THREE.CircleGeometry(1.75, 48);
        const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.14 });
        const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = -1.25;
        shadowPlane.receiveShadow = true;
        scene.add(shadowPlane);

        const loader = new GLTFLoader();
        let loadedRoot: import("three").Object3D | null = null;

        loader.load(
          modelUrl,
          (gltf) => {
            if (disposed) return;

            const root = gltf.scene;
            const rawBox = new THREE.Box3().setFromObject(root);
            const rawSize = rawBox.getSize(new THREE.Vector3());
            const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);
            const targetScale = 2.45 / maxDim;

            root.scale.multiplyScalar(targetScale);
            root.updateMatrixWorld(true);

            const scaledBox = new THREE.Box3().setFromObject(root);
            const center = scaledBox.getCenter(new THREE.Vector3());
            root.position.sub(center);
            root.updateMatrixWorld(true);

            const finalBox = new THREE.Box3().setFromObject(root);
            shadowPlane.position.y = finalBox.min.y - 0.04;

            root.traverse((obj) => {
              if (obj instanceof THREE.Mesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
              }
            });

            scene.add(root);
            loadedRoot = root;
            setReady(true);
          },
          undefined,
          () => {
            // Keep hero completely clean if the 3D asset fails in a restricted viewer.
            if (!disposed) setReady(false);
          },
        );

        const resizeObserver = new ResizeObserver((entries) => {
          const rect = entries[0]?.contentRect;
          if (!rect || rect.width < 10 || rect.height < 10) return;
          camera.aspect = rect.width / rect.height;
          camera.updateProjectionMatrix();
          renderer.setSize(rect.width, rect.height);
        });
        resizeObserver.observe(container);

        const renderLoop = () => {
          if (disposed) return;
          rafId = window.requestAnimationFrame(renderLoop);
          controls.update();
          renderer.render(scene, camera);
        };
        renderLoop();

        cleanupFn = () => {
          resizeObserver.disconnect();
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
        if (!disposed) setReady(false);
      }
    })();

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (cleanupFn) cleanupFn();
    };
  }, [modelUrl, isKhmer]);

  return (
    <div
      id="nxModelShowcase"
      className={cn(
        "relative w-full select-none transition-opacity duration-500",
        ready ? "opacity-100" : "opacity-0",
        className || "h-[300px] sm:h-[360px] lg:h-[430px]",
      )}
    >
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}

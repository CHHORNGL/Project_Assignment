(function () {
    const config = window.AuthThemeMotionConfig || {};
    const state = {
        root: null,
        instances: [],
        signature: "",
        layoutKey: "",
        layers: [],
        scriptPromise: null,
        resizeTimer: null,
    };

    function clamp(number, min, max) {
        return Math.min(max, Math.max(min, number));
    }

    function toNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function toBool(value, fallback = true) {
        if (value === undefined || value === null) return !!fallback;
        const text = String(value).trim().toLowerCase();
        if (["1", "true", "yes", "on"].includes(text)) return true;
        if (["0", "false", "no", "off"].includes(text)) return false;
        return !!fallback;
    }

    function normalizeLayer(raw, index = 1) {
        if (!raw || typeof raw !== "object") return null;
        const url = String(raw.url || "").trim();
        if (!url) return null;
        const placementRaw = String(raw.placement || "auth_bg").trim().toLowerCase();
        const placement = ["auth_bg", "viewport", "topbar", "topbar_xy", "sidebar"].includes(placementRaw)
            ? placementRaw
            : "auth_bg";
        const scrollModeRaw = String(raw.scroll_mode || raw.behavior || "fixed").trim().toLowerCase();
        const scrollMode = placement === "viewport" && scrollModeRaw === "scroll"
            ? "scroll"
            : "fixed";
        const maxSize = (placement === "viewport" || placement === "auth_bg") ? 960 : 320;
        const idRaw = String(raw.id || `auth_layer_${index}`).trim().toLowerCase();
        const id = idRaw.replace(/[^a-z0-9_-]/g, "").slice(0, 40) || `auth_layer_${index}`;

        return {
            id,
            name: String(raw.name || `Layer ${index}`).trim().slice(0, 60) || `Layer ${index}`,
            url,
            placement,
            scroll_mode: scrollMode,
            x: clamp(toNumber(raw.x, placement === "auth_bg" ? 18 : 84), 0, 100),
            y: clamp(toNumber(raw.y, placement === "auth_bg" ? 74 : 16), 0, 100),
            size: Math.round(clamp(toNumber(raw.size, 180), 16, maxSize)),
            scale: clamp(toNumber(raw.scale, 1), 0.3, 3),
            opacity: clamp(toNumber(raw.opacity, 0.22), 0.05, 1),
            z_index: Math.round(clamp(toNumber(raw.z_index, 1), 1, 120)),
            enabled: toBool(raw.enabled, true),
        };
    }

    function parseLayers(rawLayers, legacyUrl) {
        let parsed = [];
        try {
            const source = Array.isArray(rawLayers) ? rawLayers : JSON.parse(String(rawLayers || "[]"));
            if (Array.isArray(source)) {
                parsed = source.map((item, idx) => normalizeLayer(item, idx + 1)).filter(Boolean);
            }
        } catch (e) {
            parsed = [];
        }

        const enabledAuthLayers = parsed
            .filter((item) => item.enabled)
            .filter((item) => item.placement === "auth_bg" || item.placement === "viewport");
        if (enabledAuthLayers.length) return enabledAuthLayers;

        const legacy = String(legacyUrl || "").trim();
        if (!legacy) return [];
        const fallback = normalizeLayer(
            {
                id: "auth_legacy",
                name: "Auth Legacy Motion",
                url: legacy,
                placement: "auth_bg",
                x: 18,
                y: 74,
                size: 180,
                scale: 1,
                opacity: 0.22,
                z_index: 1,
                enabled: true,
            },
            1
        );
        return fallback ? [fallback] : [];
    }

    function ensureRoot() {
        if (state.root && document.body.contains(state.root)) return state.root;
        let root = document.getElementById("auth-theme-motion-bg");
        if (!root) {
            root = document.createElement("div");
            root.id = "auth-theme-motion-bg";
            root.setAttribute("aria-hidden", "true");
            document.body.appendChild(root);
        }
        state.root = root;
        return root;
    }

    function destroyInstances() {
        state.instances.forEach((instance) => {
            if (instance && typeof instance.destroy === "function") {
                try {
                    instance.destroy();
                } catch (e) {}
            }
        });
        state.instances = [];
    }

    function clearRoot(removeNode = false) {
        destroyInstances();
        state.signature = "";
        if (!state.root) {
            state.root = document.getElementById("auth-theme-motion-bg");
        }
        if (!state.root) return;
        if (removeNode) {
            state.root.remove();
            state.root = null;
            return;
        }
        state.root.innerHTML = "";
    }

    function getLayoutContext() {
        const width = window.innerWidth || 1280;
        const mobile = width < 768;
        const tablet = width >= 768 && width < 1200;
        const bucket = mobile ? "mobile" : (tablet ? "tablet" : "desktop");
        return { mobile, tablet, layoutKey: bucket };
    }

    function adaptiveScale(baseScale, context) {
        let factor = 1;
        if (context.mobile) factor *= 0.7;
        else if (context.tablet) factor *= 0.86;
        return clamp(baseScale * factor, 0.25, 3.5);
    }

    async function ensureLottieLibrary() {
        if (window.lottie && typeof window.lottie.loadAnimation === "function") return true;
        if (state.scriptPromise) return state.scriptPromise;
        const scriptSources = [
            "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js",
            "https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie.min.js",
            "https://unpkg.com/lottie-web@5.12.2/build/player/lottie.min.js",
        ];
        const loadScript = (src, timeoutMs = 2500) => new Promise((resolve) => {
            const script = document.createElement("script");
            let settled = false;
            const finish = (ok) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timer);
                script.onload = null;
                script.onerror = null;
                if (!ok && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                resolve(ok);
            };
            const timer = window.setTimeout(() => finish(false), timeoutMs);
            script.src = src;
            script.async = true;
            script.onload = () => finish(true);
            script.onerror = () => finish(false);
            document.head.appendChild(script);
        });

        state.scriptPromise = (async () => {
            for (const src of scriptSources) {
                const loaded = await loadScript(src);
                if (loaded && window.lottie && typeof window.lottie.loadAnimation === "function") {
                    return true;
                }
            }
            return false;
        })();
        return state.scriptPromise;
    }

    async function renderLayers(force = false) {
        const layers = Array.isArray(state.layers) ? state.layers : [];
        if (!layers.length) {
            clearRoot(true);
            return;
        }

        const context = getLayoutContext();
        const signature = JSON.stringify({ layers, layout: context.layoutKey });
        if (!force && signature === state.signature) return;

        const root = ensureRoot();
        clearRoot(false);
        state.signature = signature;
        state.layoutKey = context.layoutKey;

        const ok = await ensureLottieLibrary();
        const hasLottie = !!ok && !!window.lottie && typeof window.lottie.loadAnimation === "function";

        layers.forEach((layer, index) => {
            const placement = layer.placement === "auth_bg" ? "auth_bg" : "viewport";
            const item = document.createElement("span");
            const size = Math.round(clamp(toNumber(layer.size, placement === "auth_bg" ? 180 : 140), 16, 960));
            const scale = adaptiveScale(clamp(toNumber(layer.scale, 1), 0.3, 3), context);
            const opacity = clamp(toNumber(layer.opacity, placement === "auth_bg" ? 0.22 : 0.28), 0.05, 1);
            const zIndex = Math.round(clamp(toNumber(layer.z_index, placement === "auth_bg" ? 1 : 3), 1, 120));
            const x = clamp(toNumber(layer.x, placement === "auth_bg" ? 18 : 84), 0, 100);
            const y = clamp(toNumber(layer.y, placement === "auth_bg" ? 74 : 16), 0, 100);

            item.className = "auth-theme-motion-item";
            if (placement === "auth_bg") item.classList.add("is-auth-bg");
            item.dataset.motionId = String(layer.id || `auth_layer_${index + 1}`);
            item.title = String(layer.name || `Layer ${index + 1}`);
            item.style.width = `${size}px`;
            item.style.height = `${size}px`;
            item.style.opacity = String(opacity);
            item.style.zIndex = String(zIndex);
            item.style.left = `${x}%`;
            item.style.top = `${y}%`;
            item.style.transform = `translate(-50%, -50%) scale(${scale})`;

            const stage = document.createElement("span");
            stage.className = "auth-theme-motion-stage";
            item.appendChild(stage);
            root.appendChild(item);

            if (!hasLottie) {
                item.classList.add("is-fallback");
                return;
            }

            const instance = window.lottie.loadAnimation({
                container: stage,
                renderer: "svg",
                loop: true,
                autoplay: true,
                path: String(layer.url || ""),
                rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
            });
            state.instances.push(instance);
        });
    }

    function scheduleRender() {
        if (!state.layers.length) return;
        if (state.resizeTimer) {
            window.clearTimeout(state.resizeTimer);
        }
        state.resizeTimer = window.setTimeout(() => {
            renderLayers(true).catch(() => {});
        }, 120);
    }

    function boot() {
        const rawLayers = config.layers || config.motion_layers || config.admin_motion_layers || "[]";
        const legacyUrl = config.legacy_url || config.admin_lottie_url || "";
        state.layers = parseLayers(rawLayers, legacyUrl);
        if (!state.layers.length) return;

        const start = () => renderLayers(false).catch(() => {});
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", start, { once: true });
        } else {
            start();
        }

        window.addEventListener("resize", scheduleRender);
        window.addEventListener("orientationchange", scheduleRender);
    }

    boot();
})();

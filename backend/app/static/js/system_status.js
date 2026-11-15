/* Network + offline system (vanilla JS).
 *
 * Features:
 * - Service worker registration (/sw.js) for offline navigation fallback.
 * - Online/offline detection using events + /healthz ping.
 * - Small floating status UI with Retry + loading state.
 * - Optional toast notifications (uses window.showToast from static/js/toast.js).
 * - Client error logging to POST /client-logs (rate-limited).
 */

(function () {
    const HEALTH_URL = "/healthz";
    const CLIENT_LOG_URL = "/client-logs";
    const CHECK_TIMEOUT_MS = 5000;
    const ONLINE_PING_INTERVAL_MS = 30000;
    const STORAGE_LAST_URL = "last_good_url_v1";
    const OFFLINE_CONFIRM_FAILURES = 2;

    const MAX_CLIENT_LOGS = 8;
    let clientLogCount = 0;

    function safeToast(message, type) {
        try {
            if (typeof window.showToast === "function") {
                window.showToast(String(message || ""), type || "info");
            }
        } catch (e) {
            // ignore
        }
    }

    function withTimeout(ms, fn) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        let timeout = null;
        if (controller) {
            timeout = window.setTimeout(() => controller.abort(), ms);
        }
        return Promise.resolve()
            .then(() => fn(controller ? controller.signal : undefined))
            .finally(() => {
                if (timeout) window.clearTimeout(timeout);
            });
    }

    function rememberLastUrl() {
        try {
            localStorage.setItem(STORAGE_LAST_URL, String(window.location.href || ""));
        } catch (e) {
            // ignore storage failures
        }
    }

    function isLikelyBrowserOnline() {
        try {
            if (typeof navigator.onLine === "boolean") return navigator.onLine;
            return true;
        } catch (e) {
            return true;
        }
    }

    function isLocalhostHost() {
        const host = String(window.location.hostname || "").toLowerCase();
        return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    }

    async function pingHealthz() {
        if (typeof window.fetch !== "function") {
            return !!navigator.onLine;
        }
        return withTimeout(CHECK_TIMEOUT_MS, async (signal) => {
            const res = await fetch(HEALTH_URL, {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin",
                signal,
                headers: { "X-Requested-With": "fetch" }
            });
            return !!(res && res.ok);
        }).catch(() => false);
    }

    function ensureWidget() {
        const existing = document.querySelector("[data-net-status]");
        if (existing) return existing;
        if (!document.body) return null;

        const root = document.createElement("div");
        root.className = "net-status";
        root.setAttribute("data-net-status", "");
        root.setAttribute("data-state", "online");
        root.setAttribute("role", "status");
        root.setAttribute("aria-live", "polite");

        root.innerHTML = [
            "<div class=\"net-status__icon\" aria-hidden=\"true\">",
            // Inline SVG (avoid icon font dependency)
            "  <svg viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">",
            "    <path d=\"M4 9.5C8.5 5.5 15.5 5.5 20 9.5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>",
            "    <path d=\"M6.5 12.5C9.5 10 14.5 10 17.5 12.5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>",
            "    <path d=\"M9.2 15.4C10.7 14.4 13.3 14.4 14.8 15.4\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>",
            "    <path d=\"M12 19.2h.01\" stroke=\"currentColor\" stroke-width=\"4\" stroke-linecap=\"round\"/>",
            "  </svg>",
            "</div>",
            "<div class=\"net-status__text\">",
            "  <div class=\"net-status__title\" data-net-title>Online</div>",
            "  <div class=\"net-status__desc\" data-net-desc>Connection looks good.</div>",
            "</div>",
            "<button type=\"button\" class=\"net-status__btn\" data-net-retry>",
            "  <span class=\"net-status__spinner\" aria-hidden=\"true\"></span>",
            "  <span data-net-btn-label>Retry</span>",
            "</button>"
        ].join("");

        document.body.appendChild(root);
        return root;
    }

    function setVisible(el, visible) {
        if (!el) return;
        el.classList.toggle("is-visible", !!visible);
    }

    function setWidgetState(el, state) {
        if (!el) return;
        el.setAttribute("data-state", state);

        const title = el.querySelector("[data-net-title]");
        const desc = el.querySelector("[data-net-desc]");
        const btn = el.querySelector("[data-net-retry]");
        const btnLabel = el.querySelector("[data-net-btn-label]");

        if (!title || !desc || !btn || !btnLabel) return;

        if (state === "offline") {
            title.textContent = "You're offline";
            desc.textContent = "Some actions may fail. We'll reconnect automatically.";
            btnLabel.textContent = "Retry";
            btn.disabled = false;
            setVisible(el, true);
            return;
        }

        if (state === "checking") {
            title.textContent = "Reconnecting...";
            desc.textContent = "Checking connection...";
            btnLabel.textContent = "Checking";
            btn.disabled = true;
            setVisible(el, true);
            return;
        }

        // online
        title.textContent = "Online";
        desc.textContent = "Connection looks good.";
        btnLabel.textContent = "Retry";
        btn.disabled = false;
        setVisible(el, false);
    }

    function setRetryLoading(el, loading) {
        const btn = el ? el.querySelector("[data-net-retry]") : null;
        if (!btn) return;
        btn.classList.toggle("is-loading", !!loading);
    }

    let lastIsOffline = null;
    let isChecking = false;
    let consecutiveFailures = 0;

    async function checkNow(opts) {
        const options = opts || {};
        const silent = !!options.silent;
        const interactive = !!options.interactive;
        const el = ensureWidget();
        if (!el) return false;

        if (isChecking) return lastIsOffline !== true;
        isChecking = true;

        const shouldShowChecking = interactive || !silent || lastIsOffline === true || !isLikelyBrowserOnline();
        if (shouldShowChecking) {
            setWidgetState(el, "checking");
            setRetryLoading(el, true);
        }

        const ok = await pingHealthz();
        isChecking = false;
        if (shouldShowChecking) {
            setRetryLoading(el, false);
        }

        if (ok) {
            consecutiveFailures = 0;
            setWidgetState(el, "online");

            if (lastIsOffline !== false) {
                if (!silent) safeToast("Back online.", "success");
                lastIsOffline = false;
            }

            rememberLastUrl();
            return true;
        }

        consecutiveFailures += 1;
        const browserOnline = isLikelyBrowserOnline();
        const confirmedOffline =
            interactive ||
            !silent ||
            !browserOnline ||
            lastIsOffline === true ||
            consecutiveFailures >= OFFLINE_CONFIRM_FAILURES;

        if (!confirmedOffline) {
            if (lastIsOffline == null) {
                lastIsOffline = false;
                setWidgetState(el, "online");
            }
            return true;
        }

        setWidgetState(el, "offline");
        if (lastIsOffline !== true) {
            if (!silent) safeToast("You're offline. Some features may not work.", "warning");
            lastIsOffline = true;
        }
        return false;
    }

    function bindRetry() {
        const el = ensureWidget();
        if (!el || el.__netRetryBound) return;
        el.__netRetryBound = true;

        const btn = el.querySelector("[data-net-retry]");
        if (!btn) return;

        btn.addEventListener("click", async () => {
            const ok = await checkNow({ silent: false, interactive: true });
            if (ok) {
                safeToast("Connection restored.", "success");
            } else {
                safeToast("Still offline. Check your network and try again.", "warning");
            }
        });
    }

    function registerServiceWorker() {
        if (!("serviceWorker" in navigator)) return;
        if (isLocalhostHost()) {
            // Local development is prone to stale SW/offline fallback loops.
            navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((reg) => reg.unregister().catch(() => {}));
            }).catch(() => {});
            return;
        }
        // Register at root scope (served by Flask route /sw.js).
        navigator.serviceWorker.register("/sw.js").catch(() => {
            // Ignore: SW is an enhancement.
        });
    }

    function sendClientLog(payload) {
        if (!payload) return;
        if (clientLogCount >= MAX_CLIENT_LOGS) return;
        clientLogCount += 1;

        const body = {
            level: payload.level || "error",
            message: String(payload.message || ""),
            stack: String(payload.stack || ""),
            url: String(window.location.href || ""),
            userAgent: String(navigator.userAgent || ""),
            ts: new Date().toISOString()
        };

        try {
            const data = JSON.stringify(body);

            if (navigator.sendBeacon) {
                const blob = new Blob([data], { type: "application/json" });
                navigator.sendBeacon(CLIENT_LOG_URL, blob);
                return;
            }

            if (typeof window.fetch === "function") {
                fetch(CLIENT_LOG_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: data,
                    keepalive: true,
                    credentials: "same-origin"
                }).catch(() => {});
            }
        } catch (e) {
            // ignore
        }
    }

    function setupClientLogging() {
        if (window.__clientLogsInstalled) return;
        window.__clientLogsInstalled = true;

        window.addEventListener("error", (event) => {
            if (!event) return;
            const message = event.message || "Script error";
            const stack = event.error && event.error.stack ? event.error.stack : "";
            sendClientLog({ level: "error", message, stack });
        });

        window.addEventListener("unhandledrejection", (event) => {
            const reason = event && event.reason ? event.reason : null;
            const message = reason && reason.message ? reason.message : "Unhandled promise rejection";
            const stack = reason && reason.stack ? reason.stack : "";
            sendClientLog({ level: "error", message, stack });
        });
    }

    function boot() {
        if (!document.body) {
            document.addEventListener("DOMContentLoaded", boot, { once: true });
            return;
        }

        ensureWidget();
        bindRetry();
        registerServiceWorker();
        setupClientLogging();

        // React quickly to OS events, but confirm with /healthz when coming back online.
        window.addEventListener("offline", () => {
            const el = ensureWidget();
            consecutiveFailures = OFFLINE_CONFIRM_FAILURES;
            setWidgetState(el, "offline");
            lastIsOffline = true;
            safeToast("You're offline. Some features may not work.", "warning");
        });

        window.addEventListener("online", () => {
            checkNow({ silent: false });
        });

        // Initial check (silent). If offline, show the widget.
        checkNow({ silent: true });

        // Periodic health checks while the tab is visible.
        window.setInterval(() => {
            if (document.hidden) return;
            checkNow({ silent: true });
        }, ONLINE_PING_INTERVAL_MS);

        // Store last good URL on navigation.
        if (navigator.onLine) rememberLastUrl();
    }

    boot();
})();

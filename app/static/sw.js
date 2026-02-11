/* Service worker for offline navigation fallback.
 *
 * Scope: "/"
 * Served by Flask at: GET /sw.js
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `agri-expert-system-${CACHE_VERSION}`;

// Keep this file self-contained and stable. Avoid querystrings in precache.
const OFFLINE_FALLBACK_URL = "/static/offline.html";

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll([
                OFFLINE_FALLBACK_URL
            ]);
            self.skipWaiting();
        })()
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                    return Promise.resolve(false);
                })
            );
            self.clients.claim();
        })()
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (!req || req.method !== "GET") return;

    const url = new URL(req.url);

    // Offline fallback for full-page navigations.
    if (req.mode === "navigate") {
        event.respondWith(
            (async () => {
                try {
                    // Network-first keeps HTML fresh.
                    return await fetch(req);
                } catch (e) {
                    const cache = await caches.open(CACHE_NAME);
                    const cached = await cache.match(OFFLINE_FALLBACK_URL);
                    return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
                }
            })()
        );
        return;
    }

    // Cache-first for static assets (best effort).
    if (url.pathname.startsWith("/static/")) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);
                const cached = await cache.match(req);
                if (cached) return cached;
                try {
                    const res = await fetch(req);
                    // Only cache successful, same-origin responses.
                    if (res && res.ok && url.origin === self.location.origin) {
                        cache.put(req, res.clone()).catch(() => {});
                    }
                    return res;
                } catch (e) {
                    return cached || new Response("", { status: 504 });
                }
            })()
        );
    }
});


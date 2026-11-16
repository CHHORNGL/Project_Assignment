let serviceWorkerRegistrationStarted = false;

export interface ServiceWorkerEnvironment {
  hasWindow: boolean;
  hasNavigator: boolean;
  hasServiceWorker: boolean;
  isSecureContext: boolean;
}

export function detectServiceWorkerEnvironment(): ServiceWorkerEnvironment {
  const hasWindow = typeof window !== "undefined";
  const hasNavigator = typeof navigator !== "undefined";
  const hasServiceWorker = hasNavigator && "serviceWorker" in navigator;
  const isSecureContext =
    hasWindow &&
    (window.isSecureContext ||
      window.location?.hostname === "localhost" ||
      window.location?.hostname === "127.0.0.1");

  return {
    hasWindow,
    hasNavigator,
    hasServiceWorker,
    isSecureContext,
  };
}

export function canRegisterServiceWorker(
  env: ServiceWorkerEnvironment = detectServiceWorkerEnvironment(),
): boolean {
  return Boolean(
    env.hasWindow &&
      env.hasNavigator &&
      env.hasServiceWorker &&
      env.isSecureContext,
  );
}

/**
 * Registers the root service worker once on load so the web app supports
 * installability (PWA) and offline fallback without blocking rendering.
 */
export function registerServiceWorker(swPath = "/sw.js"): void {
  if (serviceWorkerRegistrationStarted || !canRegisterServiceWorker()) {
    return;
  }
  serviceWorkerRegistrationStarted = true;

  const doRegister = () => {
    navigator.serviceWorker
      .register(swPath, { scope: "/" })
      .catch(() => {
        // Ignore registration errors in restricted webviews or private tabs.
      });
  };

  if (document.readyState === "complete") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}

export function isCompactMobileViewport(
  width = typeof window !== "undefined" ? window.innerWidth : 1024,
  breakpointPx = 768,
): boolean {
  return width < breakpointPx;
}

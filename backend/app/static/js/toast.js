/* Global toast notification system (vanilla JS).
 *
 * Usage:
 *   showToast("Diagnosis saved successfully", "success");
 *   showToast("An error occurred. Please try again.", "error");
 *
 * Types: success | error | warning | info
 * Default duration: 3000ms (auto-hide). Pause on hover/focus.
 * Includes an animated progress bar.
 *
 * Styling is shared with the existing notification CSS:
 *   static/css/notifications.css (.flash-stack / .flash...)
 */

(function () {
    const DEFAULT_DURATION_MS = 3000;
    const REMOVE_AFTER_MS = 220; // keep in sync with .flash.is-leaving animation
    const MAX_VISIBLE = 5;

    function normalizeType(type) {
        const t = String(type || "info").toLowerCase();
        if (t === "error" || t === "failed" || t === "fail") return "danger";
        if (t === "success" || t === "warning" || t === "info" || t === "danger") return t;
        return "info";
    }

    function metaForType(type) {
        const t = normalizeType(type);
        // Keep icons glyph-only (no built-in circles); the UI already provides the icon container.
        if (t === "success") return { kind: "success", title: "SUCCESS", iconClass: "fas fa-check" };
        if (t === "danger") return { kind: "danger", title: "FAILED", iconClass: "fas fa-exclamation-circle" };
        if (t === "warning") return { kind: "warning", title: "NOTICE", iconClass: "fas fa-exclamation-triangle" };
        return { kind: "info", title: "INFO", iconClass: "fas fa-info-circle" };
    }

    function ensureStack() {
        // Reuse server-flash stack if present; otherwise create one.
        let stack = document.querySelector("[data-flash-stack]");
        if (stack) return stack;
        if (!document.body) return null;

        stack = document.createElement("div");
        stack.className = "flash-stack";
        stack.setAttribute("data-flash-stack", "");
        document.body.appendChild(stack);
        return stack;
    }

    function leaveAndRemove(flash) {
        if (!flash || flash.classList.contains("is-leaving")) return;
        flash.classList.add("is-leaving");
        window.setTimeout(function () {
            try { flash.remove(); } catch (err) {}
        }, REMOVE_AFTER_MS);
    }

    function bindAutoDismiss(flash) {
        if (!flash || flash.__toastAutoDismissBound) return;
        flash.__toastAutoDismissBound = true;

        const totalDuration = Number(flash.dataset.timeout || DEFAULT_DURATION_MS);
        flash.style.setProperty("--toast-duration", `${Number.isFinite(totalDuration) ? totalDuration : DEFAULT_DURATION_MS}ms`);

        let remaining = totalDuration;
        if (!Number.isFinite(remaining) || remaining <= 0) return;

        let startedAt = Date.now();
        let timer = window.setTimeout(function () { leaveAndRemove(flash); }, remaining);

        function pause() {
            if (!timer) return;
            window.clearTimeout(timer);
            timer = null;
            remaining -= (Date.now() - startedAt);
            if (!Number.isFinite(remaining) || remaining < 250) remaining = 250;
        }

        function resume() {
            if (timer) return;
            if (!Number.isFinite(remaining) || remaining <= 0) {
                leaveAndRemove(flash);
                return;
            }
            startedAt = Date.now();
            timer = window.setTimeout(function () { leaveAndRemove(flash); }, remaining);
        }

        flash.addEventListener("mouseenter", pause);
        flash.addEventListener("mouseleave", resume);
        flash.addEventListener("focusin", pause);
        flash.addEventListener("focusout", resume);
    }

    function buildToastElement(message, type, options) {
        const meta = metaForType(type);
        const duration = Number((options && options.duration) || DEFAULT_DURATION_MS);

        const flash = document.createElement("div");
        flash.className = "flash flash-" + meta.kind;
        flash.setAttribute("role", meta.kind === "danger" ? "alert" : "status");
        flash.setAttribute("aria-live", meta.kind === "danger" ? "assertive" : "polite");
        flash.dataset.timeout = String(Number.isFinite(duration) ? duration : DEFAULT_DURATION_MS);
        flash.dataset.flashCategory = meta.kind;
        flash.style.setProperty("--toast-duration", `${Number.isFinite(duration) ? duration : DEFAULT_DURATION_MS}ms`);

        // Avoid inserting HTML from message; keep it text-only to prevent XSS.
        const inner = document.createElement("div");
        inner.className = "flash-inner";

        const icon = document.createElement("span");
        icon.className = "flash-icon";
        icon.setAttribute("aria-hidden", "true");
        const iconI = document.createElement("i");
        iconI.className = meta.iconClass;
        icon.appendChild(iconI);

        const text = document.createElement("span");
        text.className = "flash-text";

        const title = document.createElement("span");
        title.className = "flash-title";
        const strong = document.createElement("strong");
        strong.textContent = meta.title;
        title.appendChild(strong);

        const msg = document.createElement("span");
        msg.className = "flash-message";
        msg.textContent = String(message || "");

        text.appendChild(title);
        text.appendChild(msg);

        const dismiss = document.createElement("button");
        dismiss.type = "button";
        dismiss.className = "flash-dismiss";
        dismiss.setAttribute("data-flash-dismiss", "");
        dismiss.setAttribute("aria-label", "Dismiss notification");
        const dismissI = document.createElement("i");
        dismissI.className = "fas fa-times";
        dismissI.setAttribute("aria-hidden", "true");
        dismiss.appendChild(dismissI);

        inner.appendChild(icon);
        inner.appendChild(text);
        inner.appendChild(dismiss);
        flash.appendChild(inner);

        const progress = document.createElement("div");
        progress.className = "flash-progress";
        progress.setAttribute("aria-hidden", "true");
        flash.appendChild(progress);

        return flash;
    }

    function trimStack(stack) {
        const items = stack ? stack.querySelectorAll(":scope > .flash") : [];
        if (!items || items.length <= MAX_VISIBLE) return;
        const extra = items.length - MAX_VISIBLE;
        for (let i = 0; i < extra; i++) {
            leaveAndRemove(items[i]);
        }
    }

    function showToast(message, type, options) {
        if (!document.body) {
            // If called before DOM is ready, retry once on DOMContentLoaded.
            document.addEventListener("DOMContentLoaded", function () {
                showToast(message, type, options);
            }, { once: true });
            return;
        }

        const stack = ensureStack();
        if (!stack) return;

        const toast = buildToastElement(message, type, options);
        stack.prepend(toast);
        trimStack(stack);
        bindAutoDismiss(toast);
    }

    // Global API.
    window.showToast = showToast;

    // Global dismiss click handler (works for server-rendered and JS-created toasts).
    document.addEventListener("click", function (e) {
        const btn = e.target.closest("[data-flash-dismiss]");
        if (!btn) return;
        const flash = btn.closest(".flash");
        if (!flash) return;
        leaveAndRemove(flash);
    });

    // Bind auto-dismiss to any server-rendered flash toasts.
    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll("[data-flash-stack] .flash[data-timeout]").forEach(function (flash) {
            bindAutoDismiss(flash);
        });
    });
})();

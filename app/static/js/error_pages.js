/* Error pages enhancements:
 * - Copy request id to clipboard with toast feedback.
 * - Retry button with loading state (reloads the page).
 */

(function () {
    function toast(msg, type) {
        try {
            if (typeof window.showToast === "function") {
                window.showToast(String(msg || ""), type || "info");
            }
        } catch (e) {}
    }

    async function copyText(text) {
        const value = String(text || "");
        if (!value) return false;

        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch (e) {
            // fall back
        }

        try {
            const ta = document.createElement("textarea");
            ta.value = value;
            ta.setAttribute("readonly", "true");
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand("copy");
            ta.remove();
            return !!ok;
        } catch (e) {
            return false;
        }
    }

    function setLoading(btn, loading) {
        if (!btn) return;
        btn.classList.toggle("is-loading", !!loading);
        btn.disabled = !!loading;
    }

    function bind() {
        document.querySelectorAll("[data-copy-text]").forEach((btn) => {
            if (btn.__copyBound) return;
            btn.__copyBound = true;
            btn.addEventListener("click", async () => {
                const text = btn.getAttribute("data-copy-text") || "";
                const ok = await copyText(text);
                toast(ok ? "Copied." : "Copy failed.", ok ? "success" : "danger");
            });
        });

        document.querySelectorAll("[data-retry-page]").forEach((btn) => {
            if (btn.__retryBound) return;
            btn.__retryBound = true;
            btn.addEventListener("click", () => {
                setLoading(btn, true);
                toast("Retrying...", "info");
                window.setTimeout(() => window.location.reload(), 150);
            });
        });
    }

    if (!document.body) {
        document.addEventListener("DOMContentLoaded", bind, { once: true });
    } else {
        bind();
    }
})();


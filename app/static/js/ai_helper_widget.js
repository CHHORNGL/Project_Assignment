(function () {
    const root = document.querySelector(".ai-helper-widget");
    if (!root) return;

    const askUrl = root.dataset.askUrl;
    const supportUrl = root.dataset.supportUrl;
    const userId = root.dataset.userId || "0";
    const role = root.dataset.role || "user";
    const greeting = root.dataset.greeting || "Hi. How can I help?";
    const clearConfirm = root.dataset.clearConfirm || "Clear AI Helper chat history?";
    const aiUnavailable = root.dataset.aiUnavailable || "AI service unavailable.";
    const supportSuccess = root.dataset.supportSuccess || "Message sent.";
    const supportError = root.dataset.supportError || "Unable to send message.";

    const fab = root.querySelector("#ai-helper-fab");
    const panel = root.querySelector("#ai-helper-panel");
    const closeBtn = root.querySelector(".ai-helper-close");
    const clearBtn = root.querySelector(".ai-helper-reset");

    const tabs = Array.from(root.querySelectorAll(".ai-helper-tab[data-tab]"));
    const views = Array.from(root.querySelectorAll(".ai-helper-view[data-view]"));

    const thread = root.querySelector("#ai-helper-thread");
    const form = root.querySelector("#ai-helper-form");
    const input = root.querySelector("#ai-helper-input");

    const supportForm = root.querySelector("#ai-helper-support-form");
    const supportText = root.querySelector("#ai-helper-support-text");
    const supportStatus = root.querySelector("#ai-helper-support-status");

    if (!fab || !panel) return;

    const storageKey = "ai_helper_position_v1";
    const threadStorageKey = `ai_helper_thread_v1_${userId}_${role}`;
    const tabStorageKey = `ai_helper_tab_v1_${userId}_${role}`;
    const openStorageKey = `ai_helper_open_v1_${userId}_${role}`;

    let messages = [];

    function pruneMessages(arr) {
        if (!Array.isArray(arr) || !arr.length) return [];

        // If there are no user messages, it's just the greeting (or only assistant messages).
        // Don't persist/show it across page loads so it can re-localize with the UI language.
        const hasUser = arr.some((m) => m && m.kind === "user");
        if (!hasUser) return [];

        // Drop the initial greeting if it exists (assistant message followed by first user message).
        if (arr.length >= 2 && arr[0].kind === "assistant" && arr[1].kind === "user") {
            return arr.slice(1);
        }

        return arr;
    }

    function loadMessages() {
        try {
            const raw = sessionStorage.getItem(threadStorageKey);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            const cleaned = [];
            for (const item of arr) {
                if (!item) continue;
                const kind = item.kind;
                const text = item.text;
                if (kind !== "user" && kind !== "assistant") continue;
                if (typeof text !== "string") continue;
                cleaned.push({ kind, text });
            }
            // Keep the most recent messages only to avoid unbounded storage.
            return pruneMessages(cleaned.slice(-120));
        } catch (e) {
            return [];
        }
    }

    function saveMessages() {
        try {
            sessionStorage.setItem(threadStorageKey, JSON.stringify(messages.slice(-120)));
        } catch (e) {}
    }

    function clearMessages() {
        messages = [];
        try {
            sessionStorage.removeItem(threadStorageKey);
        } catch (e) {}
    }

    function loadActiveTab() {
        try {
            const tab = sessionStorage.getItem(tabStorageKey);
            if (tab === "chat" || tab === "contact") return tab;
        } catch (e) {}
        return "chat";
    }

    function saveActiveTab(tab) {
        try {
            sessionStorage.setItem(tabStorageKey, tab);
        } catch (e) {}
    }

    function loadOpenState() {
        try {
            return sessionStorage.getItem(openStorageKey) === "1";
        } catch (e) {
            return false;
        }
    }

    function saveOpenState(isOpen) {
        try {
            sessionStorage.setItem(openStorageKey, isOpen ? "1" : "0");
        } catch (e) {}
    }

    function clamp(n, min, max) {
        return Math.min(Math.max(n, min), max);
    }

    function loadPosition() {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || typeof obj.left !== "number" || typeof obj.top !== "number") return null;
            return obj;
        } catch (e) {
            return null;
        }
    }

    function savePosition(left, top) {
        try {
            localStorage.setItem(storageKey, JSON.stringify({ left, top }));
        } catch (e) {}
    }

    function clearPosition() {
        try {
            localStorage.removeItem(storageKey);
        } catch (e) {}
    }

    function applyPosition(left, top) {
        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
        root.style.right = "auto";
        root.style.bottom = "auto";
    }

    function getAvoidRect() {
        const avoid = document.querySelector(".farmer-chat-composer");
        if (!avoid) return null;
        const rect = avoid.getBoundingClientRect();
        if (!rect || rect.height < 40) return null;
        if (rect.top < 0 || rect.top > window.innerHeight) return null;
        return rect;
    }

    function getSafeMinTop(margin) {
        let minTop = margin;
        const selectors = [".topbar.app-topbar", ".farmer-chat-header"];
        selectors.forEach((sel) => {
            const el = document.querySelector(sel);
            if (!el) return;
            const rect = el.getBoundingClientRect();
            if (!rect || rect.height < 40) return;
            if (rect.bottom < 0 || rect.top > window.innerHeight) return;

            // Only treat as a "top blocker" if it's currently stuck to the top.
            const stuckToTop = rect.top <= margin + 1 && rect.bottom > margin;
            if (!stuckToTop) return;

            minTop = Math.max(minTop, Math.round(rect.bottom) + margin);
        });
        return minTop;
    }

    function clampToViewport() {
        const rect = root.getBoundingClientRect();
        const margin = 12;
        const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
        let maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
        const minTop = getSafeMinTop(margin);

        // Prevent overlapping sticky chat composer (mobile chat pages).
        const avoid = getAvoidRect();
        if (avoid) {
            const safeMaxTop = avoid.top - rect.height - margin;
            maxTop = Math.min(maxTop, safeMaxTop);
        }
        maxTop = Math.max(minTop, maxTop);

        const left = clamp(rect.left, margin, maxLeft);
        const top = clamp(rect.top, minTop, maxTop);
        applyPosition(left, top);
        savePosition(left, top);
    }

    function setDefaultDock() {
        // Don't override user-chosen position.
        if (loadPosition()) return;

        // Clear any inline positioning.
        root.style.left = "";
        root.style.top = "";
        root.style.right = "";
        root.style.bottom = "";

        // If there is a sticky bottom composer (chat pages), move the FAB above it.
        const avoid = document.querySelector(".farmer-chat-composer");
        if (!avoid) return;

        const avoidH = Math.round(avoid.getBoundingClientRect().height || 0);
        if (!avoidH) return;

        const base = window.matchMedia("(max-width: 420px)").matches ? 12 : 18;
        const next = Math.max(base, avoidH + 18);
        root.style.bottom = `${next}px`;
    }

    function isOpen() {
        return !panel.classList.contains("is-collapsed");
    }

    function positionPanel() {
        // Ensure the panel stays within the viewport even if the FAB is moved.
        panel.style.position = "fixed";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
        panel.style.maxHeight = "";

        const gap = 12;
        const minTop = getSafeMinTop(gap);

        // On mobile, open as a bottom sheet for a cleaner UX.
        const isMobileSheet = window.matchMedia && window.matchMedia("(max-width: 520px)").matches;
        if (isMobileSheet) {
            panel.style.left = `${gap}px`;
            panel.style.right = `${gap}px`;
            panel.style.top = "auto";
            panel.style.bottom = `calc(${gap}px + env(safe-area-inset-bottom, 0px))`;
            panel.style.maxHeight = `calc(100vh - ${minTop + gap}px)`;
            return;
        }

        const fabRect = fab.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();

        let left = fabRect.right - panelRect.width;
        let top = fabRect.top - panelRect.height - gap;

        // If there isn't enough room above, open below.
        if (top < gap) {
            top = fabRect.bottom + gap;
        }

        const maxLeft = Math.max(gap, window.innerWidth - panelRect.width - gap);
        const maxTop = Math.max(gap, window.innerHeight - panelRect.height - gap);
        left = clamp(left, gap, maxLeft);
        top = clamp(top, minTop, Math.max(minTop, maxTop));

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
    }

    function open(opts) {
        opts = opts || {};
        const shouldFocus = opts.focus !== false;
        panel.classList.remove("is-collapsed");
        fab.setAttribute("aria-expanded", "true");
        saveOpenState(true);
        ensureGreeting();
        positionPanel();
        if (shouldFocus) {
            setTimeout(() => {
                if (input) input.focus();
            }, 0);
        }
    }

    function close() {
        panel.classList.add("is-collapsed");
        fab.setAttribute("aria-expanded", "false");
        saveOpenState(false);
    }

    function setActiveTab(tab, persist) {
        if (persist === undefined) persist = true;
        tabs.forEach((btn) => {
            const active = btn.dataset.tab === tab;
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        views.forEach((view) => {
            const active = view.dataset.view === tab;
            view.classList.toggle("is-hidden", !active);
        });
        if (persist) saveActiveTab(tab);
    }

    function escapeText(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.textContent;
    }

    function appendMessage(kind, text, persist) {
        if (persist === undefined) persist = true;
        if (!thread) return;
        const item = document.createElement("div");
        item.className = "ai-helper-msg " + kind;

        const bubble = document.createElement("div");
        bubble.className = "ai-helper-bubble";
        bubble.textContent = escapeText(text);

        item.appendChild(bubble);
        thread.appendChild(item);
        thread.scrollTop = thread.scrollHeight;

        if (persist) {
            messages.push({ kind, text });
            if (messages.length > 120) messages = messages.slice(-120);
            saveMessages();
        }
    }

    function appendTyping() {
        if (!thread) return null;
        const item = document.createElement("div");
        item.className = "ai-helper-msg assistant";

        const bubble = document.createElement("div");
        bubble.className = "ai-helper-bubble ai-helper-typing";
        bubble.innerHTML = "<span></span><span></span><span></span>";

        item.appendChild(bubble);
        thread.appendChild(item);
        thread.scrollTop = thread.scrollHeight;
        return item;
    }

    function ensureGreeting() {
        if (!thread) return;
        if (thread.childElementCount > 0) return;
        // Don't persist the greeting so it can re-localize when the UI language changes.
        appendMessage("assistant", greeting, false);
    }

    function setSupportStatus(text, kind) {
        if (!supportStatus) return;
        supportStatus.textContent = text || "";
        supportStatus.classList.remove("is-success", "is-error");
        if (kind === "success") supportStatus.classList.add("is-success");
        if (kind === "error") supportStatus.classList.add("is-error");
    }

    // Restore chat thread (per tab) so it doesn't reset on navigation/page refresh.
    messages = loadMessages();
    if (thread && messages.length) {
        thread.innerHTML = "";
        for (const msg of messages) {
            appendMessage(msg.kind, msg.text, false);
        }
    }

    // Restore saved FAB position (if any), otherwise use smart defaults.
    const saved = loadPosition();
    if (saved) {
        applyPosition(saved.left, saved.top);
        // Clamp after layout settles.
        setTimeout(() => clampToViewport(), 0);
    } else {
        setDefaultDock();
    }

    // Keep the FAB above the sticky composer when it grows/shrinks (autosize textarea),
    // but only if the user hasn't dragged the FAB to a custom position.
    (function () {
        const avoid = document.querySelector(".farmer-chat-composer");
        if (!avoid) return;
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => {
            if (loadPosition()) return;
            setDefaultDock();
            if (isOpen()) positionPanel();
        });
        try { ro.observe(avoid); } catch (e) {}
    })();

    window.addEventListener("resize", () => {
        const s = loadPosition();
        if (s) clampToViewport();
        else setDefaultDock();
        if (isOpen()) positionPanel();
    });

    // Drag to reposition (mobile + desktop). Only when panel is closed.
    let drag = null;
    let suppressClick = false;

    fab.addEventListener("pointerdown", (e) => {
        if (isOpen()) return;
        if (e.button !== undefined && e.button !== 0) return;

        // Capture pointer to keep receiving move events.
        try { fab.setPointerCapture(e.pointerId); } catch (err) {}

        const rect = root.getBoundingClientRect();
        drag = {
            id: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            baseLeft: rect.left,
            baseTop: rect.top,
            didMove: false,
        };
    });

    fab.addEventListener("pointermove", (e) => {
        if (!drag || drag.id !== e.pointerId) return;

        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;

        if (!drag.didMove) {
            if (Math.hypot(dx, dy) < 6) return;
            drag.didMove = true;
            suppressClick = true;
        }

        e.preventDefault();

        const margin = 12;
        const rootRect = root.getBoundingClientRect();
        const w = rootRect.width || 56;
        const h = rootRect.height || 56;

        let left = drag.baseLeft + dx;
        let top = drag.baseTop + dy;

        const maxLeft = Math.max(margin, window.innerWidth - w - margin);
        let maxTop = Math.max(margin, window.innerHeight - h - margin);
        const minTop = getSafeMinTop(margin);

        const avoid = getAvoidRect();
        if (avoid) {
            const safeMaxTop = avoid.top - h - margin;
            maxTop = Math.min(maxTop, safeMaxTop);
        }
        maxTop = Math.max(minTop, maxTop);

        left = clamp(left, margin, maxLeft);
        top = clamp(top, minTop, maxTop);

        applyPosition(left, top);
    });

    fab.addEventListener("pointerup", (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        try { fab.releasePointerCapture(e.pointerId); } catch (err) {}

        if (drag.didMove) {
            const rect = root.getBoundingClientRect();
            const margin = 12;
            const w = rect.width || 56;
            const maxLeft = Math.max(margin, window.innerWidth - w - margin);
            const minTop = getSafeMinTop(margin);

            // Snap to nearest horizontal edge for a cleaner look.
            let left = rect.left + w / 2 < window.innerWidth / 2 ? margin : maxLeft;
            let top = rect.top;

            const avoid = getAvoidRect();
            if (avoid) {
                const safeMaxTop = avoid.top - (rect.height || 56) - margin;
                top = clamp(top, minTop, Math.max(minTop, safeMaxTop));
            } else {
                top = Math.max(minTop, top);
            }

            applyPosition(left, top);
            savePosition(left, top);
        }

        drag = null;
        setTimeout(() => { suppressClick = false; }, 0);
    });

    fab.addEventListener("pointercancel", () => {
        drag = null;
        suppressClick = false;
    });

    fab.addEventListener("click", (e) => {
        if (suppressClick) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        e.stopPropagation();
        if (isOpen()) close();
        else open();
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            close();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const ok = window.confirm(clearConfirm);
            if (!ok) return;

            clearMessages();
            if (thread) thread.innerHTML = "";
            ensureGreeting();
            if (input) input.focus();
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!isOpen()) return;
        close();
        fab.focus();
    });

    tabs.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            setActiveTab(tab);
            setSupportStatus("", "");
            if (tab === "chat" && input) input.focus();
            if (tab === "contact" && supportText) supportText.focus();
        });
    });

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!input) return;
            const message = (input.value || "").trim();
            if (!message) return;

            input.value = "";
            appendMessage("user", message);

            const typingEl = appendTyping();
            if (input) input.disabled = true;
            const submitBtn = form.querySelector("button[type='submit']");
            if (submitBtn) submitBtn.disabled = true;

            let replyText = aiUnavailable;
            try {
                const res = await fetch(askUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message,
                        page: window.location.pathname
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data && data.ok && typeof data.reply === "string") {
                    replyText = data.reply;
                } else if (data && typeof data.error === "string") {
                    replyText = data.error;
                }
            } catch (err) {
                replyText = aiUnavailable;
            }

            if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
            appendMessage("assistant", replyText);

            if (input) input.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
            if (input) input.focus();
        });
    }

    if (supportForm) {
        supportForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!supportText) return;
            const message = (supportText.value || "").trim();
            if (!message) return;

            setSupportStatus("", "");
            supportText.disabled = true;
            const submitBtn = supportForm.querySelector("button[type='submit']");
            if (submitBtn) submitBtn.disabled = true;

            try {
                const res = await fetch(supportUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message,
                        page: window.location.href
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data && data.ok) {
                    supportText.value = "";
                    setSupportStatus(supportSuccess, "success");
                } else {
                    setSupportStatus((data && data.error) ? data.error : supportError, "error");
                }
            } catch (err) {
                setSupportStatus(supportError, "error");
            } finally {
                supportText.disabled = false;
                if (submitBtn) submitBtn.disabled = false;
                supportText.focus();
            }
        });
    }

    const shouldOpen = loadOpenState();

    // Restore the last active tab.
    setActiveTab(loadActiveTab(), false);

    // Restore open state across page navigation; don't steal focus.
    if (shouldOpen) {
        setTimeout(() => open({ focus: false }), 0);
    }
})();

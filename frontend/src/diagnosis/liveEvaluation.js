// Cleanup also guards against responses that arrive after aborting a request.
export function scheduleLiveEvaluation({ url, csrfToken, payload, onSuccess, onError, onSettled, delay = 300 }) {
  const controller = new AbortController();
  let active = true;
  const timer = setTimeout(async () => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": csrfToken || "",
        },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to load diagnosis results. Please try again.");
      }
      if (active) onSuccess(data);
    } catch (error) {
      if (active) onError(error);
    } finally {
      if (active) onSettled();
    }
  }, delay);
  return () => {
    active = false;
    clearTimeout(timer);
    controller.abort();
  };
}

const EVENT_NAME = "vms:global-busy";
const FETCH_INTERCEPTOR_FLAG = "__vmsGlobalBusyFetchInterceptorInstalled";

export const beginGlobalBusy = (label = "Processing...") => {
  if (typeof window === "undefined") return () => {};

  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, {
      detail: { active: true, label },
    })
  );

  let ended = false;
  return () => {
    if (ended || typeof window === "undefined") return;
    ended = true;
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { active: false, label },
      })
    );
  };
};

export const GLOBAL_BUSY_EVENT = EVENT_NAME;

// A few older screens still use fetch directly instead of apiClient.  Keep the
// blocking state consistent for their submit/save/update requests as well.
export const installGlobalBusyFetchInterceptor = () => {
  if (typeof window === "undefined" || window[FETCH_INTERCEPTOR_FLAG]) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const { globalBusyHandled, busyLabel, ...fetchOptions } = options || {};
    const method = String(
      fetchOptions.method ||
        (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const shouldShowLoader =
      !globalBusyHandled && ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const stopBusy = shouldShowLoader
      ? beginGlobalBusy(busyLabel || (method === "DELETE" ? "Processing..." : "Saving changes..."))
      : null;

    try {
      return await nativeFetch(input, fetchOptions);
    } finally {
      stopBusy?.();
    }
  };

  window[FETCH_INTERCEPTOR_FLAG] = true;
};

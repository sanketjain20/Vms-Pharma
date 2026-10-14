// Makes the /rep page installable and offline-capable WITHOUT changing the
// office app: the rep manifest and service worker are attached only while the
// rep app is mounted, and the office's own manifest link is put back after.
export function registerRepPwa() {
  if (typeof document === "undefined") return () => {};

  const displaced = document.querySelector('link[rel="manifest"]');
  let ours = null;
  if (!document.querySelector('link[rel="manifest"][data-rep]')) {
    displaced?.parentNode.removeChild(displaced);
    ours = document.createElement("link");
    ours.rel = "manifest";
    ours.href = "/rep-manifest.webmanifest";
    ours.setAttribute("data-rep", "1");
    document.head.appendChild(ours);
  }

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/rep-sw.js", { scope: "/rep" }).catch(() => {
      // Not fatal: the app still works online; only "open with no signal" is lost.
    });
  }

  return () => {
    if (ours) {
      ours.parentNode?.removeChild(ours);
      if (displaced) document.head.appendChild(displaced);
    }
  };
}

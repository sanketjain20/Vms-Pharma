// "The sidebar's menu is on screen." Heavy page work (the Home page's 3D scenes) waits for it, so building a scene
// never holds the menu back: the sidebar fetches its modules, renders them, and only then does the scene start.
// A page that doesn't wait is unaffected. Not a cache — nothing about the menu is stored here.

let ready = false;
const waiters = new Set();

/** The sidebar calls this once its menu request has finished (whether it brought modules or not). */
export function markMenuReady() {
  if (ready) return;
  ready = true;
  waiters.forEach((resolve) => resolve());
  waiters.clear();
}

/** Resolves when the menu is ready, or after `timeoutMs` at the latest (a slow or failed request never blocks a page). */
export function whenMenuReady(timeoutMs = 8000) {
  if (ready) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); waiters.delete(done); resolve(); };
    const timer = setTimeout(done, timeoutMs);
    waiters.add(done);
  });
}

/** For tests. */
export function resetMenuReady() {
  ready = false;
  waiters.clear();
}

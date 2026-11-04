import { markMenuReady, resetMenuReady, whenMenuReady } from "./menuReady";

describe("menu ready (the sidebar's menu before the Home page's heavy work)", () => {
  beforeEach(() => { resetMenuReady(); jest.useRealTimers(); });

  it("waits for the sidebar to say its menu is on screen", async () => {
    let done = false;
    const wait = whenMenuReady(10000).then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    markMenuReady();
    await wait;
    expect(done).toBe(true);
  });

  it("once ready, later waits resolve at once", async () => {
    markMenuReady();
    markMenuReady(); // twice is harmless
    await expect(whenMenuReady(10000)).resolves.toBeUndefined();
  });

  it("never waits longer than its limit, so a slow or failed menu request doesn't block the page", async () => {
    jest.useFakeTimers();
    let done = false;
    whenMenuReady(500).then(() => { done = true; });
    jest.advanceTimersByTime(499);
    await Promise.resolve();
    expect(done).toBe(false);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(done).toBe(true);
    jest.useRealTimers();
  });
});

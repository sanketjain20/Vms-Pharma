import { render, screen, waitFor, act } from "@testing-library/react";
import { useRef } from "react";
import useThreeScene, { clearSceneCache } from "./useThreeScene";

/* A stand-in three.js: just enough surface for the hook, with spies on the
   parts that matter (render, setSize, dispose, context loss). */
jest.mock("three", () => {
  const made = { renderers: [] };
  class WebGLRenderer {
    constructor() {
      this.domElement = global.document.createElement("canvas");
      this.shadowMap = {};
      this.setPixelRatio = jest.fn();
      this.setClearColor = jest.fn();
      this.setSize = jest.fn();
      this.render = jest.fn();
      this.dispose = jest.fn();
      this.forceContextLoss = jest.fn();
      made.renderers.push(this);
    }
  }
  class Scene {
    constructor() { this.objects = []; this.environment = null; }
    add(o) { this.objects.push(o); }
    traverse(fn) { fn(this); this.objects.forEach(fn); }
  }
  class PerspectiveCamera {
    constructor(fov, aspect) { this.fov = fov; this.aspect = aspect; this.updateProjectionMatrix = jest.fn(); }
  }
  return {
    __made: made,
    WebGLRenderer, Scene, PerspectiveCamera,
    SRGBColorSpace: "srgb", ACESFilmicToneMapping: 4, PCFSoftShadowMap: 2,
  };
});

const THREE = require("three");

function Host({ build, options }) {
  const ref = useRef(null);
  const status = useThreeScene(ref, build, options);
  return <div ref={ref} data-testid="host" data-status={status} />;
}

let rafQueue;
let now;
let ioCallback;
let reduceMotion;

beforeEach(() => {
  THREE.__made.renderers.length = 0;
  rafQueue = [];
  now = 0;
  reduceMotion = false;
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { rafQueue.push(cb); return rafQueue.length; });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => { rafQueue = []; });
  jest.spyOn(performance, "now").mockImplementation(() => now);
  window.matchMedia = () => ({ matches: reduceMotion, addEventListener() {}, removeEventListener() {} });
  window.IntersectionObserver = jest.fn(function (cb) {
    ioCallback = cb;
    this.observe = jest.fn();
    this.disconnect = jest.fn();
  });
  window.ResizeObserver = jest.fn(function () { this.observe = jest.fn(); this.disconnect = jest.fn(); });
});
afterEach(() => { clearSceneCache(); jest.restoreAllMocks(); });

const tick = (ms = 16) => {
  now += ms;
  const q = rafQueue; rafQueue = [];
  act(() => q.forEach((cb) => cb(now)));
};

it("builds once, draws a first frame, reports ready, then animates with elapsed time", async () => {
  const update = jest.fn();
  const build = jest.fn(() => ({ update }));
  render(<Host build={build} options={{ fov: 42 }} />);

  await waitFor(() => expect(screen.getByTestId("host")).toHaveAttribute("data-status", "ready"));
  expect(build).toHaveBeenCalledTimes(1);
  const ctx = build.mock.calls[0][0];
  expect(ctx.camera.fov).toBe(42);
  expect(ctx.pointer).toEqual({ x: 0, y: 0, tx: 0, ty: 0 });
  expect(screen.getByTestId("host")).toContainHTML("hc-scene-canvas");

  const renderer = THREE.__made.renderers[0];
  const framesBefore = renderer.render.mock.calls.length;
  tick(16);
  tick(16);
  expect(renderer.render.mock.calls.length).toBe(framesBefore + 2);
  const [t, dt] = update.mock.calls[update.mock.calls.length - 1];
  expect(t).toBeCloseTo(0.032, 5);
  expect(dt).toBeCloseTo(0.016, 5);
});

it("caps a long frame gap (tab was busy) so the animation doesn't lurch", () => {
  const update = jest.fn();
  render(<Host build={() => ({ update })} />);
  tick(2000);
  const [, dt] = update.mock.calls[update.mock.calls.length - 1];
  expect(dt).toBeCloseTo(0.05, 5);
});

it("stops rendering while scrolled off screen and resumes when back", () => {
  render(<Host build={() => ({ update: jest.fn() })} />);
  const renderer = THREE.__made.renderers[0];

  act(() => ioCallback([{ isIntersecting: false }]));
  const frozen = renderer.render.mock.calls.length;
  tick(); tick();
  expect(renderer.render.mock.calls.length).toBe(frozen);

  act(() => ioCallback([{ isIntersecting: true }]));
  tick();
  expect(renderer.render.mock.calls.length).toBe(frozen + 1);
});

it("with reduced motion draws one still frame at stillTime and never loops", () => {
  reduceMotion = true;
  const update = jest.fn();
  render(<Host build={() => ({ update, stillTime: 3.35 })} />);
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0][0]).toBe(3.35);
  expect(rafQueue).toHaveLength(0);
});

it("tracks the pointer over its box, easing toward it, and lets go when it leaves", () => {
  let ctx;
  render(<Host build={(c) => { ctx = c; return { update: jest.fn() }; }} />);
  jest.spyOn(screen.getByTestId("host"), "getBoundingClientRect")
    .mockReturnValue({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 });

  act(() => { window.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 200, clientY: 0 })); });
  expect(ctx.pointer.tx).toBe(1);
  expect(ctx.pointer.ty).toBe(1);
  tick(16);
  expect(ctx.pointer.x).toBeGreaterThan(0);
  expect(ctx.pointer.x).toBeLessThan(1);

  act(() => { window.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 500, clientY: 500 })); });
  expect(ctx.pointer.tx).toBe(0);
});

it("disposes everything on unmount: scene resources, the scene's own dispose, the renderer and its GL context", () => {
  const texture = { isTexture: true, dispose: jest.fn() };
  const material = { map: texture, dispose: jest.fn() };
  const geometry = { dispose: jest.fn() };
  const sceneDispose = jest.fn();
  const { unmount } = render(
    <Host build={({ scene }) => { scene.add({ geometry, material }); return { update: jest.fn(), dispose: sceneDispose }; }} />
  );
  const renderer = THREE.__made.renderers[0];
  const host = screen.getByTestId("host");

  unmount();
  expect(sceneDispose).toHaveBeenCalled();
  expect(geometry.dispose).toHaveBeenCalled();
  expect(material.dispose).toHaveBeenCalled();
  expect(texture.dispose).toHaveBeenCalled();
  expect(renderer.dispose).toHaveBeenCalled();
  expect(renderer.forceContextLoss).toHaveBeenCalled();
  expect(host).toBeEmptyDOMElement();
  const framesAtUnmount = renderer.render.mock.calls.length;
  tick();
  expect(renderer.render.mock.calls.length).toBe(framesAtUnmount); // the loop was cancelled
});

it("a scene that throws while building reports 'failed' and frees the renderer", async () => {
  render(<Host build={() => { throw new Error("bad scene"); }} />);
  await waitFor(() => expect(screen.getByTestId("host")).toHaveAttribute("data-status", "failed"));
  expect(THREE.__made.renderers[0].dispose).toHaveBeenCalled();
  expect(screen.getByTestId("host")).toBeEmptyDOMElement();
});

it("passes the app theme to the scene and repaints when <body data-theme> flips", async () => {
  document.body.setAttribute("data-theme", "dark");
  const setTheme = jest.fn();
  let ctx;
  render(<Host build={(c) => { ctx = c; return { update: jest.fn(), setTheme }; }} />);
  expect(ctx.theme).toBe("dark");
  expect(setTheme).toHaveBeenLastCalledWith("dark");

  const renderer = THREE.__made.renderers[0];
  act(() => ioCallback([{ isIntersecting: false }]));          // paused: a theme flip must still repaint once
  const frames = renderer.render.mock.calls.length;
  act(() => { document.body.setAttribute("data-theme", "light"); });
  await waitFor(() => expect(setTheme).toHaveBeenLastCalledWith("light"));
  expect(renderer.render.mock.calls.length).toBe(frames + 1);

  setTheme.mockClear();
  act(() => { document.body.setAttribute("data-theme", "light"); });   // same theme again: nothing to do
  await new Promise((r) => setTimeout(r, 0));
  expect(setTheme).not.toHaveBeenCalled();
  document.body.removeAttribute("data-theme");
});

/* ── kept scenes and deferred builds (the Home page) ── */

const flushTimers = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

it("with a cacheKey, leaving keeps the built scene and coming back re-attaches it without building again", () => {
  const update = jest.fn();
  const build = jest.fn(() => ({ update }));
  const first = render(<Host build={build} options={{ cacheKey: "home-a" }} />);
  const renderer = THREE.__made.renderers[0];
  tick(16); tick(16);
  first.unmount();
  expect(renderer.dispose).not.toHaveBeenCalled();             // kept, not thrown away
  expect(renderer.domElement.isConnected).toBe(false);          // but off the page

  render(<Host build={build} options={{ cacheKey: "home-a" }} />);
  expect(build).toHaveBeenCalledTimes(1);                        // not built again
  expect(THREE.__made.renderers).toHaveLength(1);                // the same GL context
  expect(screen.getByTestId("host")).toHaveAttribute("data-status", "ready");
  expect(screen.getByTestId("host").contains(renderer.domElement)).toBe(true);
  tick(16);
  const [t] = update.mock.calls[update.mock.calls.length - 1];
  expect(t).toBeCloseTo(0.048, 5);                               // the animation carries on where it was
});

it("a kept scene that missed a theme flip while away gets the new theme on return", () => {
  document.body.setAttribute("data-theme", "dark");
  const setTheme = jest.fn();
  const first = render(<Host build={() => ({ update: jest.fn(), setTheme })} options={{ cacheKey: "home-b" }} />);
  first.unmount();
  document.body.setAttribute("data-theme", "light");
  render(<Host build={() => ({ update: jest.fn(), setTheme })} options={{ cacheKey: "home-b" }} />);
  expect(setTheme).toHaveBeenLastCalledWith("light");
  document.body.removeAttribute("data-theme");
});

it("clearSceneCache frees kept scenes", () => {
  const first = render(<Host build={() => ({ update: jest.fn() })} options={{ cacheKey: "home-c" }} />);
  first.unmount();
  clearSceneCache();
  expect(THREE.__made.renderers[0].dispose).toHaveBeenCalled();
  expect(THREE.__made.renderers[0].forceContextLoss).toHaveBeenCalled();
});

it("deferUntil: nothing is built until it resolves, then after the next paint", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const build = jest.fn(() => ({ update: jest.fn() }));
  render(<Host build={build} options={{ deferUntil: () => gate }} />);
  await flushTimers();
  expect(build).not.toHaveBeenCalled();
  expect(screen.getByTestId("host")).toHaveAttribute("data-status", "loading");

  await act(async () => { release(); await gate; });
  tick();                 // the paint
  await flushTimers();    // then the build
  expect(build).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("host")).toHaveAttribute("data-status", "ready");
});

it("buildWhenVisible: built only once the host comes near the screen", async () => {
  const build = jest.fn(() => ({ update: jest.fn() }));
  render(<Host build={build} options={{ buildWhenVisible: true }} />);
  await flushTimers();
  expect(build).not.toHaveBeenCalled();
  act(() => ioCallback([{ isIntersecting: false }]));
  expect(build).not.toHaveBeenCalled();
  await act(async () => { ioCallback([{ isIntersecting: true }]); });
  tick();
  await flushTimers();
  expect(build).toHaveBeenCalledTimes(1);
});

it("leaving before a deferred build starts never builds it", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const build = jest.fn(() => ({ update: jest.fn() }));
  const view = render(<Host build={build} options={{ deferUntil: () => gate }} />);
  view.unmount();
  await act(async () => { release(); await gate; });
  tick();
  await flushTimers();
  expect(build).not.toHaveBeenCalled();
  expect(THREE.__made.renderers).toHaveLength(0);
});

it("a kept scene comes back at once, without waiting for deferUntil or visibility again", () => {
  const build = jest.fn(() => ({ update: jest.fn() }));
  const first = render(<Host build={build} options={{ cacheKey: "home-d" }} />);
  first.unmount();
  const never = () => new Promise(() => {});
  render(<Host build={build} options={{ cacheKey: "home-d", deferUntil: never, buildWhenVisible: true }} />);
  expect(screen.getByTestId("host")).toHaveAttribute("data-status", "ready");
  expect(build).toHaveBeenCalledTimes(1);
});

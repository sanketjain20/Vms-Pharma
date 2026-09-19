import { toast } from "react-toastify";
import apiClient from "./apiClient";

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn() },
}));

describe("apiClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    global.fetch = jest.fn();
  });

  it("returns the response and does not toast when the request succeeds", async () => {
    const fakeResponse = { status: 200, json: async () => ({}) };
    global.fetch.mockResolvedValue(fakeResponse);

    const res = await apiClient("/api/Foo/Get", { method: "GET" });

    expect(res).toBe(fakeResponse);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows a 'contact the admin' toast and rethrows when the backend is unreachable", async () => {
    const networkError = new TypeError("Failed to fetch");
    global.fetch.mockRejectedValue(networkError);

    await expect(apiClient("/api/Foo/Get", { method: "GET" })).rejects.toBe(networkError);

    expect(toast.error).toHaveBeenCalledWith("Unable to reach the server. Please contact the admin.", {
      toastId: "vms-api-unreachable",
    });
  });

  it("uses the same toastId on repeated failures so react-toastify can dedupe them", async () => {
    global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiClient("/api/Foo/Get")).rejects.toThrow();
    await expect(apiClient("/api/Bar/Get")).rejects.toThrow();

    expect(toast.error).toHaveBeenCalledTimes(2);
    const toastIds = toast.error.mock.calls.map(([, opts]) => opts.toastId);
    expect(new Set(toastIds).size).toBe(1);
  });

  it("does not toast when the backend responds with an error status (not unreachable)", async () => {
    const fakeResponse = { status: 500, json: async () => ({ message: "Something broke" }) };
    global.fetch.mockResolvedValue(fakeResponse);

    const res = await apiClient("/api/Foo/Get", { method: "GET" });

    expect(res).toBe(fakeResponse);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("attaches the Authorization header from the stored token", async () => {
    window.localStorage.setItem("vmsUser", JSON.stringify({ data: { token: "abc123" } }));
    const fakeResponse = { status: 200, json: async () => ({}) };
    global.fetch.mockResolvedValue(fakeResponse);

    await apiClient("/api/Foo/Get", { method: "GET" });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.get("Authorization")).toBe("Bearer abc123");
  });

  it("clears stored auth and redirects to / on a 401 outside /api/auth", async () => {
    const originalLocation = window.location;
    const replaceSpy = jest.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, pathname: "/master/dashboard", replace: replaceSpy },
    });
    const fakeResponse = { status: 401, json: async () => ({}) };
    global.fetch.mockResolvedValue(fakeResponse);
    window.localStorage.setItem("vmsUser", JSON.stringify({ data: { token: "abc" } }));
    window.localStorage.setItem("modules", JSON.stringify([]));

    await apiClient("/api/Foo/Get", { method: "GET" });

    expect(window.localStorage.getItem("vmsUser")).toBeNull();
    expect(replaceSpy).toHaveBeenCalledWith("/");

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });
});

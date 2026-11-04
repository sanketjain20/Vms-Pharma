import apiClient from "../Config/apiClient";
import { fetchBusinessProfile, resetBusinessProfile, saveBusinessProfile, PHARMA_PROFILE } from "./businessProfile";

jest.mock("../Config/apiClient");

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const login = (token) => localStorage.setItem("vmsUser", JSON.stringify({ data: { token } }));

describe("businessProfile", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); localStorage.clear(); });

  it("reads the shop's profile", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, data: { businessType: "CLOTHING", trackExpiry: false, isPharma: false, canChange: true } }));
    await expect(fetchBusinessProfile()).resolves.toMatchObject({ businessType: "CLOTHING", trackExpiry: false, isPharma: false });
    expect(apiClient.mock.calls[0][0]).toMatch(/\/api\/BusinessSetting\/Get$/);
  });

  it("is a pharmacy that tracks expiry when the profile can't be read, so nothing a pharmacy relies on disappears", async () => {
    apiClient.mockImplementation(() => Promise.reject(new Error("offline")));
    await expect(fetchBusinessProfile()).resolves.toEqual(PHARMA_PROFILE);
    resetBusinessProfile();
    apiClient.mockImplementation(() => ok({ status: 404, data: null }));
    await expect(fetchBusinessProfile()).resolves.toEqual(PHARMA_PROFILE);
  });

  it("asks once per login and again for a different user", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, data: { businessType: "CLOTHING" } }));
    login("a");
    await fetchBusinessProfile();
    await fetchBusinessProfile();
    expect(apiClient).toHaveBeenCalledTimes(1);
    login("b");
    await fetchBusinessProfile();
    expect(apiClient).toHaveBeenCalledTimes(2);
  });

  it("saving sends the type and switch, and the next read is fresh", async () => {
    apiClient.mockImplementation((url, opts) => (opts?.method === "PUT"
      ? ok({ status: 200, message: "Clothing / textiles saved." })
      : ok({ status: 200, data: { businessType: "PHARMA" } })));
    await fetchBusinessProfile();
    await expect(saveBusinessProfile({ businessType: "CLOTHING", trackExpiry: false })).resolves.toMatchObject({ status: 200 });
    const put = apiClient.mock.calls.find(([, o]) => o?.method === "PUT");
    expect(put[0]).toMatch(/\/api\/BusinessSetting\/Save$/);
    expect(JSON.parse(put[1].body)).toEqual({ businessType: "CLOTHING", trackExpiry: false });
    await fetchBusinessProfile();
    expect(apiClient.mock.calls.filter(([u]) => u.includes("/Get"))).toHaveLength(2);
  });
});

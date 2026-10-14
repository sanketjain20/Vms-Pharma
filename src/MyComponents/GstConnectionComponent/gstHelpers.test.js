import { bannerTone, credentialProblem, credentialRequest, formFrom, modeTag, normalizeGstin } from "./gstHelpers";

const GOOD = { gstin: "27AAPFU0939F1ZV", environment: "SANDBOX", enabled: true, username: "u", password: "p", clientId: "c", clientSecret: "s" };

describe("modeTag", () => {
  it("tags simulated and sandbox documents so they can't be mistaken for real ones", () => {
    expect(modeTag("STUB")).toMatchObject({ label: "TEST · simulated", tone: "warning" });
    expect(modeTag("STUB").title).toMatch(/not registered/i);
    expect(modeTag("SANDBOX")).toMatchObject({ label: "TEST · sandbox", tone: "warning" });
    expect(modeTag("SANDBOX").title).toMatch(/no legal effect/i);
  });

  it("tags nothing for a real document or an old record from before modes existed", () => {
    expect(modeTag("PRODUCTION")).toBeNull();
    expect(modeTag(null)).toBeNull();
    expect(modeTag(undefined)).toBeNull();
    expect(modeTag("SOMETHING_ELSE")).toBeNull();
  });
});

describe("bannerTone", () => {
  it("is danger when blocked, warning for test modes, and no banner when live", () => {
    expect(bannerTone("BLOCKED")).toBe("danger");
    expect(bannerTone("TEST")).toBe("warning");
    expect(bannerTone("LIVE")).toBeNull();
    expect(bannerTone(undefined)).toBeNull();
  });
});

describe("credentialProblem", () => {
  it("accepts a complete form", () => {
    expect(credentialProblem(GOOD, null)).toBeNull();
  });

  it("wants the business's own GSTIN in the right shape, ignoring case and spaces", () => {
    expect(credentialProblem({ ...GOOD, gstin: "" }, null)).toMatch(/GSTIN/);
    expect(credentialProblem({ ...GOOD, gstin: "12345" }, null)).toMatch(/GSTIN/);
    expect(credentialProblem({ ...GOOD, gstin: "27AAPFU0939F1Z" }, null)).toMatch(/GSTIN/); // 14 characters
    expect(credentialProblem({ ...GOOD, gstin: " 27aapfu0939f1zv " }, null)).toBeNull();
  });

  it("needs a real environment", () => {
    expect(credentialProblem({ ...GOOD, environment: "" }, null)).toMatch(/SANDBOX or PRODUCTION/);
    expect(credentialProblem({ ...GOOD, environment: "STAGING" }, null)).toMatch(/SANDBOX or PRODUCTION/);
    expect(credentialProblem({ ...GOOD, environment: "PRODUCTION" }, null)).toBeNull();
  });

  it("needs all four secrets the first time and names the missing ones", () => {
    const p = credentialProblem({ ...GOOD, username: "", clientSecret: "  " }, null);
    expect(p).toMatch(/username/);
    expect(p).toMatch(/client secret/);
    expect(p).not.toMatch(/password/);
  });

  it("lets a secret stay blank when one is already saved", () => {
    const saved = { hasUsername: true, hasPassword: true, hasClientId: true, hasClientSecret: true };
    expect(credentialProblem({ ...GOOD, username: "", password: "", clientId: "", clientSecret: "" }, saved)).toBeNull();
    // ...but only the ones that are saved
    expect(credentialProblem({ ...GOOD, password: "" }, { hasPassword: false })).toMatch(/password/i);
  });

  it("refuses an over-long secret before the server has to", () => {
    expect(credentialProblem({ ...GOOD, password: "x".repeat(151) }, null)).toMatch(/too long/);
  });
});

describe("credentialRequest and formFrom", () => {
  it("builds the request with a tidied GSTIN and blanks for unchanged secrets", () => {
    expect(credentialRequest("EINVOICE", { ...GOOD, gstin: " 27aapfu0939f1zv ", password: undefined })).toEqual({
      credentialType: "EINVOICE", gstin: "27AAPFU0939F1ZV", environment: "SANDBOX", enabled: true,
      username: "u", password: "", clientId: "c", clientSecret: "s",
    });
  });

  it("starts a form from what is saved, with the secrets blank (they are never sent back)", () => {
    expect(formFrom({ gstin: "27AAPFU0939F1ZV", environment: "PRODUCTION", enabled: true })).toEqual({
      gstin: "27AAPFU0939F1ZV", environment: "PRODUCTION", enabled: true, username: "", password: "", clientId: "", clientSecret: "",
    });
    expect(formFrom(null)).toMatchObject({ gstin: "", environment: "SANDBOX", enabled: false });
  });

  it("normalizeGstin", () => {
    expect(normalizeGstin(" 27aapfu0939f1zv ")).toBe("27AAPFU0939F1ZV");
    expect(normalizeGstin(null)).toBe("");
  });
});

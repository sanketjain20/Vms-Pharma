import { normalizeMobile, resolveWalkIn, formatMobile, MAX_NAME_LENGTH } from "./walkInCustomer";

/* Same cases as the backend's WalkInCustomerTest: the screen must refuse exactly what the server would. */
describe("walk-in customer rules", () => {
  it.each([
    "9876543210", "98765 43210", "98765-43210", "+91 98765 43210", "+919876543210",
    "919876543210", "09876543210", "(98765) 43210", " 9876543210 ",
  ])("accepts %p as 9876543210", (typed) => {
    expect(normalizeMobile(typed)).toBe("9876543210");
  });

  it.each(["12345", "5876543210", "98765432101", "98765abcde", "+1 415 555 0100", "0000000000", "", null])(
    "refuses %p", (typed) => {
      expect(normalizeMobile(typed)).toBeNull();
    });

  it("a retailer bill sends no walk-in details and never errors", () => {
    expect(resolveWalkIn({ retailerId: "5", name: "Ravi", phone: "12" }))
      .toEqual({ customerName: null, customerPhone: null, errors: {} });
  });

  it("trims and collapses the name, and sends nothing for blank fields", () => {
    expect(resolveWalkIn({ retailerId: "", name: "  Ravi   Kumar ", phone: "" }))
      .toEqual({ customerName: "Ravi Kumar", customerPhone: null, errors: {} });
    expect(resolveWalkIn({ retailerId: null, name: "   ", phone: "  " }))
      .toEqual({ customerName: null, customerPhone: null, errors: {} });
  });

  it("normalises a valid mobile and flags an invalid one", () => {
    expect(resolveWalkIn({ name: "", phone: "+91 98765-43210" }).customerPhone).toBe("9876543210");
    expect(resolveWalkIn({ name: "", phone: "55555" }).errors.customerPhone).toMatch(/10-digit mobile/);
  });

  it("flags a name longer than the column", () => {
    expect(resolveWalkIn({ name: "a".repeat(MAX_NAME_LENGTH + 1) }).errors.customerName).toMatch(/150/);
    expect(resolveWalkIn({ name: "a".repeat(MAX_NAME_LENGTH) }).errors).toEqual({});
  });

  it("formats a mobile as 5 + 5 for display and leaves anything else as typed", () => {
    expect(formatMobile("9876543210")).toBe("98765 43210");
    expect(formatMobile("123")).toBe("123");
    expect(formatMobile(null)).toBe("");
  });
});

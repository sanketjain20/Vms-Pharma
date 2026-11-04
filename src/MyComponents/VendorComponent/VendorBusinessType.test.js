import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VendorAdd from "./VendorAdd";
import BusinessTypeFields, { businessTypeLabel } from "./BusinessTypeFields";
import { guideFor } from "../VendorOnboarding";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

describe("Business type at onboarding (Phase 7)", () => {
  beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

  it("picking a type picks its usual expiry setting; a pharmacy always tracks expiry", () => {
    const onChange = jest.fn();
    const { rerender } = render(<BusinessTypeFields businessType="PHARMA" trackExpiry onChange={onChange} />);
    expect(screen.getByTestId("vendor-track-expiry")).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Business type/), { target: { value: "CLOTHING" } });
    expect(onChange).toHaveBeenCalledWith({ businessType: "CLOTHING", trackExpiry: false });

    rerender(<BusinessTypeFields businessType="GROCERY" trackExpiry onChange={onChange} />);
    expect(screen.getByTestId("vendor-track-expiry")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("vendor-track-expiry"));
    expect(onChange).toHaveBeenLastCalledWith({ businessType: "GROCERY", trackExpiry: false });
    expect(businessTypeLabel("ELECTRONICS")).toBe("Electronics");
  });

  it("a new shop is created with the business type chosen", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Roles/getAll")) return ok({ status: 200, data: [{ id: 10, roleName: "Owner" }] });
      return ok({ status: 200 });
    });
    const { container } = render(<VendorAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    fireEvent.change(await screen.findByLabelText(/Business type/), { target: { value: "ELECTRONICS" } });
    // fill every required field with something valid
    container.querySelectorAll("input:not([type=checkbox]), textarea").forEach((el, i) => {
      const value = el.type === "date" ? "2027-10-01" : el.type === "number" ? "0" : el.type === "email" ? "ravi@shop.in" : `X${i}`;
      fireEvent.change(el, { target: { value } });
    });
    const role = Array.from(container.querySelectorAll("select")).find((s) => s.textContent.includes("Owner"));
    fireEvent.change(role, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Vendor|Save|Create/i }));
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Vendor/AddVendor"))).toBe(true));
    const body = JSON.parse(apiClient.mock.calls.find(([u]) => u.includes("/api/Vendor/AddVendor"))[1].body);
    expect(body).toMatchObject({ businessType: "ELECTRONICS", trackExpiry: false });
  });

  it("the onboarding guide speaks the shop's language", () => {
    const pharmacy = guideFor({ isPharma: true, trackExpiry: true });
    const cloth = guideFor({ isPharma: false, trackExpiry: false });
    expect(pharmacy.modules.find((m) => m.id === "retailer").name).toBe("Retailers");
    expect(cloth.modules.find((m) => m.id === "retailer").name).toBe("Customers");
    expect(cloth.modules.find((m) => m.id === "product").summary).not.toMatch(/medicine/i);
    expect(cloth.modules.find((m) => m.id === "alerts").name).toBe("Reorder alerts");
    expect(cloth.hints.product).toBe("Build your product list — name, selling price, GST.");
    expect(pharmacy.hints.product).toMatch(/medicine/);
  });
});

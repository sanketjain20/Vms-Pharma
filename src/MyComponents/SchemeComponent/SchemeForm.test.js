import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SchemeForm, { validateScheme, toRequest } from "./SchemeForm";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const base = {
  name: "Diwali", schemeType: "FREE_QUANTITY", productId: "", retailerId: "", buyQuantity: "10", freeQuantity: "1",
  discountPercent: "", repeatable: true, validFrom: "2026-10-01", validTo: "",
};

describe("validateScheme", () => {
  it("accepts a good Buy 10 Get 1 and a good percentage scheme", () => {
    expect(validateScheme(base)).toEqual({});
    expect(validateScheme({ ...base, schemeType: "PERCENT_DISCOUNT", discountPercent: "10", buyQuantity: "", freeQuantity: "" })).toEqual({});
  });

  it("needs a name and a start date", () => {
    expect(validateScheme({ ...base, name: "  " }).name).toBeTruthy();
    expect(validateScheme({ ...base, validFrom: "" }).validFrom).toBeTruthy();
  });

  it("rejects an end date before the start", () => {
    expect(validateScheme({ ...base, validTo: "2026-09-30" }).validTo).toBeTruthy();
    expect(validateScheme({ ...base, validTo: "2026-10-01" }).validTo).toBeUndefined();
  });

  it("free quantity needs whole numbers of 1 or more for both buy and get", () => {
    ["0", "-1", "1.5", "abc", ""].forEach((v) => {
      expect(validateScheme({ ...base, buyQuantity: v }).buyQuantity).toBeTruthy();
      expect(validateScheme({ ...base, freeQuantity: v }).freeQuantity).toBeTruthy();
    });
  });

  it("a percentage must be above 0 and at most 100", () => {
    const pct = (v) => validateScheme({ ...base, schemeType: "PERCENT_DISCOUNT", discountPercent: v, buyQuantity: "" }).discountPercent;
    ["0", "-5", "100.5", "", "abc"].forEach((v) => expect(pct(v)).toBeTruthy());
    ["0.5", "10", "100"].forEach((v) => expect(pct(v)).toBeUndefined());
  });

  it("a percentage scheme's minimum quantity is optional, but must be a whole number when given", () => {
    const min = (v) => validateScheme({ ...base, schemeType: "PERCENT_DISCOUNT", discountPercent: "10", buyQuantity: v }).buyQuantity;
    expect(min("")).toBeUndefined();
    expect(min("5")).toBeUndefined();
    expect(min("0")).toBeTruthy();
    expect(min("2.5")).toBeTruthy();
  });
});

describe("toRequest", () => {
  it("sends a free-quantity scheme with no percentage", () => {
    expect(toRequest({ ...base, productId: "4", retailerId: "9", name: " Diwali " })).toEqual({
      name: "Diwali", schemeType: "FREE_QUANTITY", productId: 4, retailerId: 9, buyQuantity: 10, freeQuantity: 1,
      discountPercent: null, repeatable: true, validFrom: "2026-10-01", validTo: null,
    });
  });

  it("sends a percentage scheme with no free quantity, and 'all products / retailers' as null", () => {
    expect(toRequest({ ...base, schemeType: "PERCENT_DISCOUNT", discountPercent: "12.5", buyQuantity: "", freeQuantity: "7", validTo: "2026-12-31" })).toEqual({
      name: "Diwali", schemeType: "PERCENT_DISCOUNT", productId: null, retailerId: null, buyQuantity: null, freeQuantity: null,
      discountPercent: 12.5, repeatable: true, validFrom: "2026-10-01", validTo: "2026-12-31",
    });
  });
});

describe("SchemeForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.mockImplementation((url, options) => {
      if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [{ id: 4, name: "Paracetamol" }] });
      if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 9, shopName: "Shop Nine", ownerName: "Owner" }] });
      if (url.includes("/api/Scheme/GetByUKey/")) {
        return ok({ status: 200, data: {
          name: "Existing", schemeType: "PERCENT_DISCOUNT", productId: 4, retailerId: null, buyQuantity: 5, freeQuantity: null,
          discountPercent: 10, repeatable: true, validFrom: "2026-01-01", validTo: "2026-12-31",
        } });
      }
      if (url.includes("/api/Scheme/Add") || url.includes("/api/Scheme/Update/")) return ok({ status: 200, message: "Saved" });
      return ok({ status: 200, data: null });
    });
  });

  const saveCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Scheme/Add") || u.includes("/api/Scheme/Update/"));

  it("adds a Buy 10 Get 1 scheme for a product", async () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    render(<SchemeForm onSubmit={onSubmit} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/Diwali Buy 10 Get 1/), { target: { value: "Buy 10 Get 1" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 10"), { target: { value: "10" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 1"), { target: { value: "1" } });
    await screen.findByRole("option", { name: "Paracetamol" });
    fireEvent.change(screen.getByDisplayValue("All products"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Scheme" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [url, options] = saveCall();
    expect(url).toMatch(/\/api\/Scheme\/Add$/);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toMatchObject({ name: "Buy 10 Get 1", schemeType: "FREE_QUANTITY", productId: 4, retailerId: null, buyQuantity: 10, freeQuantity: 1 });
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows what is wrong and does not call the server", async () => {
    render(<SchemeForm onSubmit={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Scheme" }));

    expect(await screen.findByText("Give the scheme a name")).toBeInTheDocument();
    expect(screen.getAllByText("Enter a whole number, 1 or more")).toHaveLength(2);
    expect(saveCall()).toBeUndefined();
  });

  it("switching to a percentage scheme swaps the fields", async () => {
    render(<SchemeForm onSubmit={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(/Get free/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Percentage discount" }));

    expect(screen.queryByText(/Get free/)).not.toBeInTheDocument();
    expect(screen.getByText(/Discount %/)).toBeInTheDocument();
  });

  it("keeps the server's message in the form when it refuses", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Scheme/Add")) return ok({ status: 400, message: "That product does not exist." });
      return ok({ data: [] });
    });
    const onClose = jest.fn();
    render(<SchemeForm onSubmit={jest.fn()} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/Diwali Buy 10 Get 1/), { target: { value: "X" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 10"), { target: { value: "10" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 1"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Scheme" }));

    expect(await screen.findByText("That product does not exist.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("edit loads the scheme, and saves it back with PUT", async () => {
    const onSubmit = jest.fn();
    render(<SchemeForm uKey="abc" onSubmit={onSubmit} onClose={jest.fn()} />);

    expect(await screen.findByDisplayValue("Existing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument(); // the percentage
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();  // the minimum quantity

    fireEvent.change(screen.getByDisplayValue("Existing"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Scheme" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [url, options] = saveCall();
    expect(url).toMatch(/\/api\/Scheme\/Update\/abc$/);
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toMatchObject({ name: "Renamed", schemeType: "PERCENT_DISCOUNT", discountPercent: 10, buyQuantity: 5, productId: 4 });
  });
});

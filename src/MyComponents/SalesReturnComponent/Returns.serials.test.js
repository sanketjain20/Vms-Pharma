import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesReturnAdd from "./SalesReturnAdd";
import PurchaseReturnAdd from "../PurchaseReturnComponent/PurchaseReturnAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

describe("Returns of a product with serial numbers (Phase 6)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("a customer return names which units come back; the quantity follows them", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Sales/GetSalesByInvoiceNumber")) {
        return ok({ status: 200, data: { invoiceNumber: "INV40", items: [
          { id: 400, product: "Phone X", sellingPrice: 10000, quantity: 2, serials: ["IMEI1", "IMEI2"] },
          { id: 401, product: "USB Cable", sellingPrice: 200, quantity: 3 },
        ] } });
      }
      if (url.includes("/api/SalesReturn/")) return ok({ status: 200, message: "Return saved", data: {} });
      return ok({ status: 200, data: null });
    });
    render(<SalesReturnAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "INV40" } });
    fireEvent.click(screen.getByRole("button", { name: /fetch|load|find/i }));
    const pick = await screen.findByTestId("return-serials");
    fireEvent.click(within(pick).getByRole("button", { name: /^IMEI2/ }));
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByRole("spinbutton")).toHaveValue(1);
    expect(within(rows[1]).getByRole("spinbutton")).toBeDisabled();
    expect(within(rows[2]).getByRole("spinbutton")).not.toBeDisabled(); // the cable has no serials
  });

  it("a purchase return offers only the units still in stock, and sends the ones picked", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Purchase/GetPurchaseByPurchaseNumber")) {
        return ok({ status: 200, data: { purchaseNumber: "PUR9", uKey: "p9", items: [
          { id: 55, productName: "Phone X", costPrice: 9000, effectiveCost: 8000, quantity: 2, freeQuantity: 1, gstRate: 0, serials: ["IMEI1", "IMEI2", "IMEI3"] },
        ] } });
      }
      if (url.includes("/api/Serial/PurchaseLine/55")) {
        return ok({ status: 200, data: [{ serialNo: "IMEI1", status: "SOLD" }, { serialNo: "IMEI2", status: "IN_STOCK" }, { serialNo: "IMEI3", status: "IN_STOCK" }] });
      }
      if (url.includes("/api/PurchaseReturn/AddPurchaseReturn")) return ok({ status: 200, message: "Return saved", data: {} });
      return ok({ status: 200, data: null });
    });
    render(<PurchaseReturnAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "PUR9" } });
    fireEvent.click(screen.getByRole("button", { name: /fetch|load|find/i }));
    const pick = await screen.findByTestId("return-serials");
    await waitFor(() => expect(within(pick).getByRole("button", { name: /^IMEI2/ })).toBeInTheDocument());
    expect(within(pick).queryByRole("button", { name: /^IMEI1/ })).not.toBeInTheDocument(); // sold: can't go back
    fireEvent.click(within(pick).getByRole("button", { name: /^IMEI3/ }));
    fireEvent.change(screen.getByPlaceholderText(/Damaged stock/), { target: { value: "Faulty unit" } });

    const submit = screen.getAllByRole("button").find((b) => /return/i.test(b.textContent) && /submit|save|create|process/i.test(b.textContent));
    fireEvent.click(submit);
    await waitFor(() => expect(call("/api/PurchaseReturn/AddPurchaseReturn")).toBeTruthy());
    expect(JSON.parse(call("/api/PurchaseReturn/AddPurchaseReturn")[1].body).items).toEqual([
      expect.objectContaining({ purchaseItemId: 55, returnQuantity: 1, serials: ["IMEI3"] }),
    ]);
  });
});

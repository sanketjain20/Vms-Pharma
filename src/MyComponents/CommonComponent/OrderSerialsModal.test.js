import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import OrderSerialsModal, { pendingOf, serialLinesOf } from "./OrderSerialsModal";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

describe("Turning an order into a purchase / invoice: serial numbers (Phase 7)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("only the pending lines of products that track serials need them", () => {
    const order = { items: [
      { id: 1, productId: 7, productName: "Phone X", quantity: 5, receivedQuantity: 2 },
      { id: 2, productId: 8, productName: "Cable", quantity: 3 },
      { id: 3, productId: 7, productName: "Phone X", quantity: 2, pendingQuantity: 0 },
    ] };
    expect(pendingOf(order.items[0])).toBe(3);
    expect(serialLinesOf(order, new Set(["7"]))).toEqual([{ itemId: 1, productId: 7, productName: "Phone X", quantity: 3 }]);
  });

  it("receiving types one serial per unit; the window won't finish until each line has them all", () => {
    const onDone = jest.fn();
    render(<OrderSerialsModal mode="receive" lines={[{ itemId: 1, productId: 7, productName: "Phone X", quantity: 2 }]}
      onDone={onDone} onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Serial numbers"), { target: { value: "imei1" } });
    fireEvent.click(screen.getByRole("button", { name: "Receive goods" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Phone X");
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Serial numbers"), { target: { value: "imei1\nimei2" } });
    fireEvent.click(screen.getByRole("button", { name: "Receive goods" }));
    expect(onDone).toHaveBeenCalledWith({ 1: ["IMEI1", "IMEI2"] });
  });

  it("billing picks the units in stock in the order's godown", async () => {
    apiClient.mockImplementation((url) => (url.includes("/api/Serial/InStock/7?godownId=4")
      ? ok({ status: 200, data: [{ serialNo: "IMEI1" }, { serialNo: "IMEI2" }] }) : ok({ status: 200, data: [] })));
    const onDone = jest.fn();
    render(<OrderSerialsModal mode="pick" godownId={4} lines={[{ itemId: 9, productId: 7, productName: "Phone X", quantity: 1 }]}
      onDone={onDone} onClose={jest.fn()} />);
    const picker = await screen.findByTestId("order-serials-9");
    fireEvent.click(await within(picker).findByRole("button", { name: /^IMEI2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create invoice" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ 9: ["IMEI2"] }));
  });
});

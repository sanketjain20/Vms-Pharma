import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LinePriceCell, { listPriceOf } from "./LinePriceCell";

const PRODUCT = { id: 1, sellingPrice: 100, costPrice: 60, gstRate: 18 };

function Harness({ initial, product = PRODUCT, canChange = true, onChange = () => {} }) {
  const [line, setLine] = useState(initial);
  return <LinePriceCell line={line} product={product} canChange={canChange} onChange={(p) => { setLine({ ...line, ...p }); onChange(p); }} />;
}

const line = (o = {}) => ({ productId: 1, sellingPrice: 100, priceIncludesGst: false, productGstRate: 18, ...o });
const open = () => fireEvent.click(screen.getByRole("button", { name: "Change price" }));
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("LinePriceCell — price change at the counter", () => {
  it("shows the price; without the permission there is nothing to change", () => {
    render(<Harness initial={line()} canChange={false} />);
    expect(screen.getByTestId("line-price-value")).toHaveTextContent("100.00");
    expect(screen.queryByRole("button", { name: "Change price" })).toBeNull();
  });

  it("a new price needs a reason, then shows what it was changed from", () => {
    const onChange = jest.fn();
    render(<Harness initial={line()} onChange={onChange} />);
    open();
    expect(screen.getByTestId("line-price-editor")).toHaveTextContent("Product price ₹100.00 · avg cost ₹60.00");
    type("New price for this line", "90");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Give a reason for the price change");
    type("Reason for the price change", "  Regular customer ");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).toHaveBeenLastCalledWith({ sellingPrice: 90, priceOverrideReason: "Regular customer", belowCostConfirmed: false });
    expect(screen.getByTestId("line-price-value")).toHaveTextContent("90.00");
    expect(screen.getByTestId("line-price-changed")).toHaveTextContent("Changed from ₹100.00 · Regular customer");
  });

  it("below the average cost only once confirmed", () => {
    const onChange = jest.fn();
    render(<Harness initial={line()} onChange={onChange} />);
    open();
    type("New price for this line", "55");
    type("Reason for the price change", "Clearance");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("below the average cost of ₹60.00");
    fireEvent.click(screen.getByLabelText("Sell below cost"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).toHaveBeenLastCalledWith({ sellingPrice: 55, priceOverrideReason: "Clearance", belowCostConfirmed: true });
    expect(screen.getByTestId("line-price-changed")).toHaveTextContent("below cost");
  });

  it("a price including GST is compared with the cost before GST", () => {
    // 70 incl. 18% GST is 59.32 before GST: below the 60 cost
    render(<Harness initial={line({ sellingPrice: 118, priceIncludesGst: true })} product={{ ...PRODUCT, sellingPrice: 118 }} />);
    open();
    type("New price for this line", "70");
    expect(screen.getByLabelText("Sell below cost")).toBeInTheDocument();
    type("New price for this line", "71");
    expect(screen.queryByLabelText("Sell below cost")).toBeNull();
  });

  it("back to the product price drops the reason", () => {
    const onChange = jest.fn();
    render(<Harness initial={line({ sellingPrice: 90, priceOverrideReason: "Regular customer" })} onChange={onChange} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Use product price" }));
    expect(onChange).toHaveBeenLastCalledWith({ sellingPrice: 100, priceOverrideReason: "", belowCostConfirmed: false });
    expect(screen.queryByTestId("line-price-changed")).toBeNull();
  });

  it("a saved change remembers the price it was changed from", () => {
    expect(listPriceOf({ listPrice: 120 }, PRODUCT)).toBe(120);
    expect(listPriceOf({}, PRODUCT)).toBe(100);
    expect(listPriceOf({}, { sellingPrice: 0 })).toBeNull();
  });
});

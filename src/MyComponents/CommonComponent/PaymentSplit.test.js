import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import PaymentSplit from "./PaymentSplit";

/** PaymentSplit with its list kept in state, as the bill screens do. */
function Harness({ type, net, initial, onChange = () => {} }) {
  const [payments, setPayments] = useState(initial);
  return <PaymentSplit type={type} net={net} payments={payments} onChange={(p) => { setPayments(p); onChange(p); }} />;
}

const amount = (n) => screen.getByLabelText(`Payment ${n} amount`);

describe("PaymentSplit", () => {
  it("shows nothing for a credit bill", () => {
    const { container } = render(<PaymentSplit type="CREDIT" net={800} payments={[]} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Rs 500 cash + Rs 300 UPI: the UPI row fills itself in", () => {
    const onChange = jest.fn();
    render(<Harness type="PAID" net={800} initial={[{ mode: "CASH", amount: "800.00", reference: "" }]} onChange={onChange} />);
    expect(amount(1)).toHaveAttribute("readonly"); // one payment of the whole bill

    fireEvent.click(screen.getByRole("button", { name: "+ Split payment" }));
    expect(screen.getAllByTestId("payment-row")).toHaveLength(2);
    expect(screen.getByLabelText("Payment 2 mode")).toHaveValue("UPI"); // the next unused mode
    expect(amount(1)).not.toHaveAttribute("readonly");

    fireEvent.change(amount(1), { target: { value: "500" } });
    expect(amount(2)).toHaveValue(300);
    expect(amount(2)).toHaveAttribute("readonly");
    expect(screen.getByTestId("payment-sum")).toHaveTextContent("Paid ₹800.00");
    expect(onChange).toHaveBeenLastCalledWith([
      { mode: "CASH", amount: "500", reference: "" },
      { mode: "UPI", amount: "300.00", reference: "" },
    ]);
  });

  it("UPI and card take a reference; cash does not", () => {
    render(<Harness type="PAID" net={100} initial={[{ mode: "CASH", amount: "100.00", reference: "" }]} />);
    expect(screen.queryByLabelText("Payment 1 reference")).toBeNull();
    fireEvent.change(screen.getByLabelText("Payment 1 mode"), { target: { value: "CARD" } });
    fireEvent.change(screen.getByLabelText("Payment 1 reference"), { target: { value: "AUTH42" } });
    expect(screen.getByLabelText("Payment 1 reference")).toHaveValue("AUTH42");
  });

  it("removing a payment gives its amount back to the last row", () => {
    render(<Harness type="PAID" net={800} initial={[
      { mode: "CASH", amount: "500", reference: "" }, { mode: "UPI", amount: "300.00", reference: "" },
    ]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove payment 1" }));
    expect(screen.getAllByTestId("payment-row")).toHaveLength(1);
    expect(amount(1)).toHaveValue(800);
  });

  it("part payment: amounts are typed and the due is shown; no more than three modes", () => {
    render(<Harness type="PARTIAL" net={800} initial={[{ mode: "CASH", amount: "", reference: "" }]} />);
    fireEvent.change(amount(1), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Split payment" }));
    fireEvent.change(amount(2), { target: { value: "100" } });
    expect(screen.getByTestId("payment-sum")).toHaveTextContent("Paid ₹300.00 · Due ₹500.00");
    fireEvent.click(screen.getByRole("button", { name: "+ Split payment" }));
    expect(screen.getByLabelText("Payment 3 mode")).toHaveValue("CARD");
    expect(screen.queryByRole("button", { name: "+ Split payment" })).toBeNull();
  });

  it("shows the screen's error", () => {
    render(<PaymentSplit type="PAID" net={800} payments={[]} onChange={() => {}} error="Add a payment" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Add a payment");
  });
});

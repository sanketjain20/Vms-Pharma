import React, { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SerialEntry, SerialList, SerialPicker, SerialPickerModal } from "./SerialWidgets";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

function Picker({ onPicked, max }) {
  const [sel, setSel] = useState([]);
  return <SerialPicker options={[{ serialNo: "A1", hint: "B1" }, { serialNo: "A2" }]} selected={sel} max={max}
    onChange={(v) => { setSel(v); onPicked(v); }} />;
}

describe("SerialEntry (purchase)", () => {
  it("counts the serials typed against the units received and flags repeats", () => {
    const onChange = jest.fn();
    render(<SerialEntry value={[]} needed={3} onChange={onChange} />);
    const box = screen.getByLabelText("Serial numbers");
    fireEvent.change(box, { target: { value: "a1\na2" } });
    expect(onChange).toHaveBeenLastCalledWith(["A1", "A2"]);
    expect(screen.getByTestId("serial-count")).toHaveTextContent("2 of 3 serial numbers entered");
    fireEvent.change(box, { target: { value: "a1\na2\na1" } });
    expect(screen.getByTestId("serial-count")).toHaveTextContent("Entered more than once: A1");
    fireEvent.change(box, { target: { value: "a1\na2\na3" } });
    expect(screen.getByTestId("serial-count")).toHaveTextContent("3 of 3 serial numbers entered");
  });
});

describe("SerialPicker (sale / return)", () => {
  it("picks and drops by clicking, and picks by scanning", () => {
    const onPicked = jest.fn();
    render(<Picker onPicked={onPicked} />);
    fireEvent.click(screen.getByRole("button", { name: /^A1/ }));
    expect(onPicked).toHaveBeenLastCalledWith(["A1"]);
    fireEvent.change(screen.getByLabelText("Scan a serial number"), { target: { value: " a2 " } });
    fireEvent.submit(screen.getByLabelText("Scan a serial number").closest("form"));
    expect(onPicked).toHaveBeenLastCalledWith(["A1", "A2"]);
    expect(screen.getByTestId("serial-picked")).toHaveTextContent("2 picked");
    fireEvent.click(screen.getByRole("button", { name: /^A1/ }));
    expect(onPicked).toHaveBeenLastCalledWith(["A2"]);
  });

  it("refuses a scanned serial that isn't available, and more than allowed", () => {
    const onPicked = jest.fn();
    render(<Picker onPicked={onPicked} max={1} />);
    fireEvent.change(screen.getByLabelText("Scan a serial number"), { target: { value: "ZZ" } });
    fireEvent.submit(screen.getByLabelText("Scan a serial number").closest("form"));
    expect(screen.getByTestId("serial-picked")).toHaveTextContent("ZZ is not one of the units available here.");
    fireEvent.click(screen.getByRole("button", { name: /^A1/ }));
    fireEvent.click(screen.getByRole("button", { name: /^A2/ }));
    expect(screen.getByTestId("serial-picked")).toHaveTextContent("Only 1 can be picked here.");
    expect(onPicked).toHaveBeenCalledTimes(1);
  });
});

describe("SerialPickerModal (Quick Sale)", () => {
  it("loads the product's units in stock and hands back the ones picked", async () => {
    apiClient.mockImplementation((url) => (url.includes("/api/Serial/InStock/7")
      ? ok({ status: 200, data: [{ serialNo: "IMEI1", batchNumber: "BCH1" }, { serialNo: "IMEI2", batchNumber: "BCH1" }] })
      : ok({ status: 200, data: null })));
    const onDone = jest.fn();
    render(<SerialPickerModal product={{ id: 7, name: "Phone X" }} initial={[]} onDone={onDone} onClose={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^IMEI2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 to cart" }));
    expect(onDone).toHaveBeenCalledWith(["IMEI2"]);
  });

  it("says so when none is in stock", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, data: [] }));
    render(<SerialPickerModal product={{ id: 7, name: "Phone X" }} onDone={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByText("None of this product is in stock.")).toBeInTheDocument());
  });
});

describe("SerialList", () => {
  it("shows the serials and the warranty, or nothing", () => {
    const { container, rerender } = render(<SerialList serials={["A1", "A2"]} warranty="Warranty till 22-10-2027" />);
    expect(screen.getByTestId("serial-list")).toHaveTextContent("S/N: A1, A2 · Warranty till 22-10-2027");
    rerender(<SerialList serials={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

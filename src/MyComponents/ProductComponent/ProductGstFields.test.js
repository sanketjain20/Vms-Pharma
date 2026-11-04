import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ProductGstFields, { gstRateValue, gstRatePayload, gstRateError } from "./ProductGstFields";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));

describe("ProductGstFields — product-wise GST on the product form", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.mockResolvedValue({ json: () => Promise.resolve({ status: 200, data: [] }) });
  });

  it("converts between the form and the payload, and asks for a missing rate", () => {
    expect(gstRateValue(null)).toBe("");
    expect(gstRateValue("18.00")).toBe("18");
    expect(gstRatePayload("")).toBeNull();
    expect(gstRatePayload("0.25")).toBe(0.25);
    expect(gstRateError("")).toBe("Pick the GST rate");
    expect(gstRateError("0")).toBe(""); // 0% (exempt) is a rate
  });

  it("offers only the allowed rates and reports the pick and the inclusive switch", () => {
    const onChange = jest.fn();
    render(<ProductGstFields gstRate="" priceIncludesGst hsnCode="" onChange={onChange} />);
    const options = Array.from(screen.getByTestId("product-gst-rate").options).map((o) => o.value);
    expect(options).toEqual(["", "0", "0.25", "3", "5", "12", "18", "28", "40"]);
    fireEvent.change(screen.getByTestId("product-gst-rate"), { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith({ gstRate: "5" });
    fireEvent.click(screen.getByTestId("price-includes-gst"));
    expect(onChange).toHaveBeenCalledWith({ priceIncludesGst: false });
  });

  it("tells the owner when an older product has no rate yet", () => {
    render(<ProductGstFields gstRate="" hsnCode="" missingOnEdit onChange={jest.fn()} />);
    expect(screen.getByTestId("gst-missing-hint")).toHaveTextContent("no GST rate yet");
  });

  it("warns when other products with the same HSN use another rate", async () => {
    jest.useFakeTimers();
    apiClient.mockResolvedValue({ json: () => Promise.resolve({ status: 200, data: [{ name: "Kurta", gstRate: 12 }] }) });
    render(<ProductGstFields gstRate="5" hsnCode="6205" productId={3} onChange={jest.fn()} />);
    act(() => { jest.advanceTimersByTime(450); });
    jest.useRealTimers();
    await waitFor(() => expect(screen.getByTestId("gst-hsn-conflict")).toHaveTextContent("Kurta (12%)"));
    expect(apiClient).toHaveBeenCalledWith("http://api/api/Product/GstCheck?hsnCode=6205&gstRate=5&productId=3", { method: "GET" });
  });

  it("does not check without an HSN code", () => {
    jest.useFakeTimers();
    render(<ProductGstFields gstRate="5" hsnCode="" onChange={jest.fn()} />);
    act(() => { jest.advanceTimersByTime(450); });
    jest.useRealTimers();
    expect(apiClient).not.toHaveBeenCalled();
  });
});

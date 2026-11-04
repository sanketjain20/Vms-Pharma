import { render, screen, fireEvent, waitFor, renderHook } from "@testing-library/react";
import LineGstCell, { useCanOverrideGst } from "./LineGstCell";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));

const row = (o = {}) => ({ rate: 0.18, gstRate: 18, gstSource: "PRODUCT", inclusive: false, ...o });

describe("LineGstCell — the GST % of a bill line", () => {
  it("shows the product's rate, with no flag and no Change button for a user without the permission", () => {
    render(<LineGstCell line={{ productGstRate: 18 }} row={row()} canOverride={false} onChange={jest.fn()} />);
    expect(screen.getByTestId("line-rate")).toHaveTextContent("18%");
    expect(screen.queryByTestId("line-gst-flag")).toBeNull();
    expect(screen.queryByTestId("line-gst-change")).toBeNull();
  });

  it("flags a product with no rate yet (common rate used) and offers no override", () => {
    render(<LineGstCell line={{ productGstRate: null }} row={row({ gstSource: "COMMON" })} canOverride onChange={jest.fn()} />);
    expect(screen.getByTestId("line-gst-flag")).toHaveTextContent("No GST rate on product — common rate used");
    expect(screen.queryByTestId("line-gst-change")).toBeNull();
  });

  it("tags a price that includes GST", () => {
    render(<LineGstCell line={{ productGstRate: 18, priceIncludesGst: true }} row={row({ inclusive: true })} onChange={jest.fn()} />);
    expect(screen.getByTestId("line-incl-tag")).toHaveTextContent("incl.");
  });

  it("an allowed user changes the rate only with a reason", () => {
    const onChange = jest.fn();
    render(<LineGstCell line={{ productGstRate: 18 }} row={row()} canOverride onChange={onChange} />);
    fireEvent.click(screen.getByTestId("line-gst-change"));
    fireEvent.change(screen.getByLabelText("GST rate for this line"), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Apply"));
    expect(screen.getByText("Give a reason (it goes in the audit log)")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason for the GST change"), { target: { value: " Old stock at 5% " } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onChange).toHaveBeenCalledWith({ overrideRate: 5, overrideReason: "Old stock at 5%" });
  });

  it("picking the product's own rate again clears the override", () => {
    const onChange = jest.fn();
    render(<LineGstCell line={{ productGstRate: 18, overrideRate: 5, overrideReason: "x" }} row={row({ gstSource: "OVERRIDE", rate: 0.05 })}
      canOverride onChange={onChange} />);
    expect(screen.getByTestId("line-gst-override")).toHaveTextContent("Changed from 18% · x");
    fireEvent.click(screen.getByTestId("line-gst-change"));
    fireEvent.change(screen.getByLabelText("GST rate for this line"), { target: { value: "18" } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onChange).toHaveBeenCalledWith({ overrideRate: null, overrideReason: "" });
  });

  it("the permission is read from the role's actions on Sales", async () => {
    localStorage.setItem("roleId", "3");
    apiClient.mockResolvedValue({ json: () => Promise.resolve({ status: 200, data: ["View", "Override GST Rate"] }) });
    const { result } = renderHook(() => useCanOverrideGst());
    await waitFor(() => expect(result.current).toBe(true));
    expect(apiClient).toHaveBeenCalledWith("http://api/api/Access/GetUserModuleAccess/5/3", { method: "GET" });
  });
});

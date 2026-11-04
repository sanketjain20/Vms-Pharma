import { render, screen, fireEvent } from "@testing-library/react";
import FieldHelpLayer from "./FieldHelpLayer";
import RetailerAdd from "../RetailerComponent/RetailerAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const ok = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

/** The label element of a field, by the words it starts with. */
const labelOf = (words) => [...document.querySelectorAll("label")].find((l) => l.textContent.trim().startsWith(words));

beforeEach(() => { jest.clearAllMocks(); window.history.pushState({}, "", "/master/retailer"); });

describe("the ⓘ on real screens", () => {
  it("Add Retailer: credit limit, PAN, GST number and the tax ticks are explained; name and phone are not", async () => {
    apiClient.mockImplementation(() => ok({ status: 200 }));
    render(<><RetailerAdd onClose={jest.fn()} onSubmit={jest.fn()} /><FieldHelpLayer /></>);
    await screen.findByPlaceholderText(/Sharma Medical Store/i);

    for (const words of ["Credit Limit", "PAN", "GST Number", "Non-resident / export party", "Lower/Nil Deduction Certificate No."]) {
      expect(labelOf(words)?.querySelector(".fh-i")).toBeTruthy();
    }
    for (const words of ["Shop Name", "Phone", "Email", "Address"]) {
      expect(labelOf(words)?.querySelector(".fh-i")).toBeFalsy();
    }

    fireEvent.mouseOver(labelOf("Credit Limit").querySelector(".fh-i"));
    expect(screen.getByTestId("field-help")).toHaveTextContent("0 = no limit");
  });
});

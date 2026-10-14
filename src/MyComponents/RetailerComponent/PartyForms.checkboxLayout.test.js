import { render, screen } from "@testing-library/react";
import RetailerAdd from "./RetailerAdd";
import RetailerEdit from "./RetailerEdit";
import SupplierAdd from "../SupplierComponent/SupplierAdd";
import SupplierEdit from "../SupplierComponent/SupplierEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

/**
 * The long checkbox labels ("Buyer deducts TDS under Section 194Q ...", "Non-resident / export party ...") used to sit
 * in a half-width grid cell, wrapping into a tall column and throwing the neighbouring Drug License Number field out of
 * line. A checkbox now owns the whole row.
 */
const cases = [
  ["Retailer Add", () => <RetailerAdd onClose={jest.fn()} onSubmit={jest.fn()} />, [/Non-resident \/ export party/i, /Buyer deducts TDS under Section 194Q/i]],
  ["Retailer Edit", () => <RetailerEdit uKey="r1" onClose={jest.fn()} onSubmit={jest.fn()} />, [/Non-resident \/ export party/i, /Buyer deducts TDS under Section 194Q/i]],
  ["Supplier Add", () => <SupplierAdd onClose={jest.fn()} onSubmit={jest.fn()} />, [/Non-resident \/ export party/i]],
  ["Supplier Edit", () => <SupplierEdit uKey="s1" onClose={jest.fn()} onSubmit={jest.fn()} />, [/Non-resident \/ export party/i]],
];

describe.each(cases)("%s checkbox layout", (_name, renderForm, checkboxLabels) => {
  beforeEach(() => {
    apiClient.mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 200, data: {} }) })
    );
  });

  it.each(checkboxLabels.map((l) => [String(l), l]))("%s spans the full row", async (_label, label) => {
    render(renderForm());

    const checkbox = await screen.findByLabelText(label);

    expect(checkbox.closest(".afx-field")).toHaveClass("afx-field--full");
  });

  it("leaves ordinary fields such as Drug License Number in their half-width cell", async () => {
    render(renderForm());

    const field = (await screen.findByText(/^Drug License Number/i)).closest(".afx-field");

    expect(field).not.toHaveClass("afx-field--full");
  });
});

/**
 * jsdom does not run the real cascade, so the guard against the app's global `input { width: 100% !important }` and
 * `label { text-transform: uppercase !important }` rules is pinned on the stylesheet itself (verified by rendering the
 * real form in Chrome with those stylesheets loaded).
 */
describe("checkbox styles survive the app's global input / label rules", () => {
  const css = require("fs").readFileSync(require("path").join(__dirname, "../../Styles/CommonAEUDForm/FormShell.css"), "utf8");

  it("resets the checkbox to the browser's own and fixes its size with !important", () => {
    const rule = css.match(/\.afx-checkbox-label input\[type="checkbox"\]\s*\{([^}]*)\}/)[1];
    expect(rule).toMatch(/all:\s*revert\s*!important/);
    expect(rule).toMatch(/width:\s*15px\s*!important/);
    expect(rule).toMatch(/height:\s*15px\s*!important/);
  });

  it("keeps the label readable instead of tiny capitals", () => {
    const rule = css.match(/\.afx-checkbox-label\s*\{[^}]*text-transform[^}]*\}/)[0];
    expect(rule).toMatch(/text-transform:\s*none\s*!important/);
    expect(rule).toMatch(/font-size:\s*12\.5px\s*!important/);
  });
});

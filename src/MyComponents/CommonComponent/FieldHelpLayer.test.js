import React, { useState } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import FieldHelpLayer, { attachHelp } from "./FieldHelpLayer";

/** A small Add screen: two fields that need explaining, one that doesn't, and a list grid that must get nothing. */
function Screen() {
  const [more, setMore] = useState(false);
  const [mode, setMode] = useState("limit");
  return (
    <div>
      <div className="afx-field">
        <label className="afx-label" htmlFor="cl">Credit Limit (₹)<span className="afx-req">*</span></label>
        <input id="cl" />
      </div>
      <div className="afx-field">
        <label className="afx-label" htmlFor="sn">Shop Name</label>
        <input id="sn" />
      </div>
      <label className="afx-checkbox-label"><input type="checkbox" /> Non-Resident / Export Party</label>
      <div className="afx-meta-card"><span className="afx-meta-card-label">Billing Mode</span><span>CASH</span></div>
      <div className="dg-panel"><label className="afx-label">HSN Code</label></div>
      {more && <label className="afx-label">HSN Code</label>}
      <label className="afx-label" data-testid="changing">{mode === "limit" ? "Reorder Level" : "Product Name"}</label>
      <button type="button" onClick={() => setMore(true)}>more</button>
      <button type="button" onClick={() => setMode("name")}>rename</button>
    </div>
  );
}

/** The ⓘ of the label that reads this (not the hidden screen-reader text, which may mention it). */
const iconOf = (text) => screen.getAllByText(text, { exact: false, selector: "label, span" })
  .find((el) => !el.closest("#fh-descriptions")).querySelector(".fh-i");

beforeEach(() => window.history.pushState({}, "", "/master/retailer"));

describe("FieldHelpLayer — the ⓘ on Add / Edit / View screens", () => {
  it("puts an ⓘ on the fields that need explaining, nowhere else", () => {
    render(<><Screen /><FieldHelpLayer /></>);
    expect(iconOf("Credit Limit")).not.toBeNull();
    expect(iconOf("Non-Resident / Export Party")).not.toBeNull();
    expect(iconOf("Billing Mode")).not.toBeNull(); // a view card
    expect(iconOf("Shop Name")).toBeNull();
    expect(document.querySelector(".dg-panel .fh-i")).toBeNull(); // never on a list's grid
    // for the mouse and touch only: screen readers hear the help with the field instead
    expect(iconOf("Credit Limit")).toHaveAttribute("aria-hidden", "true");
    expect(iconOf("Credit Limit")).toHaveAttribute("tabindex", "-1");
  });

  it("the field's own label is unchanged for its input (the ⓘ adds no text)", () => {
    render(<><Screen /><FieldHelpLayer /></>);
    expect(screen.getByLabelText("Credit Limit (₹)*", { selector: "input" })).toHaveAttribute("id", "cl");
  });

  it("hovering shows what the field is about; leaving hides it", () => {
    render(<><Screen /><FieldHelpLayer /></>);
    fireEvent.mouseOver(iconOf("Credit Limit"));
    expect(screen.getByTestId("field-help")).toHaveTextContent("The most this retailer may owe you");
    fireEvent.mouseOut(iconOf("Credit Limit"));
    expect(screen.queryByTestId("field-help")).toBeNull();
  });

  it("a tap keeps it open (and does not jump into the field); tapping again, elsewhere or Esc closes it", () => {
    render(<><Screen /><FieldHelpLayer /></>);
    fireEvent.click(iconOf("Credit Limit"));
    fireEvent.mouseOut(iconOf("Credit Limit"));
    expect(screen.getByTestId("field-help")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.getElementById("cl"));
    fireEvent.click(iconOf("Credit Limit"));
    expect(screen.queryByTestId("field-help")).toBeNull();

    fireEvent.click(iconOf("Credit Limit"));
    fireEvent.click(document.body);
    expect(screen.queryByTestId("field-help")).toBeNull();

    fireEvent.click(iconOf("Credit Limit"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("field-help")).toBeNull();
  });

  it("a screen reader hears the help with the field itself", () => {
    render(<><Screen /><FieldHelpLayer /></>);
    expect(document.getElementById("cl")).toHaveAccessibleDescription(/The most this retailer may owe you/);
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(/outside India/);
    expect(document.getElementById("sn")).not.toHaveAttribute("aria-describedby");
  });

  it("fields that appear later get it, and a label whose words change loses it", async () => {
    render(<><Screen /><FieldHelpLayer /></>);
    expect(iconOf("Reorder Level")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "more" }));
    await waitFor(() => expect(document.querySelectorAll(".fh-i").length).toBe(5)); // the new HSN Code label
    fireEvent.click(screen.getByRole("button", { name: "rename" }));
    await waitFor(() => expect(screen.getByTestId("changing").querySelector(".fh-i")).toBeNull());
  });

  it("a screen's own meaning wins", () => {
    window.history.pushState({}, "", "/master/scheme");
    document.body.innerHTML = '<label class="afx-label">Free quantity</label>';
    act(() => attachHelp());
    expect(document.querySelector(".fh-i").dataset.help).toMatch(/customer gets free/);
    window.history.pushState({}, "", "/master/purchase");
    act(() => attachHelp());
    expect(document.querySelector(".fh-i").dataset.help).toMatch(/supplier gives free/);
    expect(document.querySelectorAll(".fh-i")).toHaveLength(1); // updated, not added twice
  });
});

describe("the explanation shows in front of every screen", () => {
  it("is stacked above every pop-up and panel (only the busy overlay and the toasts are higher)", () => {
    const fs = require("fs");
    const path = require("path");
    const styles = path.join(__dirname, "..", "..", "Styles");
    const files = [];
    const walk = (dir) => fs.readdirSync(dir).forEach((f) => {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith(".css")) files.push(p);
    });
    walk(styles);
    const tip = Number(/\.fh-tip\s*\{[^}]*z-index:\s*(\d+)/.exec(fs.readFileSync(path.join(styles, "CommonComponent", "FieldHelp.css"), "utf8"))[1]);
    const always = ["GlobalBusyOverlay.css", "Toast.css"]; // system layers that must win over everything
    const layers = files.filter((p) => !always.includes(path.basename(p)) && !p.endsWith("FieldHelp.css"))
      .flatMap((p) => [...fs.readFileSync(p, "utf8").matchAll(/z-index:\s*(\d+)/g)].map((m) => ({ file: path.basename(p), z: Number(m[1]) })));
    const highest = layers.reduce((a, b) => (b.z > a.z ? b : a), { z: 0 });
    expect(highest.z).toBeGreaterThanOrEqual(110000); // the Add / Edit / View pop-ups are found
    expect(tip).toBeGreaterThan(highest.z);
  });
});

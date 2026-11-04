import React, { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StyleMatrixEditor, styleMatrixPayload, VariantQtyGrid, VariantPicker, VariantChips } from "./VariantWidgets";

const v = (id, size, color, extra = {}) => ({
  id, name: `Kurta - ${[size, color].filter(Boolean).join(" / ")}`, styleId: 7, styleName: "Kurta",
  variantSize: size, variantColor: color, price: 599, stock: 5, ...extra,
});

function Editor({ onValue }) {
  const [value, setValue] = useState({ sizes: [], colors: [], prices: {}, skipped: {} });
  return <StyleMatrixEditor value={value} basePrice="599" onChange={(x) => { setValue(x); onValue(x); }} />;
}

describe("StyleMatrixEditor (product form)", () => {
  it("builds sizes from a preset and typed colours, shows the grid and counts the variants", () => {
    let last;
    render(<Editor onValue={(x) => { last = x; }} />);
    expect(screen.getByText(/Add sizes and\/or colours/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ S – XXL" }));
    fireEvent.change(screen.getByLabelText("Add colours"), { target: { value: "Blue, Black" } });
    fireEvent.keyDown(screen.getByLabelText("Add colours"), { key: "Enter" });

    expect(last.sizes).toEqual(["S", "M", "L", "XL", "XXL"]);
    expect(last.colors).toEqual(["Blue", "Black"]);
    expect(screen.getByTestId("style-summary")).toHaveTextContent("10 variants will be created");

    fireEvent.click(screen.getByLabelText("Make XXL / Black"));
    fireEvent.change(screen.getByLabelText("Price of M / Blue"), { target: { value: "649" } });
    expect(screen.getByTestId("style-summary")).toHaveTextContent("9 variants");
    expect(screen.getByTestId("style-summary")).toHaveTextContent("1 with their own price");
    expect(screen.getByLabelText("Price of XXL / Black")).toBeDisabled();

    expect(styleMatrixPayload(last)).toEqual({
      sizes: ["S", "M", "L", "XL", "XXL"],
      colors: ["Blue", "Black"],
      overrides: [{ size: "M", color: "Blue", price: 649 }],
      exclude: [{ size: "XXL", color: "Black" }],
    });
  });

  it("removes a size by its chip", () => {
    let last;
    render(<Editor onValue={(x) => { last = x; }} />);
    fireEvent.change(screen.getByLabelText("Add sizes"), { target: { value: "S,M" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add" })[0]);
    fireEvent.click(screen.getByTitle("Remove S"));
    expect(last.sizes).toEqual(["M"]);
  });

  it("leaves out a price for a pair that is not made", () => {
    expect(styleMatrixPayload({ sizes: ["S"], colors: [], prices: { "s|": "700" }, skipped: { "s|": true } }))
      .toEqual({ sizes: ["S"], colors: [], overrides: [], exclude: [{ size: "S", color: null }] });
  });
});

describe("VariantQtyGrid (purchase entry)", () => {
  const styles = [{ styleId: 7, name: "Kurta", variants: [v(1, "S", "Blue"), v(2, "M", "Blue", { price: 649 }), v(3, "S", "Black")] }];

  it("adds one line per size/colour with a quantity, after a cost is given", () => {
    const onAdd = jest.fn();
    render(<VariantQtyGrid styles={styles} gstRates={[0, 5, 12]} onAdd={onAdd} onClose={jest.fn()} />);
    const grid = screen.getByTestId("variant-qty-matrix");
    expect(within(grid).getByTitle("This size/colour is not made")).toBeInTheDocument(); // M / Black

    fireEvent.change(screen.getByLabelText("Quantity of S / Blue"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Quantity of M / Blue"), { target: { value: "2" } });
    const add = screen.getByRole("button", { name: "Add 2 lines · 6 pcs" });
    fireEvent.click(add);
    expect(screen.getByText("Enter the cost")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Cost per piece/), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("GST %"), { target: { value: "5" } });
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith([
      expect.objectContaining({ productId: 1, productName: "Kurta - S / Blue", quantity: 4, costPrice: "300", mrp: 599, gstRate: "5" }),
      expect.objectContaining({ productId: 2, quantity: 2, mrp: 649 }),
    ]);
  });

  it("says how to make a style when there is none", () => {
    render(<VariantQtyGrid styles={[]} gstRates={[0]} onAdd={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(/No styles yet/)).toBeInTheDocument();
  });
});

describe("VariantPicker (Quick Sale)", () => {
  const style = { styleId: 7, name: "Kurta", variants: [v(1, "S", "Blue"), v(2, "M", "Blue"), v(3, "S", "Black")] };
  const stock = { 1: 3, 2: 0, 3: 1 };

  it("shows price and stock per variant and adds or removes through the cart", () => {
    const onAdjust = jest.fn();
    render(<VariantPicker style={style} qtyFor={(id) => (id === 3 ? 1 : 0)} stockFor={(id) => stock[id]} priceFor={() => 899}
      onAdjust={onAdjust} onClose={jest.fn()} />);
    expect(screen.getByText("1 in cart")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByLabelText("Add M / Blue")).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Add S / Blue"));
    expect(onAdjust).toHaveBeenCalledWith(style.variants[0], 1);
    fireEvent.click(screen.getByLabelText("One less S / Black"));
    expect(onAdjust).toHaveBeenCalledWith(style.variants[2], -1);
    expect(screen.getByLabelText("One more S / Black")).toBeDisabled(); // 1 in cart, 1 in stock
  });
});

describe("VariantChips (Sales Add)", () => {
  const variants = [v(1, "S", "Blue"), v(2, "M", "Blue"), v(3, "S", "Black", { stock: 2 })];

  it("switches to the matching variant and disables colours the size is not made in", () => {
    const onSelect = jest.fn();
    const { rerender } = render(<VariantChips variants={variants} selectedId={1} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /^Black/ }));
    expect(onSelect).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(onSelect).toHaveBeenLastCalledWith(2);

    rerender(<VariantChips variants={variants} selectedId="2" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /^Black/ })).toBeDisabled();
  });

  it("shows nothing when the picked product is not one of the variants", () => {
    const { container } = render(<VariantChips variants={variants} selectedId={99} onSelect={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

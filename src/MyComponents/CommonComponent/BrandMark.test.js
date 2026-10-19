import { render, screen } from "@testing-library/react";
import BrandMark from "./BrandMark";

/* CRA's Jest maps an imported image to its file name, so the src tells us which mark was picked. */
describe("BrandMark — the Udyora logo for each theme", () => {
  it("uses the white-on-black mark in dark mode", () => {
    render(<BrandMark theme="dark" className="brand-logo" />);
    const img = screen.getByRole("img", { name: "Udyora" });
    expect(img.getAttribute("src")).toMatch(/udyora-mark-dark\.png$/);
    expect(img).toHaveClass("brand-logo");
    expect(img).toHaveAttribute("data-theme-variant", "dark");
  });

  it("uses the black-on-white mark in light mode", () => {
    render(<BrandMark theme="light" />);
    expect(screen.getByRole("img", { name: "Udyora" }).getAttribute("src")).toMatch(/udyora-mark-light\.png$/);
  });

  it("falls back to the dark mark when no theme is known yet", () => {
    render(<BrandMark />);
    expect(screen.getByRole("img", { name: "Udyora" }).getAttribute("src")).toMatch(/udyora-mark-dark\.png$/);
  });

  it("switches mark when the theme changes", () => {
    const { rerender } = render(<BrandMark theme="dark" />);
    rerender(<BrandMark theme="light" />);
    expect(screen.getByRole("img", { name: "Udyora" })).toHaveAttribute("data-theme-variant", "light");
  });
});

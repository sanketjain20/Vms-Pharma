import { render, screen, fireEvent } from "@testing-library/react";
import FieldPager, { pageWindow } from "./FieldPager";

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("shows the first pages then a gap near the start: 1 2 3 4 5 … last", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, "gap-20", 20]);
    expect(pageWindow(3, 20)).toEqual([1, 2, 3, 4, 5, "gap-20", 20]);
  });

  it("windows around the current page in the middle", () => {
    expect(pageWindow(10, 20)).toEqual([1, "gap-9", 9, 10, 11, "gap-20", 20]);
  });

  it("shows the last pages near the end", () => {
    expect(pageWindow(20, 20)).toEqual([1, "gap-16", 16, 17, 18, 19, 20]);
  });
});

describe("FieldPager", () => {
  it("renders nothing when everything fits on one page", () => {
    const { container } = render(<FieldPager page={1} totalPages={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    const empty = render(<FieldPager page={1} totalPages={0} onChange={() => {}} />);
    expect(empty.container).toBeEmptyDOMElement();
  });

  it("marks the current page, disables Prev on the first page, and goes to the next page", () => {
    const onChange = jest.fn();
    render(<FieldPager page={1} totalPages={5} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: "Page 4" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("disables Next on the last page and goes back", () => {
    const onChange = jest.fn();
    render(<FieldPager page={5} totalPages={5} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("uses the rep app's classes for the ra variant", () => {
    render(<FieldPager page={1} totalPages={3} onChange={() => {}} variant="ra" />);
    expect(screen.getByRole("navigation")).toHaveClass("ra-pager");
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveClass("ra-pager-btn", "is-active");
  });
});

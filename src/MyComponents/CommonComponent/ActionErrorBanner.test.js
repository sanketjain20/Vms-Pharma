import { render, screen, fireEvent } from "@testing-library/react";
import ActionErrorBanner from "./ActionErrorBanner";

describe("ActionErrorBanner — a refused grid action", () => {
  it("shows the server's message with an icon and a close button", () => {
    const onDismiss = jest.fn();
    render(<ActionErrorBanner message={'Insufficient stock for ABC in "Main WareHouse": 0 available, 1000 needed.'} onDismiss={onDismiss} />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveClass("aeb");
    expect(banner.querySelector(".aeb-text")).toHaveTextContent("Insufficient stock for ABC");
    expect(banner.querySelector(".aeb-icon svg")).toBeInTheDocument();
    const close = screen.getByRole("button", { name: "Dismiss" });
    expect(close).toHaveClass("aeb-close");
    expect(close).not.toHaveTextContent("Dismiss"); // an icon button, not the old bare text button
    fireEvent.click(close);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders nothing without a message", () => {
    const { container } = render(<ActionErrorBanner message="" onDismiss={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

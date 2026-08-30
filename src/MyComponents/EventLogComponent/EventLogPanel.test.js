import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import EventLogPanel from "./EventLogPanel";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body) {
  return Promise.resolve({ json: () => Promise.resolve(body) });
}

function renderPanel(data) {
  apiClient.mockReturnValue(jsonResponse({ status: 200, data }));
  return render(
    <MemoryRouter>
      <EventLogPanel moduleName="Manufacturer" uKey="mfg-1" onClose={() => {}} closing={false} />
    </MemoryRouter>
  );
}

describe("EventLogPanel", () => {
  it("is a bottom sheet, not a right-side drawer", async () => {
    const { container } = renderPanel({ moduleName: "MANUFACTURER", events: [] });
    await screen.findByText(/No changes recorded yet/i);

    const panel = container.querySelector(".evl-panel");
    expect(panel).toBeInTheDocument();
    // The drag-handle affordance only makes sense on a bottom sheet.
    expect(container.querySelector(".evl-sheet-handle")).toBeInTheDocument();
  });

  it("shows a real per-browser icon and a browser-only label (no OS/device text)", async () => {
    const { container } = renderPanel({
      moduleName: "MANUFACTURER",
      createdAt: "2026-01-01T10:00:00",
      createdByName: "Admin",
      events: [
        {
          uKey: "evt-1",
          actionType: "UPDATE",
          actionLabel: "Updated",
          performedAt: "2026-01-02T10:00:00",
          performedByName: "Admin",
          browserLabel: "Chrome 128",
          userAgent: "Mozilla/5.0 Chrome/128.0.0.0",
          changes: [],
        },
      ],
    });

    expect(await screen.findByText("Chrome 128")).toBeInTheDocument();
    expect(screen.queryByText(/on Windows|on macOS|on Android|on iOS|on Linux/i)).not.toBeInTheDocument();

    // A real Chrome mark (not a generic letter badge): the tri-color pie
    // slices + blue center that make up the actual Chrome logo shape.
    const icon = container.querySelector(".evl-browser-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.querySelectorAll('path[fill="#EA4335"], path[fill="#34A853"], path[fill="#FBBC05"]')).toHaveLength(3);
    expect(icon.querySelector('circle[fill="#4285F4"]')).toBeInTheDocument();
  });

  it("starts every event collapsed, showing who/when/browser but not the grid", async () => {
    renderPanel({
      moduleName: "MANUFACTURER",
      events: [
        {
          uKey: "evt-1",
          actionType: "UPDATE",
          actionLabel: "Updated",
          performedAt: "2026-01-02T10:00:00",
          performedByName: "Jane Doe",
          browserLabel: "Firefox 129",
          changes: [
            { fieldName: "phone", fieldLabel: "Phone", oldValue: "9000000000", newValue: "9111111111" },
          ],
        },
      ],
    });

    // Who / when / browser are visible immediately — that's the point of
    // the collapsed summary — but the change grid is not mounted yet.
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Firefox 129")).toBeInTheDocument();
    expect(screen.queryByText("Field")).not.toBeInTheDocument();
    expect(screen.queryByText("9000000000")).not.toBeInTheDocument();
  });

  it("opens the grid for the clicked event only, on click", async () => {
    const user = userEvent.setup();
    renderPanel({
      moduleName: "MANUFACTURER",
      events: [
        {
          uKey: "evt-1",
          actionType: "UPDATE",
          actionLabel: "Updated",
          performedAt: "2026-01-02T10:00:00",
          performedByName: "Admin",
          browserLabel: "Firefox 129",
          changes: [
            { fieldName: "phone", fieldLabel: "Phone", oldValue: "9000000000", newValue: "9111111111" },
          ],
        },
        {
          uKey: "evt-2",
          actionType: "UPDATE",
          actionLabel: "Updated",
          performedAt: "2026-01-01T10:00:00",
          performedByName: "Admin",
          changes: [{ fieldName: "email", fieldLabel: "Email", oldValue: "a@x.com", newValue: "b@x.com" }],
        },
      ],
    });

    await screen.findByText("Firefox 129");
    await user.click(screen.getAllByRole("button", { name: /Updated/i })[0]);

    expect(screen.getByText("Field")).toBeInTheDocument();
    expect(screen.getByText("9000000000")).toBeInTheDocument();
    expect(screen.getByText("9111111111")).toBeInTheDocument();
    // The second event was never clicked, so its grid stays closed.
    expect(screen.queryByText("a@x.com")).not.toBeInTheDocument();
  });

  it("shows a dash, not a crossed-out value, for a field with no old value", async () => {
    const user = userEvent.setup();
    renderPanel({
      moduleName: "MANUFACTURER",
      events: [
        {
          uKey: "evt-1",
          actionType: "UPDATE",
          actionLabel: "Updated",
          performedAt: "2026-01-02T10:00:00",
          performedByName: "Admin",
          changes: [{ fieldName: "gstNumber", fieldLabel: "GST Number", oldValue: null, newValue: "GSTIN123" }],
        },
      ],
    });

    await user.click(await screen.findByRole("button", { name: /Updated/i }));

    const newValueCell = await screen.findByText("GSTIN123");
    expect(newValueCell.className).toBe("evl-grid-new");
    const oldValueCell = screen.getByText("—");
    expect(oldValueCell.className).toBe("evl-grid-empty");
  });

  it("shows the empty state when a record has no recorded changes yet", async () => {
    renderPanel({ moduleName: "MANUFACTURER", events: [] });

    expect(await screen.findByText(/No changes recorded yet/i)).toBeInTheDocument();
  });
});

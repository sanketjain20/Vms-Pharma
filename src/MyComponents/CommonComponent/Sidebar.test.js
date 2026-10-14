import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const ALL = [
  "DASHBOARD", "INTELLIGENCE", "REPORTS", "PRODUCT", "PRODUCT_TYPE", "RETAILER", "SUPPLIER", "MANUFACTURER", "GODOWN",
  "INVENTORY", "BATCH", "STOCK_ADJUSTMENT", "ALERTS", "SALES", "SALES_RETURN", "PURCHASE", "PURCHASE_RETURN",
  "PAYMENT_COLLECTION", "SUPPLIER_PAYMENT", "RETAILER_OUTSTANDING", "SUPPLIER_OUTSTANDING", "EINVOICE", "EWAYBILL", "GSTR2RECON",
  "FIELD_REP", "FIELD_ORDER", "FIELD_COLLECTION", "VENDOR", "ROLES", "SCHEDULER", "BULK_UPLOAD_MANAGEMENT",
];

function mockModules(modules) {
  apiClient.mockResolvedValue({
    ok: true,
    json: async () => ({ status: 200, data: modules }),
  });
}

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );
}

const loaded = () => waitFor(() => expect(localStorage.getItem("modules")).not.toBeNull());
const mainLabels = (container) => [...container.querySelectorAll(".sb-nav > .sb-item")].map((e) => e.getAttribute("data-tooltip"));
const mainItem = (container, label) => [...container.querySelectorAll(".sb-nav > .sb-item")].find((e) => e.getAttribute("data-tooltip") === label);
const hover = (container, label) => fireEvent.mouseEnter(mainItem(container, label));
// level 2 / level 3 rows of the open cascade
const levelTwo = () => within(screen.getAllByRole("menu")[0]);
const row = (name) => levelTwo().getByRole("menuitem", { name });
const openGroup = (name) => fireEvent.mouseEnter(row(name));

beforeEach(() => mockNavigate.mockClear());
afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe("Sidebar — six main menus", () => {
  it("shows Home on its own plus exactly six main menus for a user who has every module", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
    expect(mainLabels(container)).toEqual(["Home", "Dashboard & Reports", "Masters", "Inventory", "Billing & GST", "Field Sales", "Administration"]);
    expect(mainLabels(container).filter((l) => l !== "Home")).toHaveLength(6);
  });

  it("stays at Home + six even with unknown modules (they go under Administration)", async () => {
    mockModules([...ALL, "BRAND_NEW", "ANOTHER_NEW"]);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
  });

  it("shows only Home before the modules have loaded", () => {
    apiClient.mockReturnValue(new Promise(() => {}));
    const { container } = renderSidebar();
    expect(mainLabels(container)).toEqual(["Home"]);
  });

  it("only shows the menus a user has permission for", async () => {
    mockModules(["SALES", "RETAILER"]);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toEqual(["Home", "Masters", "Billing & GST"]));
  });
});

describe("Sidebar — sub menu and sub-sub menu", () => {
  it("opens a main menu on hover, showing its sub menus with their pages underneath", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument(); // closed until hovered
    hover(container, "Billing & GST");
    await screen.findByRole("menu");

    // level 2 lists only the sub menus — their pages are not shown until a sub menu is opened
    expect(levelTwo().getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Sales", "Purchase", "Payments", "Outstanding", "GST Compliance"]);
    expect(screen.queryByText("E-Invoices")).not.toBeInTheDocument();

    openGroup("GST Compliance");
    const gst = within(await screen.findByRole("menu", { name: "GST Compliance" }));
    expect(gst.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["E-Invoices", "E-Way Bills", "GSTR-2 Reconciliation"]);
  });

  it("opens only one main menu at a time", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
    hover(container, "Masters");
    await screen.findByRole("menu");
    fireEvent.mouseLeave(mainItem(container, "Masters"));
    hover(container, "Inventory");
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(row("Stock")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Parties" })).not.toBeInTheDocument();
  });

  it("keeps pages in the menu's own order, not alphabetical", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
    hover(container, "Dashboard & Reports");
    const items = (await screen.findAllByRole("menuitem")).map((e) => e.textContent);
    expect(items).toEqual(["Dashboard", "VMS Intelligence", "Reports"]); // Home is not in here any more
  });

  it("clicking a page goes to its route and closes the menu", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
    hover(container, "Billing & GST");
    await screen.findByRole("menu");
    openGroup("Sales");
    fireEvent.click(await within(await screen.findByRole("menu", { name: "Sales" })).findByRole("menuitem", { name: "Sales Return" }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/master/sales-return");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("goes to the right page for the ones the old sidebar got wrong or oddly named", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
    hover(container, "Administration");
    await screen.findByRole("menu");
    openGroup("Tools");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Job Scheduler" }));
    expect(mockNavigate).toHaveBeenLastCalledWith("/master/job-scheduler");
    hover(container, "Administration");
    await screen.findByRole("menu");
    openGroup("Tools");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Bulk Data Upload" }));
    expect(mockNavigate).toHaveBeenLastCalledWith("/master/bulk-upload");
  });

  it("can be used from the keyboard", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
    hover(container, "Masters");
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Godown" }), { key: "Enter" });
    expect(mockNavigate).toHaveBeenCalledWith("/master/godown");
  });

  it("a tap opens the menu on a screen with no hover, and a second tap closes it", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
    fireEvent.click(mainItem(container, "Masters"));
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    fireEvent.click(mainItem(container, "Masters"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("choosing a page does not re-open the menu it was in", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
    fireEvent.click(mainItem(container, "Masters"));
    await screen.findByRole("menu");
    fireEvent.click(row("Parties"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Retailer" }));
    expect(mockNavigate).toHaveBeenCalledWith("/master/retailer");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("a main menu with one page is a direct link with no flyout", async () => {
    mockModules(["SALES", "FIELD_COLLECTION"]);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toContain("Field Sales"));
    hover(container, "Field Sales");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(mainItem(container, "Field Sales"));
    expect(mockNavigate).toHaveBeenCalledWith("/master/field-collection");
  });

  it("Home goes straight to /home", async () => {
    mockModules(["SALES"]);
    const { container } = renderSidebar();
    await loaded();
    hover(container, "Home");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument(); // Home is a single link, no flyout
    fireEvent.click(mainItem(container, "Home"));
    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });
});

describe("Sidebar — permission-only modules and unknown modules", () => {
  it("does not render anything for the TCS module", async () => {
    mockModules(["SALES", "TCS"]);
    const { container } = renderSidebar();
    await loaded();
    expect(screen.queryByText("Tcs")).not.toBeInTheDocument();
    expect(screen.queryByText("TCS")).not.toBeInTheDocument();
    expect(mainLabels(container)).not.toContain("Tcs");
  });

  it("does not render anything for the MFA module", async () => {
    mockModules(["SALES", "MFA"]);
    const { container } = renderSidebar();
    await loaded();
    expect(screen.queryByText("Mfa")).not.toBeInTheDocument();
    expect(screen.queryByText("MFA")).not.toBeInTheDocument();
    expect(mainLabels(container)).not.toContain("Mfa");
  });

  it("still reaches a genuinely unknown module — under Administration, not as a seventh menu", async () => {
    mockModules(["SALES", "SOME_NEW_MODULE"]);
    const { container } = renderSidebar();
    await waitFor(() => expect(mainLabels(container)).toContain("Administration"));
    expect(mainLabels(container)).not.toContain("Some New Module");
    fireEvent.click(mainItem(container, "Administration"));
    expect(mockNavigate).toHaveBeenCalledWith("/master/some-new-module");
  });

  it("groups the field-sales modules under one 'Field Sales' menu instead of generic top-level items", async () => {
    mockModules(["SALES", "FIELD_REP", "FIELD_ORDER"]);
    const { container } = renderSidebar();
    await waitFor(() => expect(mainLabels(container)).toContain("Field Sales"));
    expect(screen.queryByText("Field Rep")).not.toBeInTheDocument();
    expect(screen.queryByText("Field Order")).not.toBeInTheDocument();
    hover(container, "Field Sales");
    expect((await screen.findAllByRole("menuitem")).map((e) => e.textContent)).toEqual(["Field Reps", "Field Orders"]);
  });

  it("shows Field Sales for a user who only has the collections module, with no stray top-level item", async () => {
    mockModules(["SALES", "FIELD_COLLECTION"]);
    const { container } = renderSidebar();
    await waitFor(() => expect(mainLabels(container)).toContain("Field Sales"));
    expect(screen.queryByText("Field Collection")).not.toBeInTheDocument();
  });

  it("hides the Field Sales menu when the user has no field-sales module", async () => {
    mockModules(["SALES"]);
    const { container } = renderSidebar();
    await loaded();
    expect(mainLabels(container)).not.toContain("Field Sales");
  });
});

describe("Sidebar — search", () => {
  const search = (text) => fireEvent.change(screen.getByLabelText("Search modules"), { target: { value: text } });

  it("finds a page and shows where it lives", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));
    search("outstanding");
    const hit = await screen.findByRole("button", { name: /Retailer Outstanding/ });
    expect(hit).toHaveTextContent("Billing & GST › Outstanding");
  });

  it("finds pages through their menu name (gst)", async () => {
    mockModules(ALL);
    renderSidebar();
    await loaded();
    search("gst");
    expect(await screen.findByRole("button", { name: /E-Way Bills/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GSTR-2 Reconciliation/ })).toBeInTheDocument();
  });

  it("clicking a result navigates and clears the search", async () => {
    mockModules(ALL);
    renderSidebar();
    await loaded();
    search("godown");
    fireEvent.click(await screen.findByRole("button", { name: /Godown/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/master/godown");
    expect(screen.getByLabelText("Search modules")).toHaveValue("");
  });

  it("says when nothing matches, and only searches what the user may open", async () => {
    mockModules(["SALES"]);
    renderSidebar();
    await loaded();
    search("retailer");
    expect(await screen.findByText("No matching module")).toBeInTheDocument();
  });

  it("hides the main menus while searching", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    search("sales");
    expect(container.querySelector(".sb-nav")).toHaveClass("searching");
  });
});

describe("Sidebar — cascading Masters menu", () => {
  const openMasters = async () => {
    mockModules(ALL);
    const view = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(view.container)).toHaveLength(7));
    hover(view.container, "Masters");
    await screen.findByRole("menu");
    return view;
  };
  const names = (menu) => within(menu).getAllByRole("menuitem").map((e) => e.textContent);

  it("opens a second-level panel holding only Parties, Products and Godown", async () => {
    await openMasters();
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(names(screen.getByRole("menu"))).toEqual(["Parties", "Products", "Godown"]);
  });

  it("does not list the pages of Parties until Parties is opened", async () => {
    await openMasters();
    ["Retailer", "Supplier", "Manufacturer"].forEach((p) => expect(screen.queryByRole("menuitem", { name: p })).not.toBeInTheDocument());
    expect(row("Parties")).toHaveAttribute("aria-expanded", "false");
  });

  it("hovering Parties opens a third-level panel beside it with Retailer, Supplier and Manufacturer", async () => {
    await openMasters();
    openGroup("Parties");

    const third = await screen.findByRole("menu", { name: "Parties" });
    expect(screen.getAllByRole("menu")).toHaveLength(2);
    expect(names(third)).toEqual(["Retailer", "Supplier", "Manufacturer"]);
    expect(row("Parties")).toHaveAttribute("aria-expanded", "true");
    // second level is still all there — nothing was replaced or resized
    expect(names(screen.getAllByRole("menu")[0])).toEqual(["Parties", "Products", "Godown"]);
    // the third panel starts exactly where the second ends, so they cannot overlap
    expect(third.style.getPropertyValue("--sb-l2-left")).toBe("var(--sb-w-col)");
  });

  it("Retailer, Supplier and Manufacturer each go to their existing page", async () => {
    await openMasters();
    for (const [label, route] of [["Retailer", "/master/retailer"], ["Supplier", "/master/supplier"], ["Manufacturer", "/master/manufacturer"]]) {
      openGroup("Parties");
      fireEvent.click(await screen.findByRole("menuitem", { name: label }));
      expect(mockNavigate).toHaveBeenLastCalledWith(route);
      hover(document.body, "Masters");
    }
  });

  it("Godown goes straight to its page, with no third panel", async () => {
    await openMasters();
    fireEvent.click(row("Godown"));
    expect(mockNavigate).toHaveBeenCalledWith("/master/godown");
  });

  it("moving to a plain page closes the third-level panel", async () => {
    await openMasters();
    openGroup("Parties");
    await screen.findByRole("menu", { name: "Parties" });
    fireEvent.mouseEnter(row("Godown"));
    expect(screen.queryByRole("menu", { name: "Parties" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });

  it("moving to another sub menu swaps the third-level panel — only one is ever open", async () => {
    await openMasters();
    openGroup("Parties");
    await screen.findByRole("menu", { name: "Parties" });
    openGroup("Products");
    expect(screen.queryByRole("menu", { name: "Parties" })).not.toBeInTheDocument();
    expect(names(await screen.findByRole("menu", { name: "Products" }))).toEqual(["Product", "Product Type"]);
    expect(screen.getAllByRole("menu")).toHaveLength(2);
  });

  it("a tap opens and a second tap closes a sub menu (touch screens have no hover)", async () => {
    await openMasters();
    fireEvent.click(row("Parties"));
    expect(await screen.findByRole("menu", { name: "Parties" })).toBeInTheDocument();
    fireEvent.click(row("Parties"));
    expect(screen.queryByRole("menu", { name: "Parties" })).not.toBeInTheDocument();
  });

  it("opens a sub menu from the keyboard (Enter / Right arrow) and closes it with Escape or Left arrow", async () => {
    await openMasters();
    fireEvent.keyDown(row("Parties"), { key: "ArrowRight" });
    expect(await screen.findByRole("menu", { name: "Parties" })).toBeInTheDocument();
    fireEvent.keyDown(row("Parties"), { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Parties" })).not.toBeInTheDocument();
    fireEvent.keyDown(row("Parties"), { key: "Enter" });
    expect(await screen.findByRole("menu", { name: "Parties" })).toBeInTheDocument();
    fireEvent.keyDown(row("Parties"), { key: "ArrowLeft" });
    expect(screen.queryByRole("menu", { name: "Parties" })).not.toBeInTheDocument();
  });

  it("the back button in the third panel returns to the second level", async () => {
    await openMasters();
    openGroup("Parties");
    await screen.findByRole("menu", { name: "Parties" });
    fireEvent.click(screen.getByRole("button", { name: "Back from Parties" }));
    expect(screen.queryByRole("menu", { name: "Parties" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });

  it("gives a small grace period before closing, so moving the mouse between panels doesn't flicker them shut", async () => {
    const { container } = await openMasters();
    openGroup("Parties");
    fireEvent.mouseLeave(mainItem(container, "Masters"));
    expect(screen.getAllByRole("menu")).toHaveLength(2); // still open right after leaving
    fireEvent.mouseEnter(mainItem(container, "Masters")); // came back in time
    await new Promise((r) => setTimeout(r, 250));
    expect(screen.getAllByRole("menu")).toHaveLength(2);

    fireEvent.mouseLeave(mainItem(container, "Masters")); // really left
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("applies the same cascade to every other multi-level menu (Billing, Inventory, Administration)", async () => {
    mockModules(ALL);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toHaveLength(7));

    for (const [main, group, pages] of [
      ["Billing & GST", "Payments", ["Payment Collection", "Supplier Payment"]],
      ["Inventory", "Alerts", ["Expiry Alerts", "Reorder Alerts"]],
      ["Administration", "Vendor & Roles", ["Vendor", "Roles"]],
    ]) {
      hover(container, main);
      await screen.findByRole("menu");
      expect(screen.queryByRole("menuitem", { name: pages[0] })).not.toBeInTheDocument();
      openGroup(group);
      expect(names(await screen.findByRole("menu", { name: group }))).toEqual(pages);
      fireEvent.mouseLeave(mainItem(container, main));
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    }
  });

  it("a user who may only open one Masters page sees it directly, with no cascade", async () => {
    mockModules(["GODOWN"]);
    const { container } = renderSidebar();
    await loaded();
    await waitFor(() => expect(mainLabels(container)).toContain("Masters"));
    fireEvent.click(mainItem(container, "Masters"));
    expect(mockNavigate).toHaveBeenCalledWith("/master/godown");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

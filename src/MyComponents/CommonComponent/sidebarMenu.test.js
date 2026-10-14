import { MENU, buildMenu, formatName, normalize, searchEntries, searchMenu, unknownModules } from "./sidebarMenu";

const ALL = [
  "DASHBOARD", "INTELLIGENCE", "REPORTS", "PRODUCT", "PRODUCT_TYPE", "RETAILER", "SUPPLIER", "MANUFACTURER", "GODOWN",
  "INVENTORY", "BATCH", "STOCK_ADJUSTMENT", "ALERTS", "SALES", "SALES_RETURN", "PURCHASE", "PURCHASE_RETURN",
  "PAYMENT_COLLECTION", "SUPPLIER_PAYMENT", "RETAILER_OUTSTANDING", "SUPPLIER_OUTSTANDING", "EINVOICE", "EWAYBILL", "GSTR2RECON",
  "FIELD_REP", "FIELD_ORDER", "FIELD_COLLECTION", "VENDOR", "ROLES", "SCHEDULER", "BULK_UPLOAD_MANAGEMENT", "SCHEME",
];

const labels = (menu) => menu.map((m) => m.label);
const main = (menu, id) => menu.find((m) => m.id === id);
const leafLabels = (m) => m.items.flatMap((i) => (i.type === "group" ? i.children : [i])).map((l) => l.label);

describe("the menu structure", () => {
  it("has Home on its own plus exactly six main menus", () => {
    expect(MENU).toHaveLength(7);
    expect(labels(buildMenu(ALL))).toEqual(["Home", "Dashboard & Reports", "Masters", "Inventory", "Billing & GST", "Field Sales", "Administration"]);
    expect(buildMenu(ALL).filter((m) => m.id !== "home")).toHaveLength(6);
  });

  it("is three levels deep where it matters: main -> sub menu -> page", () => {
    const billing = main(buildMenu(ALL), "billing");
    expect(billing.items.map((i) => i.label)).toEqual(["Sales", "Purchase", "Payments", "Outstanding", "GST Compliance"]);
    expect(billing.items.every((i) => i.type === "group")).toBe(true);
    expect(billing.items[0].children.map((c) => c.label)).toEqual(["Sales", "Sales Return"]);
    expect(billing.items[4].children.map((c) => c.label)).toEqual(["E-Invoices", "E-Way Bills", "GSTR-2 Reconciliation"]);
  });

  it("puts every page somewhere, once, with its own route", () => {
    const entries = searchEntries(buildMenu(ALL));
    const routes = entries.map((e) => e.route);
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes).toEqual(expect.arrayContaining([
      "/home", "/master/dashboard", "/master/product-type", "/master/stock-adjustment", "/master/alerts", "/master/reorder-alerts",
      "/master/job-scheduler", "/master/bulk-upload", "/master/marg-import", "/master/field-collection", "/master/gstr2-recon", "/master/scheme",
    ]));
    expect(entries).toHaveLength(35); // Home + the 34 permissioned pages (the 32 the old search listed, plus Schemes & Discounts and Import from Marg)
  });

  it("every permission the old sidebar knew about still opens a page", () => {
    const shown = new Set(searchEntries(buildMenu(ALL)).flatMap((e) => e.modules || []));
    ["dashboard", "intelligence", "reports", "product", "producttype", "retailer", "supplier", "manufacturer", "godown", "inventory", "batch",
      "stockadjustment", "sales", "salesreturn", "purchase", "purchasereturn", "paymentcollection", "supplierpayment", "retaileroutstanding",
      "supplieroutstanding", "einvoice", "ewaybill", "gstr2recon", "fieldrep", "fieldorder", "fieldcollection", "vendor", "roles", "scheduler",
      "bulkuploadmanagement"].forEach((m) => expect(shown.has(m)).toBe(true));
  });

  it("Schemes & Discounts sits with the products under Masters, and is not mistaken for an unknown module", () => {
    const products = main(buildMenu(ALL), "masters").items.find((i) => i.label === "Products");
    expect(products.children.map((c) => c.label)).toEqual(["Product", "Product Type", "Schemes & Discounts"]);
    expect(unknownModules(["SCHEME"])).toEqual([]);
  });

  it("Import from Marg sits under Tools next to Bulk Data Upload and needs no module of its own", () => {
    const tools = main(buildMenu(["BULK_UPLOAD_MANAGEMENT"]), "admin");
    expect(leafLabels(tools)).toEqual(["Bulk Data Upload", "Import from Marg"]);
    expect(searchMenu(buildMenu(["BULK_UPLOAD_MANAGEMENT"]), "marg")[0].route).toBe("/master/marg-import");
    expect(searchMenu(buildMenu(["SALES"]), "marg")).toEqual([]);
    expect(unknownModules(["BULK_UPLOAD_MANAGEMENT"])).toEqual([]);
  });

  it("a user with only the Scheme permission gets just that page, found by searching 'scheme' or 'discount'", () => {
    const menu = buildMenu(["SCHEME"]);
    expect(leafLabels(main(menu, "masters"))).toEqual(["Schemes & Discounts"]);
    expect(searchMenu(menu, "scheme")[0].route).toBe("/master/scheme");
    expect(searchMenu(menu, "discount")[0].route).toBe("/master/scheme");
  });
});

describe("permissions decide what is shown", () => {
  it("a user with no modules still gets Home, as a direct link", () => {
    const menu = buildMenu([]);
    expect(labels(menu)).toEqual(["Home"]);
    expect(menu[0].direct).toMatchObject({ label: "Home", route: "/home" });
  });

  it("hides a page the user can't open, and a main menu with nothing left", () => {
    const menu = buildMenu(["SALES", "RETAILER"]);
    expect(labels(menu)).toEqual(["Home", "Masters", "Billing & GST"]);
    expect(leafLabels(main(menu, "billing"))).toEqual(["Sales"]);
    expect(main(menu, "inventory")).toBeUndefined();
    expect(main(menu, "admin")).toBeUndefined();
  });

  it("drops an empty sub menu but keeps its siblings", () => {
    const billing = main(buildMenu(["SALES", "SALES_RETURN", "PURCHASE"]), "billing");
    expect(billing.items.map((i) => i.label)).toEqual(["Sales", "Purchase"]); // Purchase has one page -> it is that page
  });

  it("a sub menu with a single page collapses into that page", () => {
    const masters = main(buildMenu(["GODOWN", "PRODUCT", "PRODUCT_TYPE"]), "masters");
    const godown = masters.items.find((i) => i.label === "Godown");
    expect(godown).toMatchObject({ type: "leaf", route: "/master/godown" }); // not a "Locations" group with one child
    expect(masters.items.find((i) => i.label === "Products").children).toHaveLength(2);
  });

  it("a main menu with exactly one page is a direct link", () => {
    const menu = buildMenu(["FIELD_COLLECTION"]);
    expect(main(menu, "field").direct).toMatchObject({ label: "Field Collections", route: "/master/field-collection" });
    expect(main(buildMenu(["FIELD_REP", "FIELD_ORDER"]), "field").direct).toBeNull();
  });

  it("matches permission names however they are written", () => {
    expect(leafLabels(main(buildMenu(["Stock Adjustment"]), "inventory"))).toEqual(["Stock Adjustment"]);
    expect(leafLabels(main(buildMenu(["stock_adjustments"]), "inventory"))).toEqual(["Stock Adjustment"]);
    expect(leafLabels(main(buildMenu(["BULK UPLOAD"]), "admin"))).toEqual(["Bulk Data Upload", "Import from Marg"]);
    expect(leafLabels(main(buildMenu(["report"]), "overview"))).toContain("Reports");
  });

  it("the single ALERTS permission opens both alert pages, as before", () => {
    expect(leafLabels(main(buildMenu(["ALERTS"]), "inventory"))).toEqual(["Expiry Alerts", "Reorder Alerts"]);
  });

  it("never shows permission-only modules", () => {
    expect(unknownModules(["SALES", "TCS", "MFA"])).toEqual([]);
    expect(searchEntries(buildMenu(["SALES", "TCS", "MFA"])).map((e) => e.label)).not.toEqual(expect.arrayContaining(["Tcs", "Mfa"]));
  });
});

describe("modules the menu doesn't know about", () => {
  it("are listed under Administration instead of becoming extra top-level items", () => {
    const menu = buildMenu(["SALES", "SOME_NEW_MODULE"]);
    expect(labels(menu)).toEqual(["Home", "Billing & GST", "Administration"]); // never more than Home + six
    const admin = main(menu, "admin");
    expect(admin.direct).toMatchObject({ label: "Some New Module", navKey: "SOME_NEW_MODULE" });
  });

  it("several unknown modules are grouped as 'Other modules'", () => {
    const admin = main(buildMenu(["ROLES", "NEW_ONE", "NEW_TWO"]), "admin");
    const other = admin.items.find((i) => i.label === "Other modules");
    expect(other.children.map((c) => c.label)).toEqual(["New One", "New Two"]);
  });

  it("stay within six main menus whatever the user has", () => {
    expect(buildMenu([...ALL, "A_B", "C_D", "E_F"]).length).toBeLessThanOrEqual(7); // Home + six
  });
});

describe("search", () => {
  const menu = buildMenu(ALL);

  it("finds a page by name and shows where it lives", () => {
    const hit = searchMenu(menu, "sales return");
    expect(hit[0]).toMatchObject({ label: "Sales Return", path: "Billing & GST › Sales", route: "/master/sales-return" });
  });

  it("finds pages by their sub menu too, without listing a whole main menu for a word in its name", () => {
    const labelsFor = (q) => searchMenu(menu, q).map((e) => e.label);
    expect(labelsFor("gst")[0]).toBe("GSTR-2 Reconciliation"); // the name match comes first
    expect([...labelsFor("gst")].sort()).toEqual(["E-Invoices", "E-Way Bills", "GSTR-2 Reconciliation"]); // not Sales, Purchase... just because "Billing & GST" says GST
    expect(labelsFor("field sales")).toEqual(["Field Collections", "Field Orders", "Field Reps"]);
  });

  it("lists name matches before path matches", () => {
    const hits = searchMenu(menu, "sales").map((e) => e.label);
    expect(hits.indexOf("Sales")).toBeLessThan(hits.indexOf("Field Reps")); // "Field Sales" path match comes after name matches
  });

  it("is case-insensitive and ignores blank queries", () => {
    expect(searchMenu(menu, "  ")).toEqual([]);
    expect(searchMenu(menu, "")).toEqual([]);
    expect(searchMenu(menu, "GODOWN")).toHaveLength(1);
    expect(searchMenu(menu, "zzzz")).toEqual([]);
  });

  it("only searches pages the user is allowed to see", () => {
    expect(searchMenu(buildMenu(["SALES"]), "retailer")).toEqual([]);
  });
});

describe("helpers", () => {
  it("normalize and formatName", () => {
    expect(normalize("Stock_Adjustment")).toBe("stockadjustment");
    expect(formatName("SOME_NEW_MODULE")).toBe("Some New Module");
  });
});

// The sidebar menu tree: Home on its own, then 6 main menus -> sub menus -> sub-sub menus (pages).
// Pure data + functions (no React) so the grouping and the permission filtering can be tested on their own.
//
// A "leaf" is a page. A "group" is a sub menu holding leaves. A main menu holds groups and/or leaves.
// What a user sees is decided only by their modules (permissions): a page they can't open is never shown,
// a sub menu with nothing left is dropped, a sub menu with a single page collapses into that page, and a
// main menu with a single page becomes a direct link.

export const normalize = (s = "") => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

export const formatName = (name) =>
  String(name).toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// icon = key into the sidebar's icon tables; modules = any one of these (normalised) grants the page, null = always shown
const page = (label, route, modules, icon) => ({ type: "leaf", label, route, modules, icon });
const group = (label, icon, children) => ({ type: "group", label, icon, children });

export const MENU = [
  // Home stands on its own: always shown, always a direct link.
  { id: "home", label: "Home", icon: "home", items: [page("Home", "/home", null, "home")] },
  {
    id: "overview", label: "Dashboard & Reports", icon: "dashboard",
    items: [
      page("Dashboard", "/master/dashboard", ["dashboard"], "dashboard"),
      page("VMS Intelligence", "/master/intelligence", ["intelligence"], "intelligence"),
      page("Reports", "/master/reports", ["reports", "report"], "reports"),
    ],
  },
  {
    id: "masters", label: "Masters", icon: "product",
    items: [
      group("Parties", "user", [
        page("Retailer", "/master/retailer", ["retailer"], "user"),
        page("Supplier", "/master/supplier", ["supplier"], "supplier"),
        page("Manufacturer", "/master/manufacturer", ["manufacturer"], "factory"),
      ]),
      group("Products", "product", [
        page("Product", "/master/product", ["product"], "product"),
        page("Product Type", "/master/product-type", ["producttype"], "type"),
        page("Schemes & Discounts", "/master/scheme", ["scheme", "schemes"], "payment"),
      ]),
      group("Locations", "warehouse", [
        page("Godown", "/master/godown", ["godown"], "warehouse"),
      ]),
    ],
  },
  {
    id: "inventory", label: "Inventory", icon: "inventory",
    items: [
      group("Stock", "inventory", [
        page("Inventory", "/master/inventory", ["inventory"], "inventory"),
        page("Batches", "/master/batch", ["batch", "batches"], "batch"),
        page("Stock Adjustment", "/master/stock-adjustment", ["stockadjustment", "stockadjustments"], "reorder"),
      ]),
      group("Alerts", "alert", [
        page("Expiry Alerts", "/master/alerts", ["expiryalerts", "expiryalert", "alerts"], "alert"),
        page("Reorder Alerts", "/master/reorder-alerts", ["reorderalerts", "reorderalert", "lowstockalerts", "lowstockalert", "alerts"], "reorder"),
      ]),
    ],
  },
  {
    id: "billing", label: "Billing & GST", icon: "sales",
    items: [
      group("Sales", "sales", [
        page("Sales", "/master/sales", ["sales"], "sales"),
        page("Sales Return", "/master/sales-return", ["salesreturn"], "return"),
      ]),
      group("Purchase", "purchase", [
        page("Purchase", "/master/purchase", ["purchase"], "purchase"),
        page("Purchase Return", "/master/purchase-return", ["purchasereturn"], "return"),
      ]),
      group("Orders & Stock Movement", "inventory", [
        page("Purchase Orders", "/master/purchase-order", ["purchaseorder"], "purchase"),
        page("Sales Orders", "/master/sales-order", ["salesorder"], "sales"),
        page("Delivery Challans", "/master/delivery-challan", ["deliverychallan"], "ewaybill"),
        page("Stock Transfers", "/master/stock-transfer", ["stocktransfer"], "warehouse"),
      ]),
      group("Payments", "payment", [
        page("Payment Collection", "/master/payment-collection", ["paymentcollection"], "payment"),
        page("Supplier Payment", "/master/supplier-payment", ["supplierpayment"], "payment"),
      ]),
      group("Outstanding", "ledger", [
        page("Retailer Outstanding", "/master/retailer-outstanding", ["retaileroutstanding"], "ledger"),
        page("Supplier Outstanding", "/master/supplier-outstanding", ["supplieroutstanding"], "ledger"),
      ]),
      group("GST Compliance", "einvoice", [
        page("E-Invoices", "/master/e-invoice", ["einvoice"], "einvoice"),
        page("E-Way Bills", "/master/e-way-bill", ["ewaybill"], "ewaybill"),
        page("GSTR-2 Reconciliation", "/master/gstr2-recon", ["gstr2recon"], "gstr2recon"),
        page("GST Returns", "/master/gst-return", ["gstreturn"], "gstr2recon"),
      ]),
    ],
  },
  {
    id: "field", label: "Field Sales", icon: "fieldsales",
    items: [
      page("Field Reps", "/master/field-rep", ["fieldrep"], "fieldrep"),
      page("Field Orders", "/master/field-order", ["fieldorder"], "fieldorder"),
      page("Field Collections", "/master/field-collection", ["fieldcollection"], "fieldcollection"),
    ],
  },
  {
    id: "admin", label: "Administration", icon: "vendor",
    items: [
      group("Vendor & Roles", "role", [
        page("Vendor", "/master/vendor", ["vendor"], "user"),
        page("Roles", "/master/roles", ["roles"], "role"),
      ]),
      group("Tools", "bulkupload", [
        page("Job Scheduler", "/master/job-scheduler", ["scheduler"], "scheduler"),
        page("Bulk Data Upload", "/master/bulk-upload", ["bulkuploadmanagement", "bulkupload"], "bulkupload"),
        page("Import from Marg", "/master/marg-import", ["bulkuploadmanagement", "bulkupload"], "bulkupload"),
      ]),
    ],
  },
];

// Permission-only modules with no page of their own — they gate settings screens elsewhere and must never
// surface as a menu entry.
const HIDDEN_MODULES = ["tcs", "mfa"];

const leavesOf = (items) => items.flatMap((i) => (i.type === "group" ? i.children : [i]));
const KNOWN = new Set([
  ...MENU.flatMap((m) => leavesOf(m.items)).flatMap((l) => l.modules || []),
  ...HIDDEN_MODULES,
]);

/** Modules the user has that this menu doesn't know about (a new backend module): shown under Administration. */
export const unknownModules = (modules) => modules.filter((m) => !KNOWN.has(normalize(m)));

/**
 * The menu for this user: { id, label, icon, items, direct }.
 * `direct` is set when the main menu has exactly one page, so clicking it can go straight there.
 */
export function buildMenu(modules = []) {
  const have = new Set(modules.map(normalize));
  const allowed = (leaf) => !leaf.modules || leaf.modules.some((m) => have.has(m));
  const others = unknownModules(modules).map((m) => ({ type: "leaf", label: formatName(m), navKey: m, icon: "default" }));

  const prune = (items) => items
    .map((item) => {
      if (item.type !== "group") return allowed(item) ? item : null;
      const kids = item.children.filter(allowed);
      if (kids.length === 0) return null;
      return kids.length === 1 ? kids[0] : { ...item, children: kids }; // a sub menu with one page is just that page
    })
    .filter(Boolean);

  return MENU
    .map((main) => {
      const extra = main.id === "admin" && others.length
        ? [others.length === 1 ? others[0] : group("Other modules", "default", others)]
        : [];
      const items = [...prune(main.items), ...extra];
      if (items.length === 0) return null;
      return { id: main.id, label: main.label, icon: main.icon, items, direct: items.length === 1 && items[0].type === "leaf" ? items[0] : null };
    })
    .filter(Boolean);
}

/** Every page in the menu with its breadcrumb ("Billing & GST › Sales"), for the search box. */
export function searchEntries(menu) {
  const out = [];
  for (const main of menu) {
    for (const item of main.items) {
      if (item.type === "group") item.children.forEach((c) => out.push({ ...c, path: `${main.label} › ${item.label}` }));
      else out.push({ ...item, path: main.label });
    }
  }
  return out;
}

// The innermost menu a page sits in ("Billing & GST › GST Compliance" -> "GST Compliance"). Matching on the full path
// would make "gst" list every page under "Billing & GST", which is noise.
const innermost = (path) => path.split(" › ").pop();

/** Case-insensitive match on the page name or its sub menu, so "gst" finds E-Invoices and "field sales" finds the field pages. */
export function searchMenu(menu, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return searchEntries(menu)
    .filter((e) => e.label.toLowerCase().includes(q) || innermost(e.path).toLowerCase().includes(q))
    .sort((a, b) => {
      const ap = a.label.toLowerCase().includes(q) ? 0 : 1; // name matches before sub-menu matches
      const bp = b.label.toLowerCase().includes(q) ? 0 : 1;
      return ap - bp || a.label.localeCompare(b.label);
    });
}

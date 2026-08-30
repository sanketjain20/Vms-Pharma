// Maps the display moduleName used by DynamicGrid/View/Edit/Payment screens
// to the backend's audit module constant (matches @Auditable(module=...) and
// the seeded `modules` table naming, e.g. "MANUFACTURER", "PRODUCT_TYPE").
const MODULE_KEY_MAP = {
  "Product": "PRODUCT",
  "Vendor": "VENDOR",
  "Inventory": "INVENTORY",
  "Sales": "SALES",
  "Product Type": "PRODUCT_TYPE",
  "Roles": "ROLES",
  "Supplier": "SUPPLIER",
  "Purchase": "PURCHASE",
  "Manufacturer": "MANUFACTURER",
  "Retailer": "RETAILER",
  "Payment Collection": "PAYMENT_COLLECTION",
  "Supplier Payment": "SUPPLIER_PAYMENT",
  "Sales Return": "SALES_RETURN",
  "Purchase Return": "PURCHASE_RETURN",
  "Retailer Outstanding": "RETAILER_OUTSTANDING",
  "Supplier Outstanding": "SUPPLIER_OUTSTANDING",
  "Batch": "BATCH",
};

export function toAuditModuleKey(moduleName) {
  return MODULE_KEY_MAP[moduleName] || null;
}

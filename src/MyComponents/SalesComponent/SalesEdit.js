import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { createPortal } from "react-dom";
import {
  computeTotals, toItemPayload, fetchApplicable, withScheme, removeScheme, freeText, linesFromSale,
} from "../../utils/salesSchemes";
const GST_RATES = [0, 5, 12, 18, 28];

/* ─────────────────────────────────────────
   PRODUCT AVATAR — deterministic color + initials, no image needed
   (same helper as SalesAddNew.js, duplicated locally like SearchableDropdown
   already is — small, pure, no shared-module needed)
───────────────────────────────────────── */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function productInitials(name) {
  const parts = String(name || "?").trim().split(/\s+/).slice(0, 2);
  const s = parts.map(p => p[0]).join("").toUpperCase();
  return s || "?";
}
function productHue(name) {
  return hashString(String(name || "")) % 360;
}

const PAYMENT_ICONS = {
  PAID:    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3 7-7"/></svg>,
  CREDIT:  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.5V8l2.6 1.6"/></svg>,
  PARTIAL: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M8 1.8A6.2 6.2 0 018 14.2" fill="currentColor" stroke="none"/></svg>,
};
const PAYMENT_TYPES = [
  { id: "PAID",    label: "Full Payment",       sub: "Pay the net amount now" },
  { id: "CREDIT",  label: "Credit (Pay Later)", sub: "Pay later, on account" },
  { id: "PARTIAL", label: "Partial Payment",    sub: "Pay part now, rest later" },
];

/* ─────────────────────────────────────────
   SEARCHABLE DROPDOWN — same portal-positioned component as SalesAdd.js,
   so it floats above the modal's own scroll container instead of being
   clipped by it, and reads as the same dropdown pattern everywhere.
───────────────────────────────────────── */
const SearchableDropdown = ({
  label, options, selectedId, onSelect,
  search, setSearch, open, setOpen,
  placeholder, dropdownRef, error
}) => {
  const [coords, setCoords] = useState(null);
  const selectedOption = options.find(o => String(o.id) === String(selectedId));
  const displayValue = open ? search : (selectedOption?.name ?? "");
  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const updateCoords = () => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const listHeight = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < listHeight && rect.top > spaceBelow;
    setCoords({
      left: rect.left,
      width: rect.width,
      top: dropUp ? undefined : rect.bottom + 5,
      bottom: dropUp ? window.innerHeight - rect.top + 5 : undefined,
    });
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) setSearch("");
    updateCoords();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const handler = () => updateCoords();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="afx-field" ref={dropdownRef}>
      <label className="afx-label">{label}</label>
      <div className="afx-searchdrop">
        <div className={`afx-searchdrop-face ${open ? "is-open" : ""} ${selectedOption ? "is-filled" : ""}`} onClick={handleOpen}>
          <input
            type="text" value={displayValue} placeholder={placeholder}
            onChange={e => setSearch(e.target.value)} onClick={handleOpen}
            style={{ background: "transparent", border: "none", outline: "none", color: "inherit", font: "inherit", width: "100%" }}
          />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        {open && coords && createPortal(
          <div
            className="afx-searchdrop-panel"
            style={{ position: "fixed", left: coords.left, width: coords.width, top: coords.top, bottom: coords.bottom }}
          >
            <div className="afx-searchdrop-list">
              {filtered.length === 0 ? (
                <div className="afx-searchdrop-empty">No results found</div>
              ) : filtered.map(o => (
                <div key={o.id}
                  className={`afx-searchdrop-item ${String(o.id) === String(selectedId) ? "is-selected" : ""}`}
                  onMouseDown={e => { e.preventDefault(); onSelect(o.id); setOpen(false); setSearch(""); }}
                >{o.name}</div>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
      {error && <div className="afx-error">{error}</div>}
    </div>
  );
};

export default function SalesEdit({ uKey, onClose, onSubmit, documentMode = false }) {
  // ── Existing state ────────────────────────────────────────────────────────
  const [productTypes, setProductTypes] = useState([]);
  const [products, setProducts]         = useState([]);
  const [allProducts, setAllProducts]   = useState([]);
  const lastLoadedType                  = useRef(null);
  const [inventory, setInventory]       = useState(null);
  const [selectedType, setSelectedType]       = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity]     = useState("");
  const [taxInput, setTaxInput]     = useState("");
  const [taxType, setTaxType]       = useState("PERCENT");
  const [lineItems, setLineItems]       = useState([]);
  const [editIndex, setEditIndex]       = useState(null);
  const [discountInput, setDiscountInput] = useState("0");
  const [discountType, setDiscountType]   = useState("FLAT");
  const [billingMode, setBillingMode]     = useState("CASH");
  const [saleId, setSaleId]               = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amountPaid, setAmountPaid]       = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [errors, setErrors]           = useState({});
  const [activeTab, setActiveTab]     = useState("Existing");
  const [viewMode, setViewMode]       = useState("tabs"); // "tabs" | "all"
  const [originalItems, setOriginalItems] = useState([]);

  // ── Schemes: a saved line keeps its scheme; a new or changed line gets the best one suggested ──
  const lineKeyRef = useRef(0);
  // document mode: the order as loaded, so a save keeps what this form does not edit (date, godown, notes...)
  const loadedOrder = useRef(null);
  const lineItemsRef = useRef([]);
  const retailerTouched = useRef(false);
  const [schemePending, setSchemePending] = useState(0);
  const [typeSearch, setTypeSearch]                   = useState("");
  const [productSearch, setProductSearch]             = useState("");
  const [typeDropdownOpen, setTypeDropdownOpen]       = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const typeDropdownRef    = useRef(null);
  const productDropdownRef = useRef(null);
  const [scanValue, setScanValue] = useState("");
  const scanRef = useRef(null);

  // ── NEW state ─────────────────────────────────────────────────────────────
  const [retailers, setRetailers]           = useState([]);
  const [selectedRetailer, setSelectedRetailer] = useState("");
  const [retailerSearch, setRetailerSearch]     = useState("");
  const [retailerDropdownOpen, setRetailerDropdownOpen] = useState(false);
  const retailerDropdownRef = useRef(null);
  const [creditPaymentType, setCreditPaymentType] = useState("PAID");
  const [dueDate, setDueDate]               = useState("");
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId]   = useState("");
  const [initialLoading, setInitialLoading] = useState(true);

  const safeJson = async (res) => {
    try { const text = await res.text(); return text ? JSON.parse(text) : null; }
    catch { return null; }
  };

  /* ── FETCH RETAILERS ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Retailer/Dropdown`, { method: "GET" })
      .then(r => r.json())
      .then(json => setRetailers(
        (json?.data ?? []).map(r => ({ id: r.id, name: r.shopName + " · " + r.ownerName }))
      ))
      .catch(() => {});
  }, []);

  /* ── FETCH ALL PRODUCTS — unchanged ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(json => {
        const dataObj = json?.data;
        const list = Array.isArray(dataObj) ? dataObj : typeof dataObj === "object" ? Object.values(dataObj).find(v => Array.isArray(v)) || [] : [];
        setAllProducts(list); setProducts(list);
      }).catch(() => { setAllProducts([]); setProducts([]); });
  }, []);

  /* ── FETCH PRODUCT TYPES — unchanged ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/ProductType/GetAllProductType`, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(safeJson)
      .then(json => { const list = json?.data?.productTypes ?? []; setProductTypes(Array.isArray(list) ? list : []); })
      .catch(() => {});
  }, []);

  /* ── FETCH SALE — updated to load new fields ── */
  useEffect(() => { if (uKey) fetchSaleByUkey(); }, [uKey]);

  const fetchSaleByUkey = () => {
    setInitialLoading(true);
    apiClient(`${API_BASE_URL}/api/${documentMode ? "SalesOrder/GetSalesOrderByUKey" : "Sales/GetSalesByUkey"}/${uKey}`, {
      method: "GET", headers: { "Content-Type": "application/json" },
    })
      .then(safeJson)
      .then(json => {
        if (!json?.data) return toast.error("Sale not found");
        const source = json.data;
        if (documentMode) loadedOrder.current = source;
        const sale = documentMode ? {
          ...source,
          invoiceNumber: source.orderNumber,
          items: (source.items || []).map(item => ({
            ...item, sellingPrice: item.unitPrice, product: item.productName,
            batchNumberSnapshot: item.batchNumber, expiryDateSnapshot: item.expiryDate, hsnCodeSnapshot: item.hsnCode,
          })),
        } : source;
        setSaleId(sale.id);
        setInvoiceNumber(sale.invoiceNumber);
        setOriginalItems(sale.items);
        // Free-goods rows are not lines (the server recreates them from the scheme); the discount the clerk typed is
        // the manual one, the schemes' share is worked out again from the lines.
        const manual = sale.manualDiscount ?? sale.totalDiscount ?? 0;
        setLineItems(linesFromSale(sale.items, manual, sale.schemeDiscount || 0)
          .map(l => ({ ...l, lineKey: ++lineKeyRef.current })));
        setDiscountInput(manual);
        setDiscountType("FLAT");
        setBillingMode(sale.billingMode || "CASH");
        setAmountPaid(sale.amountPaid || 0);
        setRemainingAmount(sale.remainingAmount || 0);
        // NEW — load existing retailer + payment fields
        if (sale.retailerId) setSelectedRetailer(String(sale.retailerId));
        setCreditPaymentType(sale.paymentType || "PAID");
        setDueDate(sale.dueDate || "");
      })
      .catch(() => toast.error("Sale not found"))
      .finally(() => setInitialLoading(false));
  };

  /* ── FETCH BATCHES when product selected ── */
  useEffect(() => {
    if (!selectedProduct) { setAvailableBatches([]); setSelectedBatchId(""); return; }
    apiClient(`${API_BASE_URL}/api/Sales/GetAvailableBatches/${selectedProduct}`, { method: "GET" })
      .then(r => r.json())
      .then(json => { if (json?.status === 200) setAvailableBatches(json.data ?? []); else setAvailableBatches([]); })
      .catch(() => setAvailableBatches([]));
  }, [selectedProduct]);

  const handleTypeChange = (e) => {
    const typeId = e.target.value;
    setSelectedType(typeId); setSelectedProduct(""); setInventory(null); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");
    // Product Type is an optional filter, not a required step — clearing it
    // (the "All" chip) shows every product again.
    if (!typeId) { setProducts(allProducts); return; }
    apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${typeId}`, { method: "GET" })
      .then(safeJson).then(json => setProducts(json?.data ?? [])).catch(() => {});
  };

  /* ── AUTO SET TYPE — unchanged ── */
  useEffect(() => {
    if (!selectedProduct) return;
    apiClient(`${API_BASE_URL}/api/ProductType/GetProdTypeByProductId/${selectedProduct}`)
      .then(r => r.json())
      .then(json => {
        const typeId = json?.data?.productTypeId || json?.data?.id;
        if (typeId && typeId !== selectedType) {
          setSelectedType(typeId);
          if (lastLoadedType.current !== typeId) {
            lastLoadedType.current = typeId;
            apiClient(`${API_BASE_URL}/api/Product/GetProdByProdId/${typeId}`)
              .then(r => r.json())
              .then(json => { const list = json?.data ?? []; setProducts(Array.isArray(list) ? list : []); })
              .catch(() => {});
          }
        }
      }).catch(() => {});
  }, [selectedProduct]);

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProduct(prodId); setInventory(null); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");
    if (!prodId) return;
    apiClient(`${API_BASE_URL}/api/Inventory/GetInventoryByProdId/${prodId}`, { method: "GET" })
      .then(safeJson).then(json => setInventory(json?.data || null)).catch(() => {});
  };

  /* ── CLICK OUTSIDE ── */
  useEffect(() => {
    const handler = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) { setTypeDropdownOpen(false); setTypeSearch(""); }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) { setProductDropdownOpen(false); setProductSearch(""); }
      if (retailerDropdownRef.current && !retailerDropdownRef.current.contains(e.target)) { setRetailerDropdownOpen(false); setRetailerSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Stock helpers for the currently-selected product's inventory ── */
  const outOfStock = !!inventory && inventory.currentQuantity <= 0;
  const lowStock    = !!inventory && inventory.currentQuantity > 0 && inventory.currentQuantity <= 10;
  const noPriceConfigured = !!selectedProduct && !inventory;

  /* ── QUANTITY STEPPER ── */
  const stepQuantity = (delta) => {
    const next = (parseInt(quantity) || 0) + delta;
    if (next < 1) return;
    if (inventory && next > inventory.currentQuantity) { toast.error("Exceeds available stock"); return; }
    setQuantity(String(next));
  };

  /* Asks the server which scheme fits a line and attaches it (see SalesAdd). The server checks again on save. */
  const suggestScheme = async (line, retailerId) => {
    setSchemePending(n => n + 1);
    const applicable = await fetchApplicable({
      productId: line.productId, retailerId, quantity: line.quantity, unitPrice: line.sellingPrice,
    });
    setSchemePending(n => n - 1);
    setLineItems(prev => prev.map(l =>
      l.lineKey === line.lineKey && !l.schemeOff && l.quantity === line.quantity && l.sellingPrice === line.sellingPrice
        ? withScheme(l, applicable)
        : l
    ));
  };

  useEffect(() => { lineItemsRef.current = lineItems; }, [lineItems]);

  /* Only when the user picks another retailer: opening a sale must keep the schemes it was saved with. */
  useEffect(() => {
    if (!retailerTouched.current) return;
    lineItemsRef.current.filter(l => !l.schemeOff).forEach(l => suggestScheme(l, selectedRetailer || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRetailer]);

  const dropScheme = (i) => setLineItems(prev => prev.map((l, idx) => (idx === i ? removeScheme(l) : l)));
  const retryScheme = (i) => {
    const l = { ...lineItems[i], schemeOff: false };
    setLineItems(prev => prev.map((x, idx) => (idx === i ? l : x)));
    suggestScheme(l, selectedRetailer || null);
  };

  const addOrUpdateItem = () => {
    let tempErrors = {};
    if (!selectedProduct) tempErrors.selectedProduct = "Select product";
    const product = products.find(p => p.id === parseInt(selectedProduct));
    if (selectedProduct && !product) tempErrors.selectedProduct = tempErrors.selectedProduct || "Invalid product";

    // Selling price always comes from inventory/product configuration —
    // there is no manual/adhoc price entry.
    if (selectedProduct && !inventory) {
      tempErrors.selectedProduct = "Selling price is not configured for this product";
    } else if (inventory && inventory.currentQuantity <= 0) {
      tempErrors.selectedProduct = "This product is out of stock";
    }

    if (!quantity || quantity <= 0) {
      tempErrors.quantity = "Enter valid quantity";
    } else if (inventory && parseInt(quantity) > inventory.currentQuantity) {
      tempErrors.quantity = "Exceeds available stock";
    }

    const price = inventory ? inventory.unitSellingPrice : 0;
    let taxValue = parseFloat(taxInput || 0);
    if (taxValue < 0) tempErrors.taxInput = "Tax cannot be negative";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) {
      toast.error(Object.values(tempErrors)[0]);
      return;
    }

    const taxAmount = taxType === "PERCENT" ? (price * quantity * taxValue) / 100 : taxValue;
    const item = {
      lineKey: editIndex !== null ? lineItems[editIndex].lineKey : ++lineKeyRef.current,
      schemeOff: editIndex !== null ? !!lineItems[editIndex].schemeOff : false,
      schemeId: null, schemeName: "", schemeDescription: "", freeQuantity: 0, schemeDiscount: 0,
      productId: parseInt(selectedProduct),
      productName: product.name,
      quantity: parseInt(quantity),
      sellingPrice: price,
      taxAmount,
      totalAmount: price * quantity + taxAmount,
      // NEW
      batchId: selectedBatchId ? parseInt(selectedBatchId) : null,
      batchNumber: selectedBatchId
        ? availableBatches.find(b => String(b.batchId) === String(selectedBatchId))?.batchNumber || "AUTO"
        : "AUTO",
      expiryDate: selectedBatchId
        ? availableBatches.find(b => String(b.batchId) === String(selectedBatchId))?.expiryDate || ""
        : "",
    };

    let updated = [...lineItems];
    if (editIndex !== null) { updated[editIndex] = item; setEditIndex(null); }
    else updated.push(item);
    setLineItems(updated);
    clearForm();
    toast.success("Item saved");
    if (!item.schemeOff) suggestScheme(item, selectedRetailer || null);
  };

  const clearForm = () => {
    setSelectedType(""); setSelectedProduct(""); setQuantity("");
    setTaxInput(""); setInventory(null);
    setTaxType("PERCENT"); setErrors({});
    setAvailableBatches([]); setSelectedBatchId("");
  };

  const editItem = async (index) => {
    const it = lineItems[index];
    setEditIndex(index);
    setSelectedProduct(it.productId); setQuantity(it.quantity);
    setTaxInput(it.taxAmount);
    setTaxType("FLAT"); setErrors({});
    setSelectedBatchId(it.batchId ? String(it.batchId) : "");
    try {
      const iRes  = await apiClient(`${API_BASE_URL}/api/Inventory/GetInventoryByProdId/${it.productId}`, { method: "GET" });
      const iJson = await safeJson(iRes);
      if (iJson?.data) setInventory(iJson.data);
    } catch {
      // backend unreachable — global toast already covers it; the line
      // item's own fields (set above) still populate the edit fields.
    }
  };

  const deleteItem = (i) => { const u = [...lineItems]; u.splice(i, 1); setLineItems(u); };

  /* ── BARCODE SCAN-TO-SELECT ──
     A USB/Bluetooth barcode scanner behaves like a keyboard — it types the
     code then fires Enter, which the scan input below submits on. Matches
     the already-loaded product list first, falling back to a live lookup
     for a product added since this form opened. Scanning only SELECTS the
     product type + product (same as picking them from the dropdowns) and
     loads its inventory/batches — it deliberately does not set a quantity
     or add a line item. Quantity is always a manual choice by the user,
     who then clicks "+ Add Item" themselves. */
  const handleBarcodeScan = async (rawCode) => {
    const code = rawCode.trim();
    if (!code) return;

    let product = allProducts.find(p => p.barcode === code);

    if (!product) {
      try {
        const res  = await apiClient(`${API_BASE_URL}/api/Product/GetProductByBarcode/${encodeURIComponent(code)}`, { method: "GET" });
        const json = await safeJson(res);
        if (json?.status === 200 && json?.data) {
          product = json.data;
          setAllProducts(prev => prev.some(p => p.id === product.id) ? prev : [...prev, product]);
        }
      } catch {
        toast.error("Barcode lookup failed");
        return;
      }
    }

    if (!product) {
      toast.error(`No product found for barcode "${code}"`);
      return;
    }

    // handleTypeChange's own fetch (async) refreshes the type-filtered
    // product list — merge the scanned product in immediately too, so
    // "+ Add Item" works even if clicked before that fetch resolves.
    handleTypeChange({ target: { value: product.productTypeId ?? "" } });
    setProducts(prev => prev.some(p => p.id === product.id) ? prev : [...prev, product]);
    handleProductChange({ target: { value: product.id } });
    setQuantity("");

    toast.success(`${product.name} selected — enter quantity and Add Item`);
  };

  /* ── TOTALS: Subtotal → Discount → Taxable Value → GST → Net Amount ── */
  // One calculation (utils/salesSchemes.js) that mirrors the server: scheme discount, then the invoice discount on what
  // is left, GST on the discounted value. With no scheme and no discount it is the same sum as before.
  const totals = computeTotals({ lines: lineItems, manualDiscount: discountInput, discountType });
  const lineSubtotal = totals.gross;
  const schemeDiscAmt = totals.schemeDiscount;
  const discAmt = totals.manualDiscount;
  const taxableValue = totals.taxable;
  const lineTaxTotal = totals.tax;
  const netAmount = totals.net;

  useEffect(() => {
    const net = netAmount.toFixed(2);
    if (creditPaymentType === "PAID") { setAmountPaid(net); setRemainingAmount(0); }
    else if (creditPaymentType === "CREDIT") { setAmountPaid(0); setRemainingAmount(net); }
    else {
      const paid = parseFloat(amountPaid || 0);
      const rem  = netAmount - paid;
      setRemainingAmount(rem < 0 ? 0 : rem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditPaymentType, lineItems, discountInput, discountType]);

  const updateSale = () => {
    let tempErrors = {};
    if (lineItems.length === 0) tempErrors.lineItems = "Add at least one item";
    if (!billingMode) tempErrors.billingMode = "Select billing mode";
    if (discountInput < 0) tempErrors.discountInput = "Discount cannot be negative";
    if (totals.discountTooLarge) tempErrors.discountInput = "Discount cannot be more than the value of the goods after schemes";
    if ((creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && !dueDate)
      tempErrors.dueDate = "Due date is required";
    if (creditPaymentType !== "CREDIT" && (!amountPaid || amountPaid <= 0)) tempErrors.amountPaid = "Enter valid amount paid";
    if (parseFloat(amountPaid) > netAmount) tempErrors.amountPaid = "Amount paid cannot exceed net amount";
    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;
    if (schemePending > 0) { toast.info("Still checking schemes — try again in a moment"); return; }

    const orderPayload = {
      retailerId: selectedRetailer ? parseInt(selectedRetailer) : null,
      godownId: loadedOrder.current?.godownId ?? (Number(localStorage.getItem("activeGodownId") || 0) || null),
      orderDate: loadedOrder.current?.orderDate || new Date().toISOString().slice(0, 10),
      expectedDate: loadedOrder.current?.expectedDate || null,
      terms: loadedOrder.current?.terms || "", notes: loadedOrder.current?.notes || "",
      billingMode, paymentType: creditPaymentType, dueDate: dueDate || null,
      amountPaid: parseFloat(amountPaid || 0), totalDiscount: totals.manualDiscount,
      autoApplySchemes: loadedOrder.current?.autoApplySchemes !== false,
      items: lineItems.map(item => ({ productId: item.productId, quantity: item.quantity,
        unitPrice: Number(item.sellingPrice || 0), gstRate: Number(item.gstRate || 0), schemeId: item.schemeId || null,
        batchId: item.batchId || null })),
    };
    apiClient(`${API_BASE_URL}/api/${documentMode ? "SalesOrder/UpdateSalesOrder" : "Sales/UpdateSales"}/${documentMode ? uKey : saleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(documentMode ? orderPayload : {
        totalDiscount: totals.manualDiscount, // what the clerk gave; the server adds the schemes' discount itself
        billingMode,
        amountPaid: parseFloat(amountPaid),
        remainingAmount: parseFloat(remainingAmount),
        // NEW fields
        retailerId: selectedRetailer ? parseInt(selectedRetailer) : null,
        paymentType: creditPaymentType,
        dueDate: dueDate || null,
        items: toItemPayload(lineItems, totals),
      }),
    })
      .then(safeJson)
      .then(json => {
        if (json?.status === 200 || json?.success) { toast.success("Sales updated"); onSubmit(); onClose(); }
        else toastApiError(json, "Update failed");
      })
      .catch((err) => toast.error(err?.message || "Network error. Please try again."));
  };

  const totalAmount = totals.gross + lineTaxTotal;

  /* ── RENDER ──
     Two views over the same three section fragments: "tabs" (default — one
     section on screen at a time, tab bar controls which) and "all" (every
     section rendered as its own titled panel, stacked top to bottom — the
     same pattern the dashboard uses to lay out its widgets, not a side-by-
     side split). Each fragment is built once and reused by whichever view
     is active, so the two can never drift apart. */
  const originalSection = originalItems.length === 0 ? (
    <div className="afx-items-empty">No existing items</div>
  ) : (
    <>
      <div className="afx-line-table afx-sale-lines">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Price (₹)</th>
              <th>Qty</th>
              <th>Amount excl. GST (₹)</th>
              <th>GST %</th>
              <th>GST (₹)</th>
              <th>Amount incl. GST (₹)</th>
            </tr>
          </thead>
          <tbody>
            {originalItems.map((it, i) => {
              const excl = Number(it.sellingPrice || 0) * Number(it.quantity || 0) - Number(it.discountAmount || 0);
              const gst = Number(it.taxAmount || 0);
              return (
                <tr key={i} data-testid="original-line">
                  <td>{i + 1}</td>
                  <td>
                    <div className="afx-line-name">{it.product}</div>
                    <div className="afx-line-meta">
                      {it.freeItem && <strong className="afx-text-success">FREE </strong>}
                      {it.schemeNameSnapshot && `${it.schemeNameSnapshot} `}
                      {it.batchNumberSnapshot && `· Batch ${it.batchNumberSnapshot} `}
                      {it.expiryDateSnapshot && `· Exp ${it.expiryDateSnapshot} `}
                      {it.hsnCodeSnapshot && `· HSN ${it.hsnCodeSnapshot}`}
                    </div>
                  </td>
                  <td>{Number(it.sellingPrice || 0).toFixed(2)}</td>
                  <td>{it.quantity}</td>
                  <td>{excl.toFixed(2)}</td>
                  <td>{excl > 0 ? Number(((gst / excl) * 100).toFixed(2)) : 0}%</td>
                  <td>{gst.toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: "var(--afx-text-1)" }}>{(excl + gst).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={4} style={{ textAlign: "right" }}>Original total</td>
              <td>{originalItems.reduce((s, i) => s + i.sellingPrice * i.quantity - (i.discountAmount || 0), 0).toFixed(2)}</td>
              <td></td>
              <td>{originalItems.reduce((s, i) => s + Number(i.taxAmount || 0), 0).toFixed(2)}</td>
              <td>{originalItems.reduce((s, i) => s + i.sellingPrice * i.quantity - (i.discountAmount || 0) + i.taxAmount, 0).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );

  const productSection = (
    <>
      <div className="afx-subpanel">
        <div className="afx-subpanel-header">Find Product</div>
        <div className="afx-subpanel-body">
          <form
            className="afx-scan-field"
            onSubmit={e => {
              e.preventDefault();
              const code = scanValue;
              setScanValue("");
              handleBarcodeScan(code);
              scanRef.current?.focus();
            }}
            title="Scan a barcode — selects the product type + product; you choose the quantity"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3v10M5 3v10M7.5 3v10M10 3v10M12.5 3v10M14 3v10" />
            </svg>
            <input
              ref={scanRef}
              type="text"
              placeholder="Scan or type barcode, then press Enter…"
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              autoComplete="off"
            />
          </form>

          <div className="afx-field">
            <label className="afx-label">Product Type <span style={{ fontWeight: 400, color: "var(--afx-text-3)" }}>(optional filter)</span></label>
            <div className="afx-chip-row">
              <button
                type="button"
                className={`afx-chip ${!selectedType ? "is-active" : ""}`}
                onClick={() => handleTypeChange({ target: { value: "" } })}
              >All</button>
              {productTypes.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`afx-chip ${String(selectedType) === String(t.id) ? "is-active" : ""}`}
                  onClick={() => handleTypeChange({ target: { value: t.id } })}
                >{t.name}</button>
              ))}
            </div>
            {errors.selectedType && <div className="afx-error">{errors.selectedType}</div>}
          </div>

          <SearchableDropdown label="Product" options={products} selectedId={selectedProduct}
            onSelect={id => handleProductChange({ target: { value: id } })}
            search={productSearch} setSearch={setProductSearch} open={productDropdownOpen} setOpen={setProductDropdownOpen}
            placeholder="Search product…" dropdownRef={productDropdownRef} error={errors.selectedProduct}
          />

          {/* Inventory info — price & stock are always read from product configuration,
              there is no manual/adhoc price entry here. */}
          {inventory ? (
            <div className="afx-card">
              <div className="afx-card-row"><span>Selling Price</span><strong>₹{inventory.unitSellingPrice}</strong></div>
              <div className="afx-card-row">
                <span>Current Stock</span>
                <strong className={outOfStock ? "afx-text-danger" : lowStock ? "" : "afx-text-success"} style={lowStock ? { color: "var(--afx-warning)" } : undefined}>
                  {inventory.currentQuantity}{outOfStock ? " · Out of stock" : lowStock ? " · Low stock" : ""}
                </strong>
              </div>
              {outOfStock && (
                <div className="afx-error">This product is out of stock and cannot be added. Add stock via Purchase first.</div>
              )}
            </div>
          ) : noPriceConfigured ? (
            <div className="afx-alert">Selling price is not configured for this product. Please set it up in Products first.</div>
          ) : null}

          {/* Batch selector */}
          {availableBatches.length > 0 && (
            <div className="afx-card">
              <div className="afx-section-title" style={{ padding: 0 }}>Batch Selection</div>
              <div className="afx-select-wrap">
                <select className="afx-select" value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}>
                  <option value="">Auto-select (FIFO — oldest expiry first)</option>
                  {availableBatches.map(b => (
                    <option key={b.batchId} value={b.batchId}>
                      {b.batchNumber} · Exp: {b.expiryDate} · Qty: {b.availableQuantity}
                      {b.expiryStatus === "EXPIRING_SOON" ? " (expiring soon)" : b.expiryStatus === "EXPIRED" ? " (expired)" : ""}
                    </option>
                  ))}
                </select>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="afx-subpanel">
        <div className="afx-subpanel-header">Quantity &amp; Tax</div>
        <div className="afx-subpanel-body">
          <div className="afx-grid">
            <div className="afx-field">
              <label className="afx-label">Quantity</label>
              <div className="afx-qty">
                <button type="button" className="afx-qty-btn" onClick={() => stepQuantity(-1)} disabled={outOfStock || (parseInt(quantity) || 0) <= 1}>−</button>
                <input
                  className={`afx-qty-input ${errors.quantity ? "afx-input--err" : ""}`}
                  style={errors.quantity ? { borderColor: "var(--afx-danger)" } : undefined}
                  type="number" value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="Enter qty"
                  disabled={outOfStock}
                />
                <button type="button" className="afx-qty-btn" onClick={() => stepQuantity(1)} disabled={outOfStock}>+</button>
              </div>
              {errors.quantity && <div className="afx-error">{errors.quantity}</div>}
            </div>
            <div className="afx-field">
              <label className="afx-label">GST {taxType === "PERCENT" ? "Rate (%)" : "Amount (₹)"}</label>
              <div style={{ display: "flex", gap: 8 }}>
                {taxType === "PERCENT" ? (
                  <div className="afx-select-wrap" style={{ flex: 1 }}>
                    <select className="afx-select" value={taxInput} onChange={e => setTaxInput(e.target.value)}>
                      <option value="">Select GST rate</option>
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%{r === 18 ? " (Standard)" : r === 0 ? " (Exempt)" : ""}</option>)}
                    </select>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                ) : (
                  <input className="afx-input" type="number" value={taxInput} onChange={e => setTaxInput(e.target.value)} placeholder="GST amount (₹)" style={{ flex: 1 }} />
                )}
                <select className="afx-select" value={taxType} onChange={e => setTaxType(e.target.value)} style={{ width: 90, flexShrink: 0 }}>
                  <option value="PERCENT">% Rate</option>
                  <option value="FLAT">₹ Flat</option>
                </select>
              </div>
              {errors.taxInput && <div className="afx-error">{errors.taxInput}</div>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="afx-btn" onClick={clearForm}>Clear All</button>
            <button type="button" className="afx-btn afx-btn--primary" onClick={addOrUpdateItem} disabled={outOfStock || noPriceConfigured}>
              {editIndex !== null ? "Update Item" : "+ Add Item"}
            </button>
          </div>
          {errors.lineItems && <div className="afx-error">{errors.lineItems}</div>}
        </div>
      </div>

      <div className="afx-subpanel">
        <div className="afx-subpanel-header">Line Items</div>
        <div className="afx-subpanel-body">
          {lineItems.length === 0 ? (
            <div className="afx-items-empty">No items yet</div>
          ) : (
            <>
              <div className="afx-line-table afx-sale-lines">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Price (₹)</th>
                      <th>Qty</th>
                      <th>Amount excl. GST (₹)</th>
                      <th>GST %</th>
                      <th>GST (₹)</th>
                      <th>Amount incl. GST (₹)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="afx-line-list">
                    {lineItems.map((it, i) => {
                      // per product: value before GST (after any scheme), the GST % and amount on it, and the two together
                      const row = totals.lines[i] || { post: 0, rate: 0 };
                      const excl = row.post;
                      const gst = row.post * row.rate;
                      return (
                        <tr key={i} className="afx-line-row" data-testid="sale-line">
                          <td>{i + 1}</td>
                          <td>
                            <div className="afx-line-name">{it.productName}</div>
                            <div className="afx-line-meta">
                              {it.freeQuantity > 0 && <strong className="afx-text-success">{freeText(it)} </strong>}
                              {it.batchNumber && it.batchNumber !== "AUTO" && `Batch ${it.batchNumber} `}
                              {it.expiryDate && `· Exp ${it.expiryDate}`}
                            </div>
                            {it.schemeId && (
                              <span className="afx-line-meta" data-testid="line-scheme">
                                Scheme: {it.schemeName}{it.schemeDiscount > 0 && ` · −₹${it.schemeDiscount.toFixed(2)}`}
                                {" "}<button type="button" className="afx-link-btn" onClick={() => dropScheme(i)}>Remove</button>
                              </span>
                            )}
                            {!it.schemeId && it.schemeOff && (
                              <span className="afx-line-meta">
                                No scheme <button type="button" className="afx-link-btn" onClick={() => retryScheme(i)}>Apply scheme</button>
                              </span>
                            )}
                          </td>
                          <td data-testid="line-price">{Number(it.sellingPrice || 0).toFixed(2)}</td>
                          <td data-testid="line-qty">{it.quantity}</td>
                          <td data-testid="line-excl">{excl.toFixed(2)}</td>
                          <td data-testid="line-rate">{Number((row.rate * 100).toFixed(2))}%</td>
                          <td data-testid="line-gst">{gst.toFixed(2)}</td>
                          <td data-testid="line-incl" style={{ fontWeight: 700, color: "var(--afx-text-1)" }}>{(excl + gst).toFixed(2)}</td>
                          <td>
                            <div className="afx-line-actions">
                              <button type="button" className="afx-icon-btn" onClick={() => editItem(i)} title="Edit">
                                <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/></svg>
                              </button>
                              <button type="button" className="afx-remove-btn" onClick={() => deleteItem(i)} title="Delete">
                                <svg width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360Z"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={4} style={{ textAlign: "right" }}>Total ({lineItems.length} item{lineItems.length === 1 ? "" : "s"})</td>
                      <td data-testid="sum-excl">{lineItems.reduce((s, _, k) => s + (totals.lines[k]?.post || 0), 0).toFixed(2)}</td>
                      <td></td>
                      <td data-testid="sum-gst">{lineItems.reduce((s, _, k) => s + (totals.lines[k] ? totals.lines[k].post * totals.lines[k].rate : 0), 0).toFixed(2)}</td>
                      <td data-testid="sum-incl" style={{ color: "var(--afx-text-1)" }}>{lineItems.reduce((s, _, k) => s + (totals.lines[k] ? totals.lines[k].post * (1 + totals.lines[k].rate) : 0), 0).toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {totals.manualDiscount > 0 && (
                <div className="afx-totals" style={{ marginTop: 10 }}>
                  <div className="afx-totals-row"><span>Invoice discount</span><span className="afx-text-danger">−₹{totals.manualDiscount.toFixed(2)}</span></div>
                  <div className="afx-totals-row"><span>Amount excl. GST after discount</span><span>₹{totals.taxable.toFixed(2)}</span></div>
                  <div className="afx-totals-row"><span>GST after discount</span><span>₹{totals.tax.toFixed(2)}</span></div>
                  <div className="afx-totals-row afx-totals-grand"><span>Net payable (incl. GST)</span><span data-testid="net-payable">₹{totals.net.toFixed(2)}</span></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  const billingSection = (
    <>
                  <SearchableDropdown
                    label="Retailer (optional)"
                    options={retailers} selectedId={selectedRetailer}
                    onSelect={id => { retailerTouched.current = true; setSelectedRetailer(id); }}
                    search={retailerSearch} setSearch={setRetailerSearch}
                    open={retailerDropdownOpen} setOpen={setRetailerDropdownOpen}
                    placeholder="Search retailer…" dropdownRef={retailerDropdownRef}
                    error={errors.retailerId}
                  />

                  <div className="afx-field">
                    <label className="afx-label">Discount</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="afx-input" type="number" value={discountInput} onChange={e => setDiscountInput(e.target.value)} placeholder="0" />
                      <select className="afx-select" style={{ width: 80, flexShrink: 0 }} value={discountType} onChange={e => setDiscountType(e.target.value)}>
                        <option value="FLAT">₹</option>
                        <option value="PERCENT">%</option>
                      </select>
                    </div>
                    {errors.discountInput && <div className="afx-error">{errors.discountInput}</div>}
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Billing Mode</label>
                    <div className="afx-seg-row">
                      {[["CASH", "Cash"], ["ONLINE", "Online / UPI"], ["CARD", "Card"]].map(([val, lbl]) => (
                        <button
                          key={val} type="button"
                          className={`afx-seg-btn ${billingMode === val ? "is-active" : ""}`}
                          onClick={() => setBillingMode(val)}
                        >{lbl}</button>
                      ))}
                    </div>
                    {errors.billingMode && <div className="afx-error">{errors.billingMode}</div>}
                  </div>

                  {/* ── Totals breakdown: Subtotal → Discount → Taxable Value → GST → Net Amount ── */}
                  <div className="afx-totals">
                    <div className="afx-totals-row"><span>Subtotal</span><span style={{ color: "var(--afx-text-1)" }}>₹{lineSubtotal.toFixed(2)}</span></div>
                    {schemeDiscAmt > 0 && (
                      <div className="afx-totals-row"><span>Scheme discount</span><span className="afx-text-danger">−₹{schemeDiscAmt.toFixed(2)}</span></div>
                    )}
                    {discAmt > 0 && (
                      <div className="afx-totals-row"><span>Discount</span><span className="afx-text-danger">−₹{discAmt.toFixed(2)}</span></div>
                    )}
                    {totals.freeUnits > 0 && (
                      <div className="afx-totals-row"><span>Free units (stock reduced, not charged)</span><span className="afx-text-success">{totals.freeUnits}</span></div>
                    )}
                    <div className="afx-totals-row"><span>Taxable Value</span><span style={{ color: "var(--afx-text-1)" }}>₹{taxableValue.toFixed(2)}</span></div>
                    <div className="afx-totals-row"><span>GST</span><span style={{ color: "var(--afx-text-1)" }}>₹{lineTaxTotal.toFixed(2)}</span></div>
                    <div className="afx-totals-divider" />
                    <div className="afx-totals-row afx-totals-grand"><span>Net Amount</span><span>₹{netAmount.toFixed(2)}</span></div>
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Payment Type</label>
                    <div className="afx-pay-tile-row">
                      {PAYMENT_TYPES.map(({ id, label, sub }) => (
                        <button
                          key={id} type="button"
                          className={`afx-pay-tile ${creditPaymentType === id ? "is-active" : ""}`}
                          onClick={() => setCreditPaymentType(id)}
                        >
                          <span className="afx-pay-tile-icon">{PAYMENT_ICONS[id]}</span>
                          <span className="afx-pay-tile-text">
                            <span className="afx-pay-tile-label">{label}</span>
                            <span className="afx-pay-tile-sub">{sub}</span>
                          </span>
                          {creditPaymentType === id && (
                            <span className="afx-pay-tile-check">
                              <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.2 2.2L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(creditPaymentType === "CREDIT" || creditPaymentType === "PARTIAL") && (
                    <div className="afx-field">
                      <label className="afx-label">Due Date</label>
                      <input className="afx-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                      {errors.dueDate && <div className="afx-error">{errors.dueDate}</div>}
                    </div>
                  )}

                  <div className="afx-field">
                    <label className="afx-label">Amount Paid (₹)</label>
                    <input
                      className="afx-input"
                      type="number" value={amountPaid}
                      onChange={e => setAmountPaid(e.target.value)}
                      disabled={creditPaymentType === "PAID" || creditPaymentType === "CREDIT"}
                      placeholder="0.00"
                    />
                    {errors.amountPaid && <div className="afx-error">{errors.amountPaid}</div>}
                  </div>

      <div className="afx-totals">
        <div className="afx-totals-row afx-totals-grand">
          <span>Due Amount</span>
          <span className="afx-text-danger">₹{parseFloat(remainingAmount || 0).toFixed(2)}</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="afx-backdrop afx-backdrop--full">
      <div className="afx-modal afx-modal--full">
        {initialLoading ? (
          <div className="afx-loading">
            <div className="afx-loader-ring"><div/><div/><div/></div>
          </div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Edit Transaction</div>
                <h3 className="afx-title">Edit Sale{invoiceNumber && ` · ${invoiceNumber}`}</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {viewMode === "tabs" && (
                  <div className="afx-tabs" style={{ padding: 0, background: "none", border: "none" }}>
                    {["Existing", "Product", "Billing"].map(tab => (
                      <button type="button" key={tab} className={`afx-tab ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>
                        {tab === "Existing" ? "Original Items" : tab}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className={`afx-toggle ${viewMode === "all" ? "is-on" : ""}`}
                  onClick={() => setViewMode(v => v === "all" ? "tabs" : "all")}
                  title="Show every section at once, instead of one tab at a time"
                >
                  <span className="afx-toggle-label">All sections</span>
                  <span className="afx-toggle-track" />
                </button>
                <button className="afx-close" onClick={onClose} title="Close">
                  <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  ESC
                </button>
              </div>
            </div>

            <div className="afx-body">
              {viewMode === "all" ? (
                <div className="afx-stack">
                  <div className="afx-panel">
                    <div className="afx-panel-header">
                      <span className="afx-panel-title">Original Items</span>
                      <span className="afx-panel-count">{originalItems.length} item{originalItems.length !== 1 ? "s" : ""}</span>
                    </div>
                    {originalSection}
                  </div>
                  <div className="afx-panel">
                    <div className="afx-panel-header">
                      <span className="afx-panel-title">Products</span>
                      <span className="afx-panel-count">{lineItems.length} item{lineItems.length !== 1 ? "s" : ""}</span>
                    </div>
                    {productSection}
                  </div>
                  <div className="afx-panel">
                    <div className="afx-panel-header">
                      <span className="afx-panel-title">Billing &amp; Payment</span>
                    </div>
                    {billingSection}
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === "Existing" && originalSection}
                  {activeTab === "Product" && productSection}
                  {activeTab === "Billing" && billingSection}
                </>
              )}
            </div>

            <div className="afx-footer">
              <button className="afx-btn" type="button" onClick={onClose}>Cancel</button>
              <button className="afx-btn afx-btn--primary" type="button" onClick={updateSale}>Update Sale</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

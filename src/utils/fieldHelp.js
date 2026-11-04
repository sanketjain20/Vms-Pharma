// What a field on an Add / Edit / View screen means, in the shop's words — shown by the ⓘ next to its label
// (CommonComponent/FieldHelpLayer). Keyed by the label as it reads on screen; plain fields (name, phone, address…) have
// none. Where one label means different things on different screens, ROUTE_HELP gives that screen its own text.

/** The label as a key: lower case, without "*", ":", "(₹)", "₹", "(optional)" and extra spaces. */
export function helpKey(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/\(optional[^)]*\)/g, "")
    .replace(/\(₹[^)]*\)|\(%\)|₹|[*:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NO_LIMIT_NOTE = "0 = no limit.";

const HELP = {
  // ── parties: retailer, supplier, manufacturer ──
  "gst number": "The party's 15-character GST registration number (GSTIN). Needed for B2B bills, e-invoices and GST returns — leave blank if they are not registered.",
  "gstin": "Your 15-character GST registration number. It is printed on every invoice and used for e-invoices and GST returns.",
  "pan": "The party's 10-character PAN. TDS / TCS is worked out at the normal rate only when a PAN is on file — without it a higher rate applies.",
  "drug license number": "Licence to stock and sell medicines, printed on invoices. Pharmacies only.",
  "drug license no": "Licence to stock and sell medicines, printed on invoices. Pharmacies only.",
  "credit limit": `The most this retailer may owe you at any time. A credit bill that would take them over it is stopped — going over needs the "Exceed Credit Limit" permission and a reason. ${NO_LIMIT_NOTE}`,
  "outstanding balance": "What is owed right now across all unpaid bills — by the retailer to you, or by you to the supplier. It changes by itself with bills and payments.",
  "outstanding": "What is owed right now across all unpaid bills. It changes by itself with bills and payments.",
  "advance balance": "Money received (or paid) before any bill, not yet set against one. It is used up by the next bills.",
  "lead time": "How many days this supplier usually takes to deliver — used to remind you to reorder in time.",
  "lead time (days)": "How many days this supplier usually takes to deliver — used to remind you to reorder in time.",
  "country": "Leave blank for India. Another country marks the party as foreign (no Indian GST on exports).",
  "non-resident / export party": "Tick for a party outside India or an export sale. No TDS / TCS is deducted for them.",
  "non-resident / export party (no tcs collected)": "Tick for a party outside India or an export sale. No TCS is collected from them.",
  "non-resident / export party (no tds deducted)": "Tick for a party outside India or an export purchase. No TDS is deducted on payments to them.",
  "buyer deducts tds (194q)": "Tick if this retailer's turnover is over ₹10 crore and they deduct 0.1% TDS (section 194Q) when paying you, so their payments reconcile.",
  "buyer deducts tds under section 194q on payments to us (tracked for reconciliation — tcs no longer applies)":
    "Tick if this retailer's turnover is over ₹10 crore and they deduct 0.1% TDS (section 194Q) when paying you, so their payments reconcile.",
  "lower/nil deduction certificate no.": "Certificate from the Income Tax department that lets this party have TDS / TCS at a lower or nil rate. It applies only between its valid dates.",
  "lower/nil deduction certificate": "Certificate from the Income Tax department that lets this party have TDS / TCS at a lower or nil rate. It applies only between its valid dates.",
  "certificate section": "The Income-tax section the certificate is for, e.g. 197 (TDS) or 206C(9) (TCS).",
  "certificate rate": "The lower rate the certificate allows. 0 = nil deduction.",
  "certificate valid from": "The certificate's lower rate applies from this date.",
  "certificate valid to": "The certificate's lower rate applies until this date; after it the normal rate is back.",

  // ── products ──
  "hsn code": "The product's GST tariff code. It decides the GST rate, is printed on invoices and goes into GSTR-1. A GST-registered shop must fill it.",
  "gst rate": "The GST charged when this product is sold (0, 0.25, 3, 5, 12, 18, 28 or 40%). Bills use it unless someone with permission overrides it on a line.",
  "gst rate %": "The GST % on this line of the order.",
  "gst %": "The GST % on this line.",
  "selling price": "What the customer pays for one unit. With \"price includes GST\" on, this is the tag / MRP price and GST is worked out of it.",
  "mrp": "Maximum Retail Price printed on the pack. Nothing can be billed above it.",
  "average cost (from purchases)": "Average purchase cost of the stock you hold now, worked out by itself from your purchases. Used for profit and stock value — it is never typed.",
  "average cost": "Average purchase cost of the stock on hand, worked out by itself from your purchases. Used for profit and stock value — it is never typed.",
  "generic / salt name": "The medicine's chemical name, e.g. Paracetamol — helps find substitutes.",
  "schedule type": "Drug schedule: OTC (no prescription), H (prescription), H1 (strict prescription, register kept), Narcotic (controlled).",
  "pack size": "How many units come in one pack, e.g. 10 tablets in a strip.",
  "pack unit": "What one unit of the pack is, e.g. tablet, ml, capsule.",
  "barcode": "The code printed on the pack. Scanning it on a bill adds this product.",
  "serial numbers / imei": "Tick for goods sold unit by unit (phones, laptops). Every unit's serial number / IMEI is recorded when bought and when sold, for warranty and tracing.",
  "warranty (months)": "How long the warranty runs from the date of sale; shown on the bill and in Serial Lookup.",
  "sizes & colours": "For clothing and similar: one style in several sizes and colours. Each size × colour is its own product with its own stock.",
  "style selling price": "The price for every size and colour of this style; a variant can be given its own price.",
  "reorder level": "When stock falls to this many units the product shows in Reorder Alerts.",
  "product type": "The group this product belongs to (e.g. Tablets, Shirts). Used to filter and report.",

  // ── purchases and stock ──
  "batch no": "The batch code printed on the pack. Leave it blank and VMS makes one; a number already used in another purchase is refused.",
  "expiry date": "When this batch expires. The batch that expires first is sold first, and Expiry Alerts warn you before it does.",
  "mfg date": "When the batch was made (optional).",
  "cost": "What you pay the supplier for one unit, before GST.",
  "free": "Units the supplier gives free (a scheme). They add to stock at zero cost.",
  "free quantity": "Units the supplier gives free (a scheme). They add to stock at zero cost.",
  "supplier invoice no": "The bill number printed on the supplier's invoice — used to match your purchases with GSTR-2B.",
  "invoice date": "The date printed on the supplier's invoice.",
  "payment status": "Paid, Partial or Unpaid: what you still owe the supplier on this purchase.",
  "remaining amount": "What is still to be paid on this bill.",
  "adjustment type": "Why stock changes outside a sale or purchase: damage, breakage, a sample, a count correction or an opening-stock correction.",
  "inventory code": "Internal code of this product's stock in this godown.",
  "stock before": "Units in stock before this adjustment.",
  "stock after": "Units in stock after this adjustment.",
  "available quantity": "Units you can sell now (in stock, not reserved or in transit).",
  "current stock value": "Units in stock × their average cost.",
  "total stock value": "Units in stock × their average cost.",
  "from godown": "Where the stock leaves from. It leaves only when the transfer is dispatched.",
  "to godown": "Where the stock arrives. It is added only when the transfer is received.",
  "expected arrival": "When you expect the goods — for planning only, it moves no stock.",
  "expected date": "When you expect the goods — for planning only.",
  "default godown": "The godown picked automatically when you sign in.",

  // ── bills ──
  "payment type": "Paid: settled now. Credit: all due later (needs a due date). Partial: part now, the rest later.",
  "billing mode": "How the bill was paid: Cash, UPI, Card — or Split when paid in more than one way.",
  "due date": "When the unpaid amount should be paid. After it the bill shows as overdue.",
  "gst mode": "Product-wise: each product at its own GST rate. Common GST: one rate for products that have no rate yet (those lines are flagged).",
  "common gst rate": "Used only for products that have no GST rate yet; those lines are flagged so you can fix the product.",
  "bill discount": "A discount on the whole bill (% or ₹), taken off before GST.",
  "invoice discount": "A discount on the whole bill, taken off before GST.",
  "payment (split across cash / upi / card)": "Add a row for each way the customer pays, e.g. ₹500 cash + ₹300 UPI. For a bill paid in full the last row fills in the rest.",
  "payment": "How the customer pays now. Add a row for each mode if they split it.",
  "ref / txn no.": "UPI transaction ID, card slip or cheque number — helps you match the bank statement.",
  "reference no": "UPI transaction ID, card slip or cheque number — helps you match the bank statement.",
  "amount received": "Money taken now against what is still due on this bill.",
  "retailer": "Leave empty for a walk-in customer. A retailer's unpaid bills go to their ledger and count against their credit limit.",
  "apply schemes automatically": "Pick the best scheme for each line by itself.",
  "auto-apply schemes": "Pick the best scheme for each line by itself.",
  "link to specific invoice": "Pick a bill to settle with this payment; otherwise the oldest unpaid bills are settled first.",
  "link to specific purchase invoice": "Pick a purchase to settle with this payment; otherwise the oldest unpaid purchases are settled first.",
  "retailer's advance balance after": "Anything paid beyond what they owe is kept as their advance and used on their next bills.",
  "supplier's advance balance after": "Anything paid beyond what you owe is kept as an advance with the supplier.",
  "e-invoice (irn)": "The government's invoice reference number (IRN) for a B2B bill. Once generated, the bill can't be cancelled until the IRN is cancelled.",
  "e-way bill": "Needed to move goods worth over ₹50,000; generated from the bill.",

  // ── returns ──
  "return reason": "Why the goods came back, e.g. damaged, expired, wrong item — kept on the return.",
  "original invoice": "The bill the goods were sold on. Only its items can be returned, at the price they were billed.",
  "original purchase": "The purchase the goods came in on. Only its items can be returned.",

  // ── orders and challans ──
  "purpose": "Why the goods go out: a sale to be invoiced later, a sample, on approval, job work…",
  "terms": "Delivery or payment terms printed on the document.",

  // ── schemes ──
  "buy (quantity)": "How many units the customer must buy to get the offer.",
  "get free (quantity)": "How many units the customer then gets free.",
  "buy (units)": "How many units you must buy from the supplier to get the free goods.",
  "get free (units)": "How many units the supplier then gives free.",
  "discount %": "The percentage taken off the line's value.",
  "repeats": "On: buying twice the quantity gives twice the offer. Off: the offer applies once per line.",
  "minimum quantity": "The offer applies only when at least this many units are on the line.",

  // ── settings and the shop ──
  "business type": "The kind of shop (pharmacy, grocery, clothing, electronics, general). It decides which fields VMS shows, e.g. drug schedules only for a pharmacy.",
  "expiry dates": "Turn off if your goods don't expire: then no expiry dates are asked for or shown anywhere.",
  "master vendor": "The main account this user belongs to; sub-users work in its data.",
  "account validity till": "The date this account stays active until.",
  "role": "Decides which modules and actions this user can use.",
  "round bill totals to the rupee": "Bill totals are rounded to the nearest rupee with a \"Round off\" line; GST and taxable values don't change.",
  "allow custom items on bills": "Lets cashiers bill something that is not a product (a service, a one-off item) with its own name, HSN and GST.",
  "threshold amount":"TDS / TCS starts only once a party's total in the financial year crosses this amount.",
  "section code": "The Income-tax section this TDS / TCS falls under, e.g. 194Q.",
  "late deposit interest (%/month)": "Interest owed per month if the TDS is not deposited by its due date.",

};

/** A screen's own meaning for a label that means something else elsewhere (longest matching route wins). */
const ROUTE_HELP = {
  "/master/scheme": {
    "free quantity": "Units the customer gets free with the offer.",
    "retailer": "Leave empty for the offer to apply to every customer; pick one to give it only to them.",
  },
  "/master/sales-return": {
    "refund mode": "Cash or Bank pays the money back to the customer; Credit Note keeps it against what they owe you.",
  },
  "/master/purchase-return": {
    "refund mode": "Debit Note takes it off what you owe the supplier; Cash or Bank means the supplier pays you back.",
  },
  "/master/accounting": {
    "money": "In (credit) = money came into the bank; Out (debit) = money went out — as on the statement.",
    "amount": "The amount as printed on the bank statement line. It is matched with a receipt or payment of the same amount.",
    "reference / utr": "The UTR / cheque number as printed on the bank statement — it helps find the matching payment.",
  },
  "/master/delivery-challan": {
    "retailer": "Who the goods are sent to.",
  },
  "/master/sales-order": {
    "retailer": "Who the order is for. Its unpaid part counts against their credit limit when it becomes a bill.",
  },
};

/** The help for a label on the screen at this address, or null when the field needs none. */
export function helpFor(label, pathname = "") {
  const key = helpKey(label);
  if (!key) return null;
  const route = Object.keys(ROUTE_HELP)
    .filter((r) => String(pathname).startsWith(r))
    .sort((a, b) => b.length - a.length)[0];
  if (route && ROUTE_HELP[route][key]) return ROUTE_HELP[route][key];
  return HELP[key] || null;
}

export const HELP_KEYS = Object.keys(HELP);

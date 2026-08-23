import React, { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../Styles/VmsAssistant.css";

/* ══════════════════════════════════════════════════════════════
   KNOWLEDGE BASE — one entry per real module/topic in VMS.
   Kept accurate to the actual flows (GST modes, payment types,
   FIFO batch selection, etc.) rather than generic filler, so the
   assistant's answers hold up to a follow-up question.
   ══════════════════════════════════════════════════════════════ */
const moduleHelp = {
  overview: {
    title: "VMS flow",
    keywords: ["flow", "start", "overview", "how", "process", "work", "vms", "getting started"],
    answer:
      "Start with onboarding and master data: manufacturer, product type, product, retailer, and supplier. Then record purchases to bring in stock and create batches. Sell through Sales or Quick Sale. Returns, payments, outstanding ledgers, alerts, reports, and the dashboard all build on top of those transactions automatically.",
    steps: [
      "Complete onboarding and account settings.",
      "Create master data: manufacturer → product type → product → retailer → supplier.",
      "Record purchases — this creates inventory batches with expiry and cost.",
      "Sell with Sales (full flow) or Quick Sale (fast counter billing).",
      "Handle sales/purchase returns and collect or make payments as needed.",
      "Keep an eye on outstanding ledgers, expiry/reorder alerts, reports, and the dashboard.",
    ],
  },
  onboarding: {
    title: "Onboarding",
    keywords: ["onboarding", "setup", "initial", "first time", "getting started"],
    answer:
      "Onboarding is the guided first-run screen — it lays out master data in the order you actually need it and links straight to each module. Finish manufacturer, product type, product, retailer, and supplier before you try to record a purchase or a sale; both of those need products and parties to already exist.",
  },
  settings: {
    title: "Account settings",
    keywords: ["setting", "settings", "profile", "password", "change password", "shop name", "photo", "avatar", "theme", "dark mode", "light mode"],
    answer:
      "Settings has three tabs: Profile (shop name and photo — save only enables once something actually changed), Password (current/new/confirm with a strength meter), and Security (active sessions and account-level danger actions). The theme toggle for dark/light mode lives in the top navbar, not in Settings, and applies across the whole app immediately.",
  },
  product: {
    title: "Product",
    keywords: ["product", "medicine", "item", "hsn", "schedule", "generic name", "pack size"],
    answer:
      "Product stores the medicine/item catalogue — manufacturer, product type, generic name, HSN code, drug schedule, unit, pack size, and pricing. Create the manufacturer and product type first so they're available in the product form's dropdowns. A product must exist before it can appear in a purchase or a sale.",
  },
  productType: {
    title: "Product Type",
    keywords: ["product type", "type", "category", "tablet", "syrup", "injection"],
    answer:
      "Product Type is a simple category label — Tablet, Syrup, Injection, and so on. Create these before adding products so products can be grouped and filtered cleanly in inventory, purchase, and sales screens.",
  },
  manufacturer: {
    title: "Manufacturer",
    keywords: ["manufacturer", "company", "mfg", "brand"],
    answer:
      "Manufacturer stores the companies whose products you stock. Add manufacturers first — they're a required field on every product, so they need to exist before you create products.",
  },
  retailer: {
    title: "Retailer",
    keywords: ["retailer", "customer", "chemist", "buyer", "credit limit", "drug license", "gstin"],
    answer:
      "Retailer stores your customer pharmacies — name, credit limit, GSTIN, drug license, and contact details. Select a retailer during a sale to bill against a tracked account; walk-in/cash sales don't strictly need one, but you lose ledger history without it.",
  },
  supplier: {
    title: "Supplier",
    keywords: ["supplier", "vendor", "purchase party", "distributor"],
    answer:
      "Supplier stores who you buy stock from. Select a supplier on every purchase entry — that's what drives supplier outstanding and supplier payment tracking.",
  },
  purchase: {
    title: "Purchase",
    keywords: ["purchase", "buy", "stock in", "batch", "expiry", "mrp", "cost price"],
    answer:
      "Purchase records incoming stock: supplier, product, batch number, expiry date, quantity, cost price, selling price, and GST. Every purchase line becomes a distinct batch — that batch-level detail is what makes expiry tracking and FIFO selling possible later, so get the expiry date right at entry time.",
  },
  inventory: {
    title: "Inventory",
    keywords: ["inventory", "stock", "quantity", "batch", "reorder level", "stock value"],
    answer:
      "Inventory shows live stock — quantity on hand, reorder level, cost/selling price, and batch-wise breakdown. Purchases increase it, sales and stock adjustments change it, and the expiry/reorder alerts read directly from it.",
  },
  batch: {
    title: "Batches",
    keywords: ["batch", "batch number", "batch tracking", "traceability"],
    answer:
      "Batches let you see quantity and expiry per batch rather than just a single stock total for a product. Every purchase line creates one. Use this view for expiry checks and to trace exactly which incoming lot a sale was fulfilled from.",
  },
  stockAdjustment: {
    title: "Stock Adjustment",
    keywords: ["stock adjustment", "adjust stock", "damage", "correction", "write off"],
    answer:
      "Stock Adjustment corrects inventory outside the normal purchase/sale flow — damage, expiry write-offs, or a physical count that doesn't match the system. Use it sparingly and only when stock genuinely needs a manual fix, since it doesn't create a supplier or retailer transaction.",
  },
  alerts: {
    title: "Expiry & reorder alerts",
    keywords: ["alert", "expiry", "reorder", "low stock", "near expiry"],
    answer:
      "Alerts surface two things automatically from inventory data: batches approaching their expiry date, and products that have dropped below their reorder level. Check this regularly — it's the earliest warning for both wastage and stock-outs.",
  },
  sales: {
    title: "Sales",
    keywords: ["sales", "sale", "invoice", "billing", "gst", "new sale", "discount"],
    answer:
      "Sales is the full invoicing flow: pick products (batches are auto-selected FIFO — oldest expiry first), choose a GST mode (Exclusive adds tax on top, Inclusive treats the entered price as tax-included), apply a discount, pick the retailer and billing mode, then settle as Paid, Credit, or Partial. Paid closes the invoice immediately; Credit or Partial creates a retailer outstanding balance with a due date.",
  },
  quickSale: {
    title: "Quick Sale",
    keywords: ["quick sale", "fast billing", "counter sale", "quick", "quicksale"],
    answer:
      "Quick Sale is the same billing engine as Sales, trimmed down for fast counter transactions — fewer steps, same FIFO batch selection and GST handling underneath. Use full Sales when you need finer control (e.g. picking a specific batch manually or a more detailed billing mode); use Quick Sale when speed matters most.",
  },
  salesReturn: {
    title: "Sales Return",
    keywords: ["sales return", "return sale", "customer return"],
    answer:
      "Sales Return reverses items from a previously issued invoice — it puts the returned quantity back into inventory and adjusts that invoice's history, so stock and retailer balances stay accurate.",
  },
  purchaseReturn: {
    title: "Purchase Return",
    keywords: ["purchase return", "return purchase", "supplier return", "damaged stock"],
    answer:
      "Purchase Return sends stock back to a supplier — for damaged, expired, or incorrectly received goods. It reduces inventory for that batch and adjusts what you owe the supplier.",
  },
  paymentCollection: {
    title: "Payment Collection",
    keywords: ["payment collection", "collect payment", "receive payment", "retailer payment"],
    answer:
      "Payment Collection records money coming in from a retailer — cash, UPI, card, cheque, or bank transfer — against their outstanding balance. This is what clears a Credit or Partial sale.",
  },
  supplierPayment: {
    title: "Supplier Payment",
    keywords: ["supplier payment", "make payment", "pay supplier"],
    answer:
      "Supplier Payment records money you've paid out against a supplier's purchase dues. Use it whenever you settle an invoice or make a partial payment — it keeps supplier outstanding accurate.",
  },
  retailerOutstanding: {
    title: "Retailer Outstanding",
    keywords: ["retailer outstanding", "customer outstanding", "ledger", "collect", "due", "credit"],
    answer:
      "Retailer Outstanding lists every unpaid, Credit, or Partial invoice by retailer, with a full ledger history. Use Collect Payment from here to settle a due amount directly.",
  },
  supplierOutstanding: {
    title: "Supplier Outstanding",
    keywords: ["supplier outstanding", "amount payable", "purchase dues"],
    answer:
      "Supplier Outstanding shows what you owe each supplier from purchase entries. Use it to plan and track supplier payments before they're overdue.",
  },
  paymentHistory: {
    title: "Payment History",
    keywords: ["payment history", "past payments", "transaction history"],
    answer:
      "Payment History is the record of collections already made — a reconciliation view so you can confirm a payment went through and see its status without digging through individual invoices.",
  },
  reports: {
    title: "Reports",
    keywords: ["report", "gstr", "gst report", "profit", "loss", "expiry report"],
    answer:
      "Reports generates business summaries — GST/GSTR filings, sales and purchase summaries, stock valuation, profit & loss, and expiry breakdowns — pulled from whatever transactions exist so far.",
  },
  dashboard: {
    title: "Dashboard",
    keywords: ["dashboard", "chart", "summary", "home", "kpi"],
    answer:
      "Dashboard is the daily-driver view — sales, purchases, inventory health, outstanding balances, and alerts in one screen. Good habit: start each day here before diving into a specific module.",
  },
  bulkUpload: {
    title: "Bulk Upload",
    keywords: ["bulk upload", "import", "csv", "excel upload", "mass upload"],
    answer:
      "Bulk Upload loads master data or transactions from a file instead of entering records one at a time — useful when you're migrating an existing product list or a large batch of historical data.",
  },
  jobScheduler: {
    title: "Job Scheduler",
    keywords: ["job scheduler", "scheduled job", "background job", "automation"],
    answer:
      "Job Scheduler shows background/automated jobs the system runs — check it if you need to confirm a scheduled task ran, or to review recent job status.",
  },
  roles: {
    title: "Roles & permissions",
    keywords: ["role", "permission", "access", "module guard", "user access"],
    answer:
      "Roles control which modules and actions each user can reach. Set these up deliberately — a user only sees the workflows their role grants, so under-provisioning blocks work and over-provisioning is a security risk.",
  },
};

/* Task-style questions that don't map to a single module. */
const howTo = {
  fifo: {
    title: "How batch selection works",
    keywords: ["fifo", "which batch", "batch selection", "auto select batch", "oldest batch"],
    answer:
      "Sales and Quick Sale auto-select batches using FIFO — first in, first out. The batch with the earliest expiry date is sold first, so you're not left holding older stock while newer stock sells. You can still override this and pick a specific batch manually in the full Sales flow.",
  },
  gstModes: {
    title: "GST modes explained",
    keywords: ["gst mode", "inclusive", "exclusive", "tax on top", "gst inclusive"],
    answer:
      "Exclusive GST adds tax on top of the entered price (price + GST = total). Inclusive GST treats the entered price as already including tax, and backs the GST amount out of it. Pick whichever matches how the price was quoted to you.",
  },
  paymentTypes: {
    title: "Paid vs Credit vs Partial",
    keywords: ["paid credit partial", "payment type", "credit payment", "partial payment", "due date"],
    answer:
      "Paid settles the invoice in full immediately — no outstanding created. Credit records the full amount as owed, due on a date you set. Partial records part of the amount as paid now and the rest as outstanding with a due date. Credit and Partial both show up in Retailer Outstanding until collected.",
  },
  resetPassword: {
    title: "Resetting a password",
    keywords: ["reset password", "forgot password", "change password", "can't login"],
    answer:
      "From the login screen, use \"Forgot password?\" — it emails a 6-digit verification code, then lets you set a new password. To change your password while already signed in, use Settings → Password instead.",
  },
  shortcuts: {
    title: "Keyboard shortcuts",
    keywords: ["shortcut", "keyboard shortcut", "hotkey", "f1"],
    answer:
      "Press F1 anywhere in the app to open the full keyboard shortcuts reference — it covers every Ctrl, Alt, and function-key binding, with a live keyboard preview that lights up as you browse.",
  },
};

const knowledgeBase = { ...moduleHelp, ...howTo };

const quickActions = [
  "How does VMS flow work?",
  "How to create a sale?",
  "What should I add before purchase?",
  "Paid vs Credit vs Partial?",
  "How does FIFO batch selection work?",
];

const routeHints = [
  { match: "/onboarding", key: "onboarding" },
  { match: "/setting", key: "settings" },
  { match: "/master/product-type", key: "productType" },
  { match: "/master/product", key: "product" },
  { match: "/master/manufacturer", key: "manufacturer" },
  { match: "/master/retailer", key: "retailer" },
  { match: "/master/supplier", key: "supplier" },
  { match: "/master/purchase-return", key: "purchaseReturn" },
  { match: "/master/purchase", key: "purchase" },
  { match: "/master/inventory", key: "inventory" },
  { match: "/master/batch", key: "batch" },
  { match: "/master/stock-adjustment", key: "stockAdjustment" },
  { match: "/master/salesshrt", key: "quickSale" },
  { match: "/master/sales-return", key: "salesReturn" },
  { match: "/master/sales", key: "sales" },
  { match: "/master/supplier-payment", key: "supplierPayment" },
  { match: "/master/payment-collection", key: "paymentCollection" },
  { match: "/master/retailer-outstanding", key: "retailerOutstanding" },
  { match: "/master/supplier-outstanding", key: "supplierOutstanding" },
  { match: "/master/reports", key: "reports" },
  { match: "/master/alerts", key: "alerts" },
  { match: "/master/reorder-alerts", key: "alerts" },
  { match: "/master/bulk-upload", key: "bulkUpload" },
  { match: "/master/job-scheduler", key: "jobScheduler" },
  { match: "/master/dashboard", key: "dashboard" },
  { match: "/master/roles", key: "roles" },
];

const greetingReplies = [
  "Hey. I'm here and pretending to be productive until you need VMS help.",
  "Hello. Ask me about VMS, or just keep me busy with a module question.",
  "Hi. I can explain the system flow, or we can keep this conversational.",
  "Hey there. I know VMS better than it knows itself, mostly.",
];

const casualReplies = [
  "Fair enough. I'll stay useful and not over-explain things.",
  "That's reasonable. What do you want to do next?",
  "Noted. I can help with VMS flow, modules, reports, or setup.",
  "Alright. I'll keep it simple unless you want the full breakdown.",
];

const initialMessage = {
  id: "welcome",
  from: "bot",
  text:
    "Hi, I'm your VMS Assistant. Ask me how the system flow works, how FIFO or GST modes work, or pick a module below for quick help.",
};

function findHelp(query) {
  const normalized = query.toLowerCase();
  let best = null;
  let score = 0;

  Object.values(knowledgeBase).forEach((item) => {
    const current = item.keywords.reduce((sum, keyword) => {
      if (!normalized.includes(keyword)) return sum;
      // Multi-word phrase matches are a much stronger signal than a
      // single short word, so weight them more than raw length alone.
      const wordBonus = keyword.includes(" ") ? keyword.length * 1.6 : keyword.length;
      return sum + wordBonus;
    }, 0);
    if (current > score) {
      score = current;
      best = item;
    }
  });

  if (!best) {
    return {
      title: "VMS flow",
      answer:
        "I can help with VMS flow, master data, purchase, inventory, sales, returns, outstanding, payments, reports, alerts, dashboard, roles, and settings. Try asking about a module name or a task like \"how to create a sale\" or \"what is FIFO\".",
    };
  }

  return best;
}

function getCasualReply(query) {
  const normalized = query.toLowerCase().trim();
  const greetingHit = /\b(hi|hello|hey|hola|yo|good morning|good afternoon|good evening)\b/.test(normalized);
  const thanksHit = /\b(thanks|thank you|thx|ok|okay|cool|nice)\b/.test(normalized);
  const byeHit = /\b(bye|goodbye|see you|later)\b/.test(normalized);

  if (byeHit) return "Bye. I'll be here when you need the serious part again.";
  if (thanksHit) return "Any time. The bot bill is still pending, apparently.";
  if (greetingHit) return greetingReplies[Math.floor(Math.random() * greetingReplies.length)];

  if (normalized.length <= 12 && !normalized.includes("vms")) {
    return casualReplies[Math.floor(Math.random() * casualReplies.length)];
  }

  return null;
}

function buildReply(help) {
  const steps = help.steps ? `\n\nFlow:\n${help.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}` : "";
  return `${help.title}\n${help.answer}${steps}`;
}

/* ══════════════════════════════════════════════════════════════ */

const IconBot = (
  <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
    <path d="M160-120v-200q0-33 23.5-56.5T240-400h480q33 0 56.5 23.5T800-320v200H160Zm200-320q-83 0-141.5-58.5T160-640q0-83 58.5-141.5T360-840h240q83 0 141.5 58.5T800-640q0 83-58.5 141.5T600-440H360ZM240-200h480v-120H240v120Zm120-320h240q50 0 85-35t35-85q0-50-35-85t-85-35H360q-50 0-85 35t-35 85q0 50 35 85t85 35Zm28.5-91.5Q400-623 400-640t-11.5-28.5Q377-680 360-680t-28.5 11.5Q320-657 320-640t11.5 28.5Q343-600 360-600t28.5-11.5Zm240 0Q640-623 640-640t-11.5-28.5Q617-680 600-680t-28.5 11.5Q560-657 560-640t11.5 28.5Q583-600 600-600t28.5-11.5ZM480-200Zm0-440Z" />
  </svg>
);
const IconClose = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
const IconReset = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13 3v4h-4M3 13v-4h4M3.5 8a4.5 4.5 0 018-2.8M12.5 8a4.5 4.5 0 01-8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconSend = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconChevron = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function VmsAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldHideAssistant =
    location.pathname === "/" || location.pathname === "/forgotpassword" || location.pathname.includes("/login");

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([initialMessage]);
  const [typing, setTyping] = useState(false);
  const listRef = useRef(null);

  const currentHelp = useMemo(() => {
    const found = routeHints.find((hint) => location.pathname.startsWith(hint.match));
    return found ? moduleHelp[found.key] : moduleHelp.overview;
  }, [location.pathname]);

  const modules = useMemo(
    () => [
      moduleHelp.overview,
      moduleHelp.product,
      moduleHelp.purchase,
      moduleHelp.inventory,
      moduleHelp.sales,
      moduleHelp.quickSale,
      moduleHelp.retailerOutstanding,
      moduleHelp.reports,
      moduleHelp.roles,
      moduleHelp.settings,
    ],
    []
  );

  const scrollToEnd = () => {
    window.setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);
  };

  const pushBotReply = (text) => {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((current) => [...current, { id: `b-${Date.now()}`, from: "bot", text }]);
      scrollToEnd();
    }, 420 + Math.random() * 260);
  };

  if (shouldHideAssistant) return null;

  const sendMessage = (text) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    const casualReply = getCasualReply(trimmed);
    const help = casualReply ? null : findHelp(trimmed);

    setMessages((current) => [...current, { id: `u-${Date.now()}`, from: "user", text: trimmed }]);
    setInput("");
    scrollToEnd();
    pushBotReply(casualReply || buildReply(help));
  };

  const showModuleHelp = (help) => {
    setOpen(true);
    setMessages((current) => [...current, { id: `u-${Date.now()}`, from: "user", text: help.title }]);
    scrollToEnd();
    pushBotReply(buildReply(help));
  };

  const resetChat = () => {
    setMessages([initialMessage]);
    setInput("");
    setTyping(false);
  };

  return (
    <div className={`vmsa-root ${open ? "is-open" : ""}`}>
      {!open && (
        <button className="vmsa-launcher vmsa-launcher-primary" type="button" onClick={() => setOpen(true)} title="VMS Assistant">
          {IconBot}
        </button>
      )}

      {open && (
        <aside className="vmsa-frame" aria-label="VMS Assistant">
          <div className="vmsa-head">
            <div className="vmsa-avatar">{IconBot}</div>
            <div className="vmsa-head-text">
              <div className="vmsa-name">VMS Assistant</div>
              <button className="vmsa-status" type="button" onClick={() => showModuleHelp(currentHelp)}>
                <span className="vmsa-status-text">On this page: <strong>{currentHelp.title}</strong></span>
                {IconChevron}
              </button>
            </div>
            <button className="vmsa-icon-btn" type="button" onClick={resetChat} title="Reset chat">{IconReset}</button>
            <button className="vmsa-icon-btn" type="button" onClick={() => setOpen(false)} title="Close assistant">{IconClose}</button>
          </div>

          <div className="vmsa-messages" ref={listRef}>
            {messages.map((message) => (
              <div key={message.id} className={`vmsa-msg vmsa-msg-${message.from}`}>
                {message.text.split("\n").map((line, index, arr) => (
                  <React.Fragment key={`${message.id}-${index}`}>
                    {line}
                    {index < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            ))}

            {typing && (
              <div className="vmsa-msg vmsa-msg-bot vmsa-typing">
                <span /><span /><span />
              </div>
            )}

            {!typing && messages.length === 1 && (
              <div className="vmsa-suggestions">
                <span className="vmsa-suggestions-label">Try asking</span>
                <div className="vmsa-chip-row">
                  {quickActions.map((action) => (
                    <button key={action} className="vmsa-chip" type="button" onClick={() => sendMessage(action)}>{action}</button>
                  ))}
                </div>

                <span className="vmsa-suggestions-label">Or jump to a module</span>
                <div className="vmsa-chip-row">
                  {modules.map((item) => (
                    <button key={item.title} className="vmsa-chip vmsa-chip-ghost" type="button" onClick={() => showModuleHelp(item)}>{item.title}</button>
                  ))}
                </div>

                <div className="vmsa-fyi">
                  Tip: press <kbd>F1</kbd> anywhere for the full keyboard shortcuts reference.
                  <button type="button" onClick={() => { setOpen(false); navigate("/shortcut-help"); }}>Open it</button>
                </div>
              </div>
            )}
          </div>

          <form
            className="vmsa-compose"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about sales, inventory, reports…"
            />
            <button className="vmsa-send-primary" type="submit" title="Send" disabled={!input.trim()}>{IconSend}</button>
          </form>
        </aside>
      )}
    </div>
  );
}

export default VmsAssistant;

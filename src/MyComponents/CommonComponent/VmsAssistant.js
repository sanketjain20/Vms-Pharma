import React, { useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FaComments,
  FaTimes,
  FaPaperPlane,
  FaChevronRight,
  FaRedo,
  FaLightbulb,
} from "react-icons/fa";
import "../../Styles/VmsAssistant.css";

const moduleHelp = {
  overview: {
    title: "VMS flow",
    keywords: ["flow", "start", "overview", "how", "process", "work", "vms"],
    answer:
      "Start with onboarding and master data. Add manufacturer, product type, product, retailer, and supplier. Then record purchases to create inventory batches. Use sales to bill retailers or walk-in customers. Returns, payments, outstanding ledgers, alerts, reports, and dashboard then use those transactions automatically.",
    steps: [
      "Complete onboarding and settings.",
      "Create master data: manufacturer, product type, product, retailer, supplier.",
      "Add purchases so inventory and batches are available.",
      "Create sales, sales returns, purchase returns, and payments.",
      "Track outstanding ledgers, expiry/reorder alerts, reports, and dashboard.",
    ],
  },
  onboarding: {
    title: "Onboarding",
    keywords: ["onboarding", "setup", "initial", "first"],
    answer:
      "Onboarding guides the first-time setup. Use it to understand what master data must be created before daily operations. Finish manufacturer/product/retailer/supplier setup before purchase and sales entries.",
  },
  product: {
    title: "Product",
    keywords: ["product", "medicine", "item", "hsn", "schedule", "manufacturer"],
    answer:
      "Product stores medicine/item details such as product type, manufacturer, generic name, HSN, schedule, unit, pack size, and price information. Product should be created before purchase or inventory entries.",
  },
  productType: {
    title: "Product Type",
    keywords: ["product type", "type", "category"],
    answer:
      "Product Type groups products into categories. Create product types before adding products so products can be filtered and selected cleanly in inventory, purchase, and sales.",
  },
  manufacturer: {
    title: "Manufacturer",
    keywords: ["manufacturer", "company", "mfg"],
    answer:
      "Manufacturer stores the company details for medicines/products. Add manufacturers first so they appear in product add/edit dropdowns.",
  },
  retailer: {
    title: "Retailer",
    keywords: ["retailer", "customer", "chemist", "buyer", "credit limit"],
    answer:
      "Retailer stores customer/shop details, credit limit, GST, drug license, and contact information. Select a retailer during sales to maintain outstanding and ledger history.",
  },
  supplier: {
    title: "Supplier",
    keywords: ["supplier", "vendor", "purchase party"],
    answer:
      "Supplier stores the purchase party details. Select suppliers during purchase entries so supplier payments and supplier outstanding can be tracked.",
  },
  purchase: {
    title: "Purchase",
    keywords: ["purchase", "buy", "stock in", "batch", "expiry", "mrp"],
    answer:
      "Purchase records incoming stock. Enter supplier, product, batch, expiry, quantity, cost, selling price, GST, and invoice details. Purchase increases inventory and creates batch traceability.",
  },
  inventory: {
    title: "Inventory",
    keywords: ["inventory", "stock", "quantity", "batch", "reorder", "expiry"],
    answer:
      "Inventory shows available stock, reorder level, cost/selling price, batch data, and stock value. Purchase updates inventory, sales reduce it, and alerts use inventory thresholds and expiry dates.",
  },
  sales: {
    title: "Sales",
    keywords: ["sales", "sale", "invoice", "billing", "gst", "payment", "new sale"],
    answer:
      "Sales creates customer invoices. Select product, batch or FIFO auto-selection, quantity, GST mode, discount, retailer, billing mode, and payment type. Full payment closes the invoice; credit or partial payment creates outstanding.",
  },
  salesReturn: {
    title: "Sales Return",
    keywords: ["sales return", "return sale", "customer return"],
    answer:
      "Sales Return reverses sold items from an invoice. It updates returned quantities and helps keep stock and invoice history accurate.",
  },
  purchaseReturn: {
    title: "Purchase Return",
    keywords: ["purchase return", "return purchase", "supplier return"],
    answer:
      "Purchase Return records stock returned to a supplier. It is used when purchased stock is damaged, expired, incorrect, or needs supplier adjustment.",
  },
  retailerOutstanding: {
    title: "Retailer Outstanding",
    keywords: ["retailer outstanding", "customer outstanding", "ledger", "collect", "due"],
    answer:
      "Retailer Outstanding tracks unpaid, credit, and partial sales invoices. Use Collect Payment to settle dues and view ledger history for each retailer.",
  },
  supplierOutstanding: {
    title: "Supplier Outstanding",
    keywords: ["supplier outstanding", "supplier payment", "make payment"],
    answer:
      "Supplier Outstanding tracks amounts payable to suppliers. Use supplier payment/make payment flows to settle purchase dues and maintain ledger history.",
  },
  payments: {
    title: "Payments",
    keywords: ["payment", "collect payment", "supplier payment", "paid", "partial"],
    answer:
      "Payment modules manage received retailer payments and supplier payments. Use them to keep outstanding balances, ledgers, and reports accurate.",
  },
  reports: {
    title: "Reports",
    keywords: ["report", "gstr", "gst report", "profit", "expiry report"],
    answer:
      "Reports generate business summaries such as GST/GSTR, sales, purchase, stock, profit/loss, expiry, and ledger-oriented data depending on available transactions.",
  },
  alerts: {
    title: "Alerts",
    keywords: ["alert", "expiry", "reorder", "low stock"],
    answer:
      "Alerts help identify batches nearing expiry and products below reorder level. They depend on accurate purchase, inventory, and batch data.",
  },
  dashboard: {
    title: "Dashboard",
    keywords: ["dashboard", "chart", "summary", "home"],
    answer:
      "Dashboard gives a high-level view of sales, purchases, inventory, alerts, outstanding, and business activity so users can monitor daily operations quickly.",
  },
  roles: {
    title: "Roles and permissions",
    keywords: ["role", "permission", "access", "module guard", "user"],
    answer:
      "Roles control which modules and actions a user can access. Configure permissions carefully so each user only sees the workflows they are allowed to use.",
  },
};

const quickActions = [
  "How does VMS flow work?",
  "How to create a sale?",
  "What should I add before purchase?",
  "How outstanding works?",
  "Explain reports",
];

const routeHints = [
  { match: "/onboarding", key: "onboarding" },
  { match: "/master/product-type", key: "productType" },
  { match: "/master/product", key: "product" },
  { match: "/master/manufacturer", key: "manufacturer" },
  { match: "/master/retailer", key: "retailer" },
  { match: "/master/supplier", key: "supplier" },
  { match: "/master/purchase", key: "purchase" },
  { match: "/master/inventory", key: "inventory" },
  { match: "/master/sales", key: "sales" },
  { match: "/master/salesshrt", key: "sales" },
  { match: "/master/sales-return", key: "salesReturn" },
  { match: "/master/purchase-return", key: "purchaseReturn" },
  { match: "/master/retailer-outstanding", key: "retailerOutstanding" },
  { match: "/master/supplier-outstanding", key: "supplierOutstanding" },
  { match: "/master/reports", key: "reports" },
  { match: "/master/alerts", key: "alerts" },
  { match: "/master/reorder-alerts", key: "alerts" },
  { match: "/master/dashboard", key: "dashboard" },
  { match: "/master/roles", key: "roles" },
];

const greetingReplies = [
  "Hey. I’m here and pretending to be productive until you need VMS help.",
  "Hello. Ask me about VMS, or just keep me busy with a module question.",
  "Hi. I can explain the system flow, or we can keep this conversational.",
  "Hey there. I know VMS better than it knows itself, mostly.",
];

const casualReplies = [
  "Fair enough. I’ll stay useful and not over-explain things.",
  "That’s reasonable. What do you want to do next?",
  "Noted. I can help with VMS flow, modules, reports, or setup.",
  "Alright. I’ll keep it simple unless you want the full breakdown.",
];

const initialMessage = {
  id: "welcome",
  from: "bot",
  text:
    "Hi, I am your VMS Assistant. Ask me how the system flow works, or choose a module below for quick help.",
};

function findHelp(query) {
  const normalized = query.toLowerCase();
  let best = moduleHelp.overview;
  let score = 0;

  Object.values(moduleHelp).forEach((item) => {
    const current = item.keywords.reduce((sum, keyword) => {
      return normalized.includes(keyword) ? sum + keyword.length : sum;
    }, 0);
    if (current > score) {
      score = current;
      best = item;
    }
  });

  if (score === 0) {
    return {
      ...moduleHelp.overview,
      answer:
        "I can help with VMS flow, master data, purchase, inventory, sales, returns, outstanding, payments, reports, alerts, dashboard, and roles. Try asking about a module name or a task like 'how to create sale'.",
    };
  }

  return best;
}

function getCasualReply(query) {
  const normalized = query.toLowerCase().trim();
  const greetingHit = /\b(hi|hello|hey|hola|yo|good morning|good afternoon|good evening|HYE)\b/.test(normalized);
  const thanksHit = /\b(thanks|thank you|thx|ok|okay|cool|nice)\b/.test(normalized);
  const byeHit = /\b(bye|goodbye|see you|later)\b/.test(normalized);

  if (byeHit) return "Bye. I’ll be here when you need the serious part again.";
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

function VmsAssistant() {
  const location = useLocation();
  const shouldHideAssistant =
    location.pathname === "/" || location.pathname === "/forgotpassword" || location.pathname.includes("/login");


  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([initialMessage]);
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
      moduleHelp.retailerOutstanding,
      moduleHelp.reports,
      moduleHelp.roles,
    ],
    []
  );

    if (shouldHideAssistant) {
    return null;
  }
  const sendMessage = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const casualReply = getCasualReply(trimmed);
    const help = casualReply ? null : findHelp(trimmed);
    const nextMessages = [
      ...messages,
      { id: `u-${Date.now()}`, from: "user", text: trimmed },
      {
        id: `b-${Date.now()}`,
        from: "bot",
        text: casualReply || buildReply(help),
      },
    ];

    setMessages(nextMessages);
    setInput("");
    window.setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);
  };

  const showModuleHelp = (help) => {
    setMessages((current) => [
      ...current,
      { id: `b-${Date.now()}`, from: "bot", text: buildReply(help) },
    ]);
    setOpen(true);
    window.setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);
  };

  const resetChat = () => {
    setMessages([initialMessage]);
    setInput("");
  };

  return (
    <div className={`vms-assistant ${open ? "vmsa-open" : ""}`}>
      {!open && (
        <button className="vmsa-launcher" type="button" onClick={() => setOpen(true)} title="Hannah Assist">
<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#0a74bb"><path d="M160-120v-200q0-33 23.5-56.5T240-400h480q33 0 56.5 23.5T800-320v200H160Zm200-320q-83 0-141.5-58.5T160-640q0-83 58.5-141.5T360-840h240q83 0 141.5 58.5T800-640q0 83-58.5 141.5T600-440H360ZM240-200h480v-120H240v120Zm120-320h240q50 0 85-35t35-85q0-50-35-85t-85-35H360q-50 0-85 35t-35 85q0 50 35 85t85 35Zm28.5-91.5Q400-623 400-640t-11.5-28.5Q377-680 360-680t-28.5 11.5Q320-657 320-640t11.5 28.5Q343-600 360-600t28.5-11.5Zm240 0Q640-623 640-640t-11.5-28.5Q617-680 600-680t-28.5 11.5Q560-657 560-640t11.5 28.5Q583-600 600-600t28.5-11.5ZM480-200Zm0-440Z"/></svg>   
        </button>
      )}

      {open && (
        <aside className="vmsa-panel" aria-label="VMS Assistant">
          <div className="vmsa-header">
            <div className="vmsa-avatar">
             <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M160-120v-200q0-33 23.5-56.5T240-400h480q33 0 56.5 23.5T800-320v200H160Zm200-320q-83 0-141.5-58.5T160-640q0-83 58.5-141.5T360-840h240q83 0 141.5 58.5T800-640q0 83-58.5 141.5T600-440H360ZM240-200h480v-120H240v120Zm120-320h240q50 0 85-35t35-85q0-50-35-85t-85-35H360q-50 0-85 35t-35 85q0 50 35 85t85 35Zm28.5-91.5Q400-623 400-640t-11.5-28.5Q377-680 360-680t-28.5 11.5Q320-657 320-640t11.5 28.5Q343-600 360-600t28.5-11.5Zm240 0Q640-623 640-640t-11.5-28.5Q617-680 600-680t-28.5 11.5Q560-657 560-640t11.5 28.5Q583-600 600-600t28.5-11.5ZM480-200Zm0-440Z"/></svg>
            </div>
            <div>
              <div className="vmsa-title">Hannah | VMS Assistant</div>
              <div className="vmsa-subtitle">{currentHelp.title} help ready</div>
              <div className="vmsa-subtitle-key">Press <kbd>F1</kbd> to view keyboard shortcuts help.</div>          
            </div>
            <button className="vmsa-icon-btn" type="button" onClick={resetChat} title="Reset chat">
              <FaRedo />
            </button>
            <button className="vmsa-icon-btn" type="button" onClick={() => setOpen(false)} title="Close assistant">
              <FaTimes />
            </button>
          </div>

          <div className="vmsa-context">
            <div className="vmsa-context-label">Current page</div>
            <button type="button" onClick={() => showModuleHelp(currentHelp)}>
              <span>{currentHelp.title}</span>
              <FaChevronRight />
            </button>
          </div>

          <div className="vmsa-messages" ref={listRef}>
            {messages.map((message) => (
              <div key={message.id} className={`vmsa-message vmsa-${message.from}`}>
                {message.text.split("\n").map((line, index) => (
                  <React.Fragment key={`${message.id}-${index}`}>
                    {line}
                    {index < message.text.split("\n").length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>

          <div className="vmsa-quick">
            {quickActions.map((action) => (
              <button key={action} type="button" onClick={() => sendMessage(action)}>
                {action}
              </button>
            ))}
          </div>

          <div className="vmsa-modules">
            {modules.map((item) => (
              <button key={item.title} type="button" onClick={() => showModuleHelp(item)}>
                {item.title}
              </button>
            ))}
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
              placeholder="Ask about sales, inventory, reports..."
            />
            <button type="submit" title="Send">
              <FaPaperPlane />
            </button>
          </form>
        </aside>
      )}
    </div>
  );
}

export default VmsAssistant;

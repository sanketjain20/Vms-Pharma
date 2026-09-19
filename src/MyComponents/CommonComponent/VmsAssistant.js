import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../Styles/VmsAssistant.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const CHAT_API = `${API_BASE_URL}/api/Chat/SendMessage`;
const STORAGE_KEY = "vmsAssistantHistory";
const MAX_STORED_MESSAGES = 60;
const MAX_HISTORY_SENT = 16;

/* Route → module title, purely for the "On this page" status line and to
   give the backend a hint of context — not a canned-answer table. The LLM
   generates the actual reply. */
const routeHints = [
  { match: "/onboarding", title: "Onboarding" },
  { match: "/setting", title: "Account settings" },
  { match: "/master/product-type", title: "Product Type" },
  { match: "/master/product", title: "Product" },
  { match: "/master/manufacturer", title: "Manufacturer" },
  { match: "/master/retailer", title: "Retailer" },
  { match: "/master/supplier", title: "Supplier" },
  { match: "/master/purchase-return", title: "Purchase Return" },
  { match: "/master/purchase", title: "Purchase" },
  { match: "/master/inventory", title: "Inventory" },
  { match: "/master/batch", title: "Batches" },
  { match: "/master/stock-adjustment", title: "Stock Adjustment" },
  { match: "/master/salesshrt", title: "Quick Sale" },
  { match: "/master/sales-return", title: "Sales Return" },
  { match: "/master/sales", title: "Sales" },
  { match: "/master/supplier-payment", title: "Supplier Payment" },
  { match: "/master/payment-collection", title: "Payment Collection" },
  { match: "/master/retailer-outstanding", title: "Retailer Outstanding" },
  { match: "/master/supplier-outstanding", title: "Supplier Outstanding" },
  { match: "/master/reports", title: "Reports" },
  { match: "/master/alerts", title: "Expiry & reorder alerts" },
  { match: "/master/reorder-alerts", title: "Expiry & reorder alerts" },
  { match: "/master/bulk-upload", title: "Bulk Upload" },
  { match: "/master/job-scheduler", title: "Job Scheduler" },
  { match: "/master/intelligence", title: "VMS Intelligence" },
  { match: "/master/dashboard", title: "Dashboard" },
  { match: "/master/roles", title: "Roles & permissions" },
];

const quickActions = [
  "How does VMS flow work?",
  "How do I create a sale?",
  "What should I add before a purchase?",
  "Paid vs Credit vs Partial — what's the difference?",
  "How does FIFO batch selection work?",
];

const jumpModules = [
  "VMS flow",
  "Product",
  "Purchase",
  "Inventory",
  "Sales",
  "Quick Sale",
  "Retailer Outstanding",
  "Reports",
  "VMS Intelligence",
  "Account settings",
];

const welcomeMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi, I'm your VMS Assistant. Ask me anything about how VMS works — flow, modules, GST, FIFO, reports, whatever's on your mind.",
};

function loadStoredMessages() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistMessages(messages) {
  try {
    const real = messages.filter((m) => !m.pending);
    // Nothing beyond the welcome message means there's no real conversation
    // yet (fresh mount or a just-reset chat) — don't persist a no-op state.
    if (real.length === 0 || (real.length === 1 && real[0].id === "welcome")) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const toStore = real
      .slice(-MAX_STORED_MESSAGES)
      .map(({ id, role, text, error }) => ({ id, role, text, error: !!error }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    /* private-mode / quota — conversation just won't survive a reload */
  }
}

/* ══════════════════════════════════════════════════════════════
   RICH TEXT — a small, dependency-free renderer for the light markdown
   the assistant is instructed to use: **bold**, `code`, "- " / "1. " lists,
   and blank-line paragraphs. Enough for LLM replies without pulling in a
   markdown + sanitizer dependency chain for a handful of tags.
   ══════════════════════════════════════════════════════════════ */
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code className="vmsa-code" key={`${keyPrefix}-${i}`}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

function RichText({ text }) {
  const lines = text.split("\n");
  const blocks = [];
  let listBuffer = null; // { type: "ul"|"ol", items: [] }

  const flushList = () => {
    if (listBuffer) {
      blocks.push(listBuffer);
      listBuffer = null;
    }
  };

  lines.forEach((line, idx) => {
    const bulletMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    const numberedMatch = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (bulletMatch) {
      if (!listBuffer || listBuffer.type !== "ul") {
        flushList();
        listBuffer = { type: "ul", items: [] };
      }
      listBuffer.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (!listBuffer || listBuffer.type !== "ol") {
        flushList();
        listBuffer = { type: "ol", items: [] };
      }
      listBuffer.items.push(numberedMatch[1]);
    } else {
      flushList();
      blocks.push({ type: "line", text: line, key: idx });
    }
  });
  flushList();

  return (
    <>
      {blocks.map((block, bi) => {
        if (block.type === "ul") {
          return (
            <ul className="vmsa-list" key={`ul-${bi}`}>
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item, `ul-${bi}-${ii}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol className="vmsa-list" key={`ol-${bi}`}>
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item, `ol-${bi}-${ii}`)}</li>
              ))}
            </ol>
          );
        }
        if (block.text === "") {
          return <div className="vmsa-blank-line" key={`b-${bi}`} />;
        }
        return (
          <div className="vmsa-line" key={`l-${bi}`}>
            {renderInline(block.text, `l-${bi}`)}
          </div>
        );
      })}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════ */

const IconBot = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v3" />
    <rect x="5" y="7" width="14" height="12" rx="4" />
    <path d="M9 13v.01M15 13v.01" />
    <path d="M9.5 16.5c.7.6 1.6.9 2.5.9s1.8-.3 2.5-.9" />
    <path d="M3 12h2M19 12h2" />
  </svg>
);
const IconClose = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
const IconReset = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13 3v4h-4M3 13v-4h4M3.5 8a4.5 4.5 0 018-2.8M12.5 8a4.5 4.5 0 01-8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconSend = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconChevron = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconCopy = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M3.5 10.5V4a1.5 1.5 0 011.5-1.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
);
const IconCheck = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconRetry = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M13 3v4h-4M3 13v-4h4M3.5 8a4.5 4.5 0 018-2.8M12.5 8a4.5 4.5 0 01-8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const IconWarn = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.5 15 14H1L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M8 6.5v3.2M8 11.7v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);

function MessageBubble({ message, onRetry, onCopy, copied }) {
  if (message.pending) {
    return (
      <div className="vmsa-msg vmsa-msg-assistant vmsa-typing">
        <span /><span /><span />
      </div>
    );
  }

  return (
    <div className={`vmsa-msg vmsa-msg-${message.role} ${message.error ? "vmsa-msg-error" : ""}`}>
      {message.error && (
        <div className="vmsa-msg-error-label">
          {IconWarn}
          <span>Couldn't get a reply</span>
        </div>
      )}
      <div className="vmsa-msg-body">
        <RichText text={message.text} />
      </div>
      {message.role === "assistant" && !message.error && (
        <button className="vmsa-msg-action" type="button" onClick={() => onCopy(message)} title="Copy">
          {copied ? IconCheck : IconCopy}
        </button>
      )}
      {message.error && (
        <button className="vmsa-msg-retry" type="button" onClick={() => onRetry(message)}>
          {IconRetry} Retry
        </button>
      )}
    </div>
  );
}

function VmsAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldHideAssistant =
    location.pathname === "/" || location.pathname === "/forgotpassword" || location.pathname.includes("/login");

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => loadStoredMessages() || [welcomeMessage]);
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const listRef = useRef(null);
  const copyTimerRef = useRef(null);

  const currentModuleTitle = useMemo(() => {
    const found = routeHints.find((hint) => location.pathname.startsWith(hint.match));
    return found ? found.title : "VMS flow";
  }, [location.pathname]);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  const scrollToEnd = () => {
    window.setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);
  };

  if (shouldHideAssistant) return null;

  const requestReply = async (historyForRequest) => {
    setSending(true);
    const pendingId = `b-${Date.now()}`;
    setMessages((current) => [...current, { id: pendingId, role: "assistant", text: "", pending: true }]);
    scrollToEnd();

    const payload = {
      messages: historyForRequest.slice(-MAX_HISTORY_SENT).map((m) => ({ role: m.role, content: m.text })),
      pageContext: currentModuleTitle,
    };

    let replaceWith;
    try {
      const res = await apiClient(CHAT_API, {
        method: "POST",
        globalLoader: false,
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json?.status === 200 && json?.data?.reply) {
        replaceWith = { id: pendingId, role: "assistant", text: json.data.reply };
      } else {
        replaceWith = {
          id: pendingId,
          role: "assistant",
          text: json?.message || "Something went wrong on my end. Mind trying again?",
          error: true,
          retryHistory: historyForRequest,
        };
      }
    } catch {
      replaceWith = {
        id: pendingId,
        role: "assistant",
        text: "Couldn't reach the assistant — check your connection and try again.",
        error: true,
        retryHistory: historyForRequest,
      };
    }

    setMessages((current) => current.map((m) => (m.id === pendingId ? replaceWith : m)));
    setSending(false);
    scrollToEnd();
  };

  const sendMessage = (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMsg = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    const historyForRequest = [...messages.filter((m) => !m.pending), userMsg];
    setMessages(historyForRequest);
    setInput("");
    scrollToEnd();
    requestReply(historyForRequest);
  };

  const retryMessage = (failedMessage) => {
    if (sending) return;
    setMessages((current) => current.filter((m) => m.id !== failedMessage.id));
    requestReply(failedMessage.retryHistory || messages.filter((m) => !m.pending && !m.error));
  };

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  };

  const resetChat = () => {
    setMessages([welcomeMessage]);
    setInput("");
    setSending(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`vmsa-root ${open ? "is-open" : ""}`}>
      {!open && (
        <button className="vmsa-launcher vmsa-launcher-primary" type="button" onClick={() => setOpen(true)} title="VMS Assistant">
          <span className="vmsa-launcher-pulse" />
          {IconBot}
        </button>
      )}

      {open && (
        <aside className="vmsa-frame" aria-label="VMS Assistant">
          <div className="vmsa-head">
            <div className="vmsa-avatar">{IconBot}</div>
            <div className="vmsa-head-text">
              <div className="vmsa-name">VMS Assistant</div>
              <button className="vmsa-status" type="button" onClick={() => sendMessage(`Tell me about the ${currentModuleTitle} module.`)}>
                <span className="vmsa-status-text">On this page: <strong>{currentModuleTitle}</strong></span>
                {IconChevron}
              </button>
            </div>
            <button className="vmsa-icon-btn" type="button" onClick={resetChat} title="Reset chat">{IconReset}</button>
            <button className="vmsa-icon-btn" type="button" onClick={() => setOpen(false)} title="Close assistant">{IconClose}</button>
          </div>

          <div className="vmsa-messages" ref={listRef}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onRetry={retryMessage} onCopy={copyMessage} copied={copiedId === message.id} />
            ))}

            {messages.length === 1 && messages[0].id === "welcome" && (
              <div className="vmsa-suggestions">
                <span className="vmsa-suggestions-label">Try asking</span>
                <div className="vmsa-chip-row">
                  {quickActions.map((action) => (
                    <button key={action} className="vmsa-chip" type="button" onClick={() => sendMessage(action)}>{action}</button>
                  ))}
                </div>

                <span className="vmsa-suggestions-label">Or ask about a module</span>
                <div className="vmsa-chip-row">
                  {jumpModules.map((title) => (
                    <button key={title} className="vmsa-chip vmsa-chip-ghost" type="button" onClick={() => sendMessage(`Tell me about the ${title} module.`)}>{title}</button>
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
              disabled={sending}
            />
            <button className="vmsa-send-primary" type="submit" title="Send" disabled={!input.trim() || sending}>{IconSend}</button>
          </form>
        </aside>
      )}
    </div>
  );
}

export default VmsAssistant;

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../Styles/VmsAssistant.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const CHAT_API = `${API_BASE_URL}/api/Chat/SendMessage`;
const STORAGE_KEY = "vmsAssistantHistory";
const SIZE_STORAGE_KEY = "vmsAssistantExpanded";
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

function loadStoredExpanded() {
  try {
    return window.localStorage.getItem(SIZE_STORAGE_KEY) === "1";
  } catch {
    return false;
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

/* VMS Assistant mark — a friendly face wearing a support headset, with big
   blinking eyes, a smile, rosy cheeks and a twinkling spark. Original
   artwork: reads as "an AI that's here to help you". */
const IconBot = (
  <svg className="vmsa-face" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {/* headset band + ear cups */}
    <path d="M4.2 12V11a7.8 7.8 0 0115.6 0v1" />
    <rect x="2.5" y="11" width="2.4" height="4.4" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="19.1" y="11" width="2.4" height="4.4" rx="1.2" fill="currentColor" stroke="none" />
    {/* head */}
    <rect x="5.2" y="6.8" width="13.6" height="12" rx="5.2" />
    {/* eyes */}
    <ellipse className="vmsa-eye" cx="9.4" cy="12.2" rx="1.05" ry="1.5" fill="currentColor" stroke="none" />
    <ellipse className="vmsa-eye" cx="14.6" cy="12.2" rx="1.05" ry="1.5" fill="currentColor" stroke="none" />
    {/* cheeks */}
    <circle cx="7.6" cy="15" r=".7" fill="currentColor" stroke="none" opacity=".45" />
    <circle cx="16.4" cy="15" r=".7" fill="currentColor" stroke="none" opacity=".45" />
    {/* smile */}
    <path d="M9.8 15.4c.6.7 1.4 1.1 2.2 1.1s1.6-.4 2.2-1.1" />
    {/* spark */}
    <path className="vmsa-spark" d="M20.6 1.6v3.4M18.9 3.3h3.4" strokeWidth="1.4" />
  </svg>
);
const IconClose = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
const IconReset = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13 3v4h-4M3 13v-4h4M3.5 8a4.5 4.5 0 018-2.8M12.5 8a4.5 4.5 0 01-8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
/* Maximize: arrows pointing outward to opposite corners */
const IconMaximize = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
/* Minimize: arrows pointing inward */
const IconMinimize = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5 14 2M6.5 9.5 2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
  const [expanded, setExpanded] = useState(loadStoredExpanded);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => loadStoredMessages() || [welcomeMessage]);
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const copyTimerRef = useRef(null);

  const currentModuleTitle = useMemo(() => {
    const found = routeHints.find((hint) => location.pathname.startsWith(hint.match));
    return found ? found.title : "VMS flow";
  }, [location.pathname]);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  // Remember the chosen size across reloads.
  useEffect(() => {
    try {
      window.localStorage.setItem(SIZE_STORAGE_KEY, expanded ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [expanded]);

  // Esc steps back out of the maximized view (and does nothing otherwise).
  useEffect(() => {
    if (!open || !expanded) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, expanded]);

  // Keep the latest message in view after the panel resizes.
  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 320);
    return () => window.clearTimeout(t);
  }, [expanded, open]);

  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  const scrollToEnd = () => {
    window.setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);
  };

  if (shouldHideAssistant) return null;

  const toggleExpanded = () => {
    setExpanded((value) => !value);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

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
      window.clearTimeout(copyTimerRef.current);
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
    <div className={`vmsa-root ${open ? "is-open" : ""} ${open && expanded ? "is-expanded" : ""}`}>
      {open && expanded && <div className="vmsa-backdrop" onClick={() => setExpanded(false)} aria-hidden="true" />}

      {!open && (
        <button className="vmsa-launcher vmsa-launcher-primary" type="button" onClick={() => setOpen(true)} title="VMS Assistant">
          <span className="vmsa-launcher-pulse" />
          {IconBot}
        </button>
      )}

      {open && (
        <aside className={`vmsa-frame ${expanded ? "is-expanded" : ""}`} aria-label="VMS Assistant">
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
            <button
              className="vmsa-icon-btn vmsa-icon-btn-size"
              type="button"
              onClick={toggleExpanded}
              title={expanded ? "Minimize (Esc)" : "Maximize"}
              aria-label={expanded ? "Minimize assistant" : "Maximize assistant"}
              aria-pressed={expanded}
            >
              {expanded ? IconMinimize : IconMaximize}
            </button>
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
              ref={inputRef}
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
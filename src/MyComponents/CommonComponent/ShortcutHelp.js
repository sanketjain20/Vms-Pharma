import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/ShortcutHelp.css";

/* ─── Data ─────────────────────────────────────────────────── */
const CTRL_SHORTCUTS = [
  { key: "P", action: "Product" },
  { key: "V", action: "Vendor" },
  { key: "T", action: "Product Type" },
  { key: "S", action: "Sales" },
  { key: "I", action: "Inventory" },
  { key: "D", action: "Dashboard" },
  { key: "R", action: "Reports" },
  { key: "B", action: "Batch" },
  { key: "A", action: "Alerts" },
  { key: "K", action: "Stock Adjustment" },
  { key: "Q", action: "Quick Sales" },
  { key: "O", action: "Onboarding" },
  { key: "G", action: "Settings" },
];

const ALT_SHORTCUTS = [
  { key: "P", action: "Product" },
  { key: "V", action: "Vendor" },
  { key: "S", action: "Sales" },
  { key: "D", action: "Dashboard" },
  { key: "N", action: "Quick Sales" },
];

const FUNCTION_SHORTCUTS = [
  { key: "F1", action: "Shortcut Help" },
  { key: "F2", action: "Sales" },
  { key: "F3", action: "Product" },
  { key: "F4", action: "Quick Sales" },
  { key: "F5", action: "Dashboard" },
];

/* ─── Row ──────────────────────────────────────────────────── */
function ShortcutRow({ combo, action }) {
  return (
    <div className="shc-row">
      <div className="shc-keys">
        {combo.map((k, i) => (
          <React.Fragment key={k}>
            <kbd className="shc-key">{k}</kbd>
            {i < combo.length - 1 && <span className="shc-plus">+</span>}
          </React.Fragment>
        ))}
      </div>
      <span className="shc-action">{action}</span>
    </div>
  );
}

/* ─── Card ─────────────────────────────────────────────────── */
function ShortcutCard({ icon, color, title, count, children }) {
  return (
    <div className="shc-card">
      <div className="shc-card-head">
        <div className={`shc-card-icon ${color}`}>{icon}</div>
        <span className="shc-card-label">{title}</span>
        <span className="shc-count">{count}</span>
      </div>
      <div className="shc-card-body">{children}</div>
    </div>
  );
}

/* ─── Icons (inline, no deps) ──────────────────────────────── */
const IconCtrl = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15l8-8 8 8" />
  </svg>
);
const IconAlt = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19h4l5-14h7M14 19h6" />
  </svg>
);
const IconFn = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 9h4M7 13h2" />
  </svg>
);
const IconSearch = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
  </svg>
);
const IconBack = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

/* ─── Page ─────────────────────────────────────────────────── */
export default function ShortcutHelp({ onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const goBack = () => (onClose ? onClose() : navigate(-1));

  /* Esc closes / goes back */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") goBack(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filter = (list) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) => s.action.toLowerCase().includes(q) || s.key.toLowerCase().includes(q)
    );
  };

  const ctrl = useMemo(() => filter(CTRL_SHORTCUTS), [query]);
  const alt  = useMemo(() => filter(ALT_SHORTCUTS), [query]);
  const fn   = useMemo(() => filter(FUNCTION_SHORTCUTS), [query]);
  const totalVisible = ctrl.length + alt.length + fn.length;

  return (
    <div className="shc-root">
      <div className="shc-blob-1" /><div className="shc-blob-2" />

      <div className="shc-inner">

        <div className="shc-head">
          <div className="shc-eyebrow">
            <div className="shc-eyebrow-dot" />
            Power User Reference
          </div>
          <h1 className="shc-title">Keyboard <span>Shortcuts</span></h1>
          <p className="shc-subtitle">
            Every key combination available across Udoyra — jump between modules without touching the mouse.
          </p>
        </div>

        <div className="shc-search-bar">
          <span className="shc-search-icon">{IconSearch}</span>
          <input
            className="shc-search-input"
            placeholder="Search a shortcut or action…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="shc-search-clear" onClick={() => setQuery("")}>✕</button>
          )}
        </div>

        {totalVisible === 0 ? (
          <div className="shc-empty">No shortcuts match “{query}”</div>
        ) : (
          <div className="shc-grid">
            <div className="shc-grid-main">
              <ShortcutCard icon={IconCtrl} color="blue" title="Ctrl Shortcuts" count={ctrl.length}>
                {ctrl.map((s) => (
                  <ShortcutRow key={`ctrl-${s.key}`} combo={["Ctrl", s.key]} action={s.action} />
                ))}
              </ShortcutCard>
            </div>

            <div className="shc-grid-side">
              {alt.length > 0 && (
                <ShortcutCard icon={IconAlt} color="purple" title="Alt Shortcuts" count={alt.length}>
                  {alt.map((s) => (
                    <ShortcutRow key={`alt-${s.key}`} combo={["Alt", s.key]} action={s.action} />
                  ))}
                </ShortcutCard>
              )}

              {fn.length > 0 && (
                <ShortcutCard icon={IconFn} color="green" title="Function Keys" count={fn.length}>
                  {fn.map((s) => (
                    <ShortcutRow key={`fn-${s.key}`} combo={[s.key]} action={s.action} />
                  ))}
                </ShortcutCard>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="shc-footer">
        <span className="shc-footer-hint">
          Press <kbd className="shc-key shc-key-sm">Esc</kbd> to go back
        </span>
        <button className="shc-btn shc-btn-primary" onClick={goBack}>
          {IconBack}
          Back
        </button>
      </div>
    </div>
  );
}
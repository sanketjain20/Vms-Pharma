import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/ShortcutHelp.css";

/* ─── Data — the real bindings this app listens for ──────────── */
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

/* ─── A real, compact QWERTY layout for the live preview ───────
   Every unit is a relative flex width (1 = a normal letter key). */
const KEY_ROWS = [
  [
    { id: "Esc", label: "Esc", w: 1.2 },
    { id: "gap", gap: true, w: 0.6 },
    { id: "F1", label: "F1", w: 1 }, { id: "F2", label: "F2", w: 1 }, { id: "F3", label: "F3", w: 1 }, { id: "F4", label: "F4", w: 1 },
    { id: "gap2", gap: true, w: 0.5 },
    { id: "F5", label: "F5", w: 1 }, { id: "F6", label: "F6", w: 1 }, { id: "F7", label: "F7", w: 1 }, { id: "F8", label: "F8", w: 1 },
    { id: "gap3", gap: true, w: 0.5 },
    { id: "F9", label: "F9", w: 1 }, { id: "F10", label: "F10", w: 1 }, { id: "F11", label: "F11", w: 1 }, { id: "F12", label: "F12", w: 1 },
  ],
  [
    { id: "`", label: "`", w: 1 },
    { id: "1", label: "1", w: 1 }, { id: "2", label: "2", w: 1 }, { id: "3", label: "3", w: 1 }, { id: "4", label: "4", w: 1 }, { id: "5", label: "5", w: 1 },
    { id: "6", label: "6", w: 1 }, { id: "7", label: "7", w: 1 }, { id: "8", label: "8", w: 1 }, { id: "9", label: "9", w: 1 }, { id: "0", label: "0", w: 1 },
    { id: "-", label: "-", w: 1 }, { id: "=", label: "=", w: 1 },
    { id: "Backspace", label: "⌫", w: 1.8 },
  ],
  [
    { id: "Tab", label: "Tab", w: 1.5 },
    { id: "Q", label: "Q", w: 1 }, { id: "W", label: "W", w: 1 }, { id: "E", label: "E", w: 1 }, { id: "R", label: "R", w: 1 }, { id: "T", label: "T", w: 1 },
    { id: "Y", label: "Y", w: 1 }, { id: "U", label: "U", w: 1 }, { id: "I", label: "I", w: 1 }, { id: "O", label: "O", w: 1 }, { id: "P", label: "P", w: 1 },
    { id: "[", label: "[", w: 1 }, { id: "]", label: "]", w: 1 },
  ],
  [
    { id: "Caps", label: "Caps", w: 1.75 },
    { id: "A", label: "A", w: 1 }, { id: "S", label: "S", w: 1 }, { id: "D", label: "D", w: 1 }, { id: "F", label: "F", w: 1 }, { id: "G", label: "G", w: 1 },
    { id: "H", label: "H", w: 1 }, { id: "J", label: "J", w: 1 }, { id: "K", label: "K", w: 1 }, { id: "L", label: "L", w: 1 },
    { id: ";", label: ";", w: 1 },
    { id: "Enter", label: "Enter", w: 2.15 },
  ],
  [
    { id: "ShiftL", label: "Shift", w: 2.25 },
    { id: "Z", label: "Z", w: 1 }, { id: "X", label: "X", w: 1 }, { id: "C", label: "C", w: 1 }, { id: "V", label: "V", w: 1 }, { id: "B", label: "B", w: 1 },
    { id: "N", label: "N", w: 1 }, { id: "M", label: "M", w: 1 },
    { id: ",", label: ",", w: 1 }, { id: ".", label: ".", w: 1 },
    { id: "ShiftR", label: "Shift", w: 2.75 },
  ],
  [
    { id: "CtrlL", label: "Ctrl", w: 1.4 },
    { id: "AltL", label: "Alt", w: 1.2 },
    { id: "Space", label: "", w: 6 },
    { id: "AltR", label: "Alt", w: 1.2 },
    { id: "CtrlR", label: "Ctrl", w: 1.4 },
  ],
];

/* ─── Icons (inline, no deps) ──────────────────────────────── */
const IconCtrl = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15l8-8 8 8" /></svg>);
const IconAlt = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h4l5-14h7M14 19h6" /></svg>);
const IconFn = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h4M7 13h2" /></svg>);
const IconSearch = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>);
const IconBack = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>);
const IconKeyboard = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 14h12" /></svg>);

/* ─── Live keyboard preview ────────────────────────────────── */
function KeyboardPreview({ active, caption }) {
  return (
    <div className="shk-kb">
      <div className="shk-kb-cap">
        {active.length ? (
          <span>
            <span className="shk-kb-cap-combo">{caption}</span>
          </span>
        ) : (
          <span className="shk-kb-cap-idle">Hover a shortcut to see it light up</span>
        )}
      </div>
      <div className="shk-kb-deck">
        {KEY_ROWS.map((row, ri) => (
          <div className="shk-kb-row" key={ri}>
            {row.map((k) =>
              k.gap ? (
                <span key={k.id} className="shk-kb-gap" style={{ flexGrow: k.w }} />
              ) : (
                <span
                  key={k.id}
                  className={`shk-kb-key${active.includes(k.id) ? " is-active" : ""}${k.id === "Space" ? " is-space" : ""}`}
                  style={{ flexGrow: k.w }}
                >
                  {k.label}
                </span>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Row ──────────────────────────────────────────────────── */
function ShortcutRow({ combo, ids, action, onEnter, onLeave }) {
  return (
    <div className="shk-row" onMouseEnter={() => onEnter(ids, `${combo.join(" + ")} → ${action}`)} onMouseLeave={onLeave} tabIndex={0} onFocus={() => onEnter(ids, `${combo.join(" + ")} → ${action}`)} onBlur={onLeave}>
      <div className="shk-keys">
        {combo.map((k, i) => (
          <React.Fragment key={k}>
            <kbd className="shk-key">{k}</kbd>
            {i < combo.length - 1 && <span className="shk-plus">+</span>}
          </React.Fragment>
        ))}
      </div>
      <span className="shk-action">{action}</span>
    </div>
  );
}

/* ─── Card ─────────────────────────────────────────────────── */
function ShortcutBlock({ icon, color, title, count, children }) {
  return (
    <div className="shk-block">
      <div className="shk-block-head">
        <div className={`shk-block-icon ${color}`}>{icon}</div>
        <span className="shk-block-name">{title}</span>
        <span className="shk-tally">{count}</span>
      </div>
      <div className="shk-block-body">{children}</div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function ShortcutHelp({ onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState([]);
  const [caption, setCaption] = useState("");

  const goBack = () => (onClose ? onClose() : navigate(-1));

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") goBack(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arm = (ids, label) => { setActive(ids); setCaption(label); };
  const disarm = () => { setActive([]); setCaption(""); };

  const filter = (list) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.action.toLowerCase().includes(q) || s.key.toLowerCase().includes(q));
  };

  const ctrl = useMemo(() => filter(CTRL_SHORTCUTS), [query]);
  const alt = useMemo(() => filter(ALT_SHORTCUTS), [query]);
  const fn = useMemo(() => filter(FUNCTION_SHORTCUTS), [query]);
  const totalVisible = ctrl.length + alt.length + fn.length;

  return (
    <main className="shk-root">
      <div className="shk-glow shk-glow-1" /><div className="shk-glow shk-glow-2" />

      <div className="shk-inner">
        <div className="shk-head">
          <span className="shk-eyebrow">POWER USER REFERENCE</span>
          <h1 className="shk-title">Keyboard shortcuts</h1>
          <p className="shk-subtitle">
            Every key combination available across VMS — jump between modules without touching the mouse.
          </p>
        </div>

        <div className="shk-search">
          <span className="shk-search-icon">{IconSearch}</span>
          <input
            className="shk-search-input"
            placeholder="Search a shortcut or action…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && <button className="shk-search-clear" onClick={() => setQuery("")}>✕</button>}
        </div>

        <section className="shk-kb-frame">
          <div className="shk-kb-frame-head">
            <span className="shk-kb-frame-icon">{IconKeyboard}</span>
            <span>Live preview</span>
          </div>
          <KeyboardPreview active={active} caption={caption} />
        </section>

        {totalVisible === 0 ? (
          <div className="shk-empty">No shortcuts match &ldquo;{query}&rdquo;</div>
        ) : (
          <div className="shk-grid">
            <div className="shk-grid-main">
              <ShortcutBlock icon={IconCtrl} color="blue" title="Ctrl shortcuts" count={ctrl.length}>
                {ctrl.map((s) => (
                  <ShortcutRow key={`ctrl-${s.key}`} combo={["Ctrl", s.key]} ids={["CtrlL", s.key]} action={s.action}
                    onEnter={arm} onLeave={disarm} />
                ))}
              </ShortcutBlock>
            </div>

            <div className="shk-grid-side">
              {alt.length > 0 && (
                <ShortcutBlock icon={IconAlt} color="purple" title="Alt shortcuts" count={alt.length}>
                  {alt.map((s) => (
                    <ShortcutRow key={`alt-${s.key}`} combo={["Alt", s.key]} ids={["AltL", s.key]} action={s.action}
                      onEnter={arm} onLeave={disarm} />
                  ))}
                </ShortcutBlock>
              )}

              {fn.length > 0 && (
                <ShortcutBlock icon={IconFn} color="green" title="Function keys" count={fn.length}>
                  {fn.map((s) => (
                    <ShortcutRow key={`fn-${s.key}`} combo={[s.key]} ids={[s.key]} action={s.action}
                      onEnter={arm} onLeave={disarm} />
                  ))}
                </ShortcutBlock>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="shk-footer">
        <span className="shk-footer-hint">Press <kbd className="shk-key shk-key-sm">Esc</kbd> to go back</span>
        <button className="shk-btn shk-btn-primary" onClick={goBack}>
          {IconBack}
          Back
        </button>
      </div>
    </main>
  );
}

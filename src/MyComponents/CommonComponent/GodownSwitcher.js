import React, { useEffect, useRef, useState } from "react";

/* Anchored where the plain shop badge used to sit in NavBarModule's
   nbm-left — becomes the switcher trigger once a vendor has more than one
   godown. A single-godown vendor (the common case pre-feature) sees the
   exact same static badge as before, so this never introduces UI churn for
   most accounts. Dropdown open/close copies the profile-menu idiom already
   used elsewhere in NavBarModule.js (ref + outside-mousedown-close). */
export default function GodownSwitcher({ godowns, activeGodownId, onChange, vendorShop }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const list = godowns || [];
  const active = list.find((g) => String(g.id) === String(activeGodownId));

  if (list.length <= 1) {
    if (!vendorShop) return null;
    return (
      <div className="nbm-shop-badge">
        <span className="nbm-shop-badge-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 6.3l1-4.1h11l1 4.1" />
            <path d="M2 6.3v6.7a1 1 0 001 1h10a1 1 0 001-1V6.3" />
            <path d="M1.5 6.3a1.9 1.9 0 003.8 0M5.3 6.3a1.9 1.9 0 003.8 0M9.1 6.3a1.9 1.9 0 003.8 0" />
            <path d="M6.2 14v-3.2h3.6V14" />
          </svg>
        </span>
        <span className="nbm-shop-badge-name">{vendorShop}</span>
      </div>
    );
  }

  return (
    <div className="nbm-shop-badge nbm-godown-switch" ref={wrapRef} onClick={() => setOpen((o) => !o)}>
      <span className="nbm-shop-badge-icon">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 6.4L8 2l6.5 4.4V14H1.5V6.4z" />
          <path d="M6 14V9.5h4V14" />
        </svg>
      </span>
      <span className="nbm-shop-badge-name">{active ? active.name : "Select godown"}</span>
      <svg className="nbm-godown-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2.5 3.5L5 6L7.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {open && (
        <div className="nbm-godown-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="nbm-godown-dropdown-title">Switch godown</div>
          {list.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`nbm-godown-item ${String(g.id) === String(activeGodownId) ? "active" : ""}`}
              onClick={() => { setOpen(false); if (String(g.id) !== String(activeGodownId)) onChange(g.id); }}
            >
              <span className="nbm-godown-item-name">{g.name}</span>
              <span className="nbm-godown-item-code">{g.godownCode}</span>
              {g.isDefault && <span className="nbm-godown-item-default">Default</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

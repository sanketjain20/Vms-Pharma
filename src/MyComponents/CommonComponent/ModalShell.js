import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import "../../Styles/CommonComponent/ModalShell.css";

/* ── Shared dialog chrome: backdrop, panel, header (icon/title/close),
   scrollable body, optional footer. Used by StatusModal and DownloadModal
   so every generic (non per-module) dialog in the app reads as one system. ── */
export default function ModalShell({
  open,
  onClose,
  tone = "accent",
  icon,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  hideClose = false,
  busy = false,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && onClose && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  if (!open) return null;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && onClose && !busy) onClose();
  };

  return ReactDOM.createPortal(
    <div className="ms-overlay" onMouseDown={handleBackdrop}>
      <div className={`ms-panel ms-panel--${size}`} ref={panelRef} role="dialog" aria-modal="true">
        <div className={`ms-accent ms-accent--${tone}`} />

        <div className="ms-header">
          {icon && <div className={`ms-icon ms-icon--${tone}`}>{icon}</div>}
          <div className="ms-title-group">
            {title && <div className="ms-title">{title}</div>}
            {subtitle && <div className="ms-subtitle">{subtitle}</div>}
          </div>
          {!hideClose && onClose && (
            <button className="ms-close" onClick={onClose} disabled={busy} aria-label="Close">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="ms-body">{children}</div>

        {footer && <div className="ms-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

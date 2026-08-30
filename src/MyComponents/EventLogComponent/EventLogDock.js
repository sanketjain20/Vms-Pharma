import React, { useState } from "react";
import "../../Styles/EventLog/EventLog.css";
import EventLogPanel from "./EventLogPanel";
import { toAuditModuleKey } from "./moduleKeyMap";

/**
 * Small pill docked just below (or, on phone where the modal becomes a
 * bottom sheet, above) a View/Edit/Payment-collection screen. Opens a
 * right-side panel with that record's change history. Renders nothing when
 * there's no existing record to have history for (e.g. the Add screen).
 */
export default function EventLogDock({ moduleName, uKey }) {
  const [isOpen, setIsOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  if (!uKey || !toAuditModuleKey(moduleName)) return null;

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => { setIsOpen(false); setClosing(false); }, 220);
  };

  return (
    <>
      <button type="button" className="evl-dock" onClick={() => setIsOpen(true)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        Event Log
      </button>

      {isOpen && (
        <>
          <div className={`evl-overlay ${closing ? "evl-overlay-closing" : ""}`} onClick={close} />
          <EventLogPanel moduleName={moduleName} uKey={uKey} onClose={close} closing={closing} />
        </>
      )}
    </>
  );
}

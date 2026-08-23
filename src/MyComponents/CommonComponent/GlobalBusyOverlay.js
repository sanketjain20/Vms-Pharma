import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GLOBAL_BUSY_EVENT } from "../../utils/globalBusy";
import "../../Styles/CommonComponent/GlobalBusyOverlay.css";

export default function GlobalBusyOverlay() {
  const [pendingCount, setPendingCount] = useState(0);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const handleBusyChange = (event) => {
      const { active, label: nextLabel } = event.detail || {};

      if (active) {
        setLabel(nextLabel || "");
        setPendingCount((count) => count + 1);
      } else {
        setPendingCount((count) => Math.max(0, count - 1));
      }
    };

    window.addEventListener(GLOBAL_BUSY_EVENT, handleBusyChange);
    return () => window.removeEventListener(GLOBAL_BUSY_EVENT, handleBusyChange);
  }, []);

  if (!pendingCount) return null;

  const shortLabel = /download|invoice/i.test(label) ? "Downloading" : "Loading";

  return createPortal(
    <div className="gb-overlay" role="status" aria-live="polite" aria-label={shortLabel}>
      <div className="gb-pill">
        <span className="gb-spinner" />
        {shortLabel}
      </div>
    </div>,
    document.body
  );
}

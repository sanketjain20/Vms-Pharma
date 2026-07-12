import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GLOBAL_BUSY_EVENT } from "../../utils/globalBusy";

export default function GlobalBusyOverlay() {
  const [pendingCount, setPendingCount] = useState(0);
  const [label, setLabel] = useState("Processing...");

  useEffect(() => {
    const handleBusyChange = (event) => {
      const { active, label: nextLabel } = event.detail || {};

      if (active) {
        setLabel(nextLabel || "Processing...");
        setPendingCount((count) => count + 1);
      } else {
        setPendingCount((count) => Math.max(0, count - 1));
      }
    };

    window.addEventListener(GLOBAL_BUSY_EVENT, handleBusyChange);
    return () => window.removeEventListener(GLOBAL_BUSY_EVENT, handleBusyChange);
  }, []);

  if (!pendingCount) return null;

  const isDownloading = /download|invoice/i.test(label);
  const title = isDownloading ? "Preparing your download" : "Syncing your workspace";
  const detail = isDownloading
    ? "Your document is being prepared securely"
    : "Your changes are being applied";

  return createPortal(
    <div className="global-busy-overlay" role="status" aria-live="assertive" aria-label={label}>
      <div className="global-busy-dialog">
        <div className="global-busy-orbit" aria-hidden="true">
          <div /><div /><div /><div />
          <span className="global-busy-core" />
        </div>
        <div className="global-busy-copy">
          <span className="global-busy-kicker">VMS · PLEASE WAIT</span>
          <strong>{title}</strong>
          <span>{detail}</span>
        </div>
        <div className="global-busy-progress" aria-hidden="true"><span /></div>
      </div>
    </div>,
    document.body
  );
}

import React, { useCallback, useEffect, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import GstConnectionModal from "./GstConnectionModal";
import { bannerTone, modeTag } from "./gstHelpers";
import "../../Styles/GstShared/GstConnection.css";

/** A small "TEST" tag for a document that was not issued in PRODUCTION (nothing for a real one). */
export function ModeTag({ mode }) {
  const tag = modeTag(mode);
  if (!tag) return null;
  return (
    <span className={`gst-badge gst-badge--${tag.tone} gst-mode-tag`} title={tag.title}>
      {tag.label}
    </span>
  );
}

/**
 * Shown at the top of the e-invoice / e-way bill pages whenever documents are not real: in STUB or SANDBOX mode, or
 * when a remote mode cannot issue yet (and then it says exactly what is missing). Nothing at all once PRODUCTION is
 * ready. "GST connection" opens the settings to save credentials and test the connection.
 */
export default function GstModeBanner() {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    apiClient(`${API_BASE_URL}/api/Gst/Status`, { method: "GET" })
      .then((res) => res.json())
      .then((data) => { if (data.status === 200) setStatus(data.data); })
      .catch(() => {}); // a banner that cannot load must never break the page
  }, []);

  useEffect(() => { load(); }, [load]);

  const tone = status ? bannerTone(status.level) : null;
  if (!status) return null;
  if (!tone) {
    // PRODUCTION and ready: no warning, but the settings stay reachable
    return (
      <>
        <div className="dg-panel gst-mode-wrap gst-mode-live">
          <button type="button" className="gst-btn gst-btn--sm gst-btn--ghost" onClick={() => setOpen(true)}>GST connection</button>
        </div>
        {open && <GstConnectionModal onClose={() => setOpen(false)} onSaved={load} />}
      </>
    );
  }

  return (
    <>
      <div className="dg-panel gst-mode-wrap">
      <div className={`gst-alert gst-alert--${tone} gst-mode-banner`} role="status" data-testid="gst-mode-banner">
        <div className="gst-mode-banner-text">
          <strong>{status.headline}</strong>
          <span>{status.detail}</span>
        </div>
        <button type="button" className="gst-btn gst-btn--sm" onClick={() => setOpen(true)}>GST connection</button>
      </div>
      </div>
      {open && <GstConnectionModal onClose={() => setOpen(false)} onSaved={load} />}
    </>
  );
}

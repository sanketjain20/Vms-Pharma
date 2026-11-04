import React from "react";

/** A small yellow warning: the product has no GST rate yet, so the bill line uses the common rate and is flagged. */
export default function GstMissingNote({ children = "No GST rate on product — common rate used", testId = "product-gst-missing", title = "Set the product's GST rate in Products" }) {
  return (
    <div className="afx-gst-warn" data-testid={testId} title={title} role="note">
      <svg className="afx-gst-warn-icon" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <path d="M12 3 2 21h20L12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 10v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="18" r="1.1" fill="currentColor" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

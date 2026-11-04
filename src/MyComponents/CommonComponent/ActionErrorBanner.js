import React from "react";
import "../../Styles/CommonComponent/ActionErrorBanner.css";

/**
 * Why a grid action (dispatch, receive, cancel, convert…) was refused, above the grid: an icon, the message the server
 * gave, and a close button. Renders nothing without a message.
 */
export default function ActionErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="aeb" role="alert" data-testid="action-error">
      <span className="aeb-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <span className="aeb-text">{message}</span>
      {onDismiss && (
        <button type="button" className="aeb-close" onClick={onDismiss} aria-label="Dismiss" title="Dismiss">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

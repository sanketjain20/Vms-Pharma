import React from "react";
import "../../Styles/CommonComponent/ThemeToggle.css";

export default function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className={`tt-switch ${isLight ? "is-light" : "is-dark"}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      title={`Switch to ${isLight ? "dark" : "light"} mode`}
    >
      <span className="tt-track">
        <span className="tt-thumb">
          {isLight ? (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4L3.3 3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 9.7A6 6 0 1 1 6.3 2.5a4.7 4.7 0 0 0 7.2 7.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>
      <span className="tt-label">{isLight ? "Light" : "Dark"}</span>
    </button>
  );
}

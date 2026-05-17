import React from "react";
import { FaMoon, FaSun } from "react-icons/fa";

export default function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className={`theme-toggle ${isLight ? "light" : "dark"}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      title={`Switch to ${isLight ? "dark" : "light"} mode`}
    >
      <span className="theme-toggle-icon">
        {isLight ? <FaSun /> : <FaMoon />}
      </span>
      <span className="theme-toggle-text">{isLight ? "Light" : "Dark"}</span>
    </button>
  );
}

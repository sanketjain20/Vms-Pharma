import React, { useState, useEffect, useRef } from "react";
import "../../Styles/YearMonthGrid.css";

const YearMonthGrid = ({ label, value, onChange, options, type }) => {
  const [open, setOpen] = useState(false);
  const [yearPage, setYearPage] = useState(new Date().getFullYear());
  const wrapperRef = useRef(null);

  const toggle = () => setOpen((o) => !o);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue =
    type === "month"
      ? options?.find((o) => o.value === value)?.label ?? "—"
      : value;

  const renderMonthGrid = () => (
    <div className="ymg-grid">
      {options.map((opt) => (
        <div
          key={opt.value}
          className={`ymg-item ${value === opt.value ? "ymg-active" : ""}`}
          onClick={() => { onChange(opt.value); setOpen(false); }}
        >
          {opt.label}
        </div>
      ))}
    </div>
  );

  const renderYearGrid = () => {
    const start = yearPage - 5;
    const years = Array.from({ length: 9 }, (_, i) => start + i);
    return (
      <div className="ymg-grid">
        <div
          className="ymg-nav"
          onClick={() => setYearPage((y) => y - 10)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M7 2L3 5L7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {years.map((yr) => (
          <div
            key={yr}
            className={`ymg-item ${value === yr ? "ymg-active" : ""}`}
            onClick={() => { onChange(yr); setOpen(false); }}
          >
            {yr}
          </div>
        ))}

        <div
          className="ymg-nav"
          onClick={() => setYearPage((y) => y + 10)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="ymg-select" ref={wrapperRef}>
      <div className="ymg-row">
        <label className="ymg-label">{label}</label>
        <button
          className={`ymg-display ${open ? "ymg-display-open" : ""}`}
          onClick={toggle}
          type="button"
        >
          <span>{displayValue}</span>
          <svg
            className={`ymg-chevron ${open ? "ymg-chevron-up" : ""}`}
            width="10" height="10" viewBox="0 0 10 10" fill="none"
          >
            <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {open && (
        <div className="ymg-dropdown">
          <div className="ymg-dropdown-beam" />
          {type === "month" ? renderMonthGrid() : renderYearGrid()}
        </div>
      )}
    </div>
  );
};

export default YearMonthGrid;

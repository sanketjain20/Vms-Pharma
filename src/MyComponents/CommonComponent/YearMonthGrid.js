import React, { useState, useEffect, useRef } from "react";
import "../../Styles/YearMonthGrid.css";

const YearMonthGrid = ({ label, value, onChange, options, type }) => {
  const [open, setOpen] = useState(false);
  const [yearPage, setYearPage] = useState(new Date().getFullYear());
  const wrapperRef = useRef(null); // for detecting outside click

  const toggle = () => setOpen(!open);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const renderMonthGrid = () => (
    <div className="grid-box">
      {options.map((opt) => (
        <div
          key={opt.value}
          className={`grid-item ${value === opt.value ? "active" : ""}`}
          onClick={() => {
            onChange(opt.value);
            setOpen(false);
          }}
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
      <div className="grid-box">
        <div className="grid-nav" onClick={() => setYearPage(yearPage - 10)}>◀</div>
        {years.map((yr) => (
          <div
            key={yr}
            className={`grid-item ${value === yr ? "active" : ""}`}
            onClick={() => {
              onChange(yr);
              setOpen(false);
            }}
          >
            {yr}
          </div>
        ))}
        <div className="grid-nav" onClick={() => setYearPage(yearPage + 10)}>▶</div>
      </div>
    );
  };

  return (
    <div className="grid-select" ref={wrapperRef}>
      <div className="grid-label-dropdown">
        <label>{label}</label>
        <div className="grid-display" onClick={toggle}>
          {type === "month"
            ? options.find((o) => o.value === value)?.label
            : value}
        </div>
      </div>

      {open && (
        <div className="grid-dropdown">
          {type === "month" ? renderMonthGrid() : renderYearGrid()}
        </div>
      )}
    </div>
  );
};

export default YearMonthGrid;

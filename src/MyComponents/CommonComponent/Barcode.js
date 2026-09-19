import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/**
 * Renders a scannable Code128 barcode for `value` into an inline SVG.
 * Code128 (not EAN13) because it accepts any ASCII text — product codes
 * here look like "SAN-PRD000001", which EAN13 can't encode.
 */
export default function Barcode({ value, height = 50, width = 1.6, fontSize = 12, className }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        height,
        width,
        fontSize,
        margin: 6,
        displayValue: true,
      });
    } catch {
      // Characters JsBarcode's Code128 tables can't encode (rare) — leave
      // the SVG empty rather than crash the surrounding view.
    }
  }, [value, height, width, fontSize]);

  if (!value) return null;

  return <svg ref={svgRef} className={className} role="img" aria-label={`Barcode ${value}`} />;
}

const escapeHtml = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Opens a small print-only window with the barcode + label text, and
 * triggers the browser print dialog. Renders the SVG in this document
 * (so JsBarcode is already loaded) then serializes it into the popup,
 * rather than trying to load the library inside the new window. */
export function printBarcodeLabel(value, title) {
  if (!value) return;

  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svgEl, value, {
    format: "CODE128",
    height: 60,
    width: 2,
    fontSize: 14,
    margin: 8,
    displayValue: true,
  });
  const svgMarkup = new XMLSerializer().serializeToString(svgEl);

  const win = window.open("", "_blank", "width=420,height=320");
  if (!win) return;

  win.document.write(`<!doctype html>
<html>
<head>
<title>Barcode Label</title>
<style>
  body { font-family: system-ui, sans-serif; text-align: center; padding: 20px; }
  .bc-label-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
</style>
</head>
<body>
  <div class="bc-label-title">${escapeHtml(title || "")}</div>
  ${svgMarkup}
</body>
</html>`);
  win.document.close();
  win.focus();
  win.print();
}

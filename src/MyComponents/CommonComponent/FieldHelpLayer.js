import React, { useCallback, useEffect, useRef, useState } from "react";
import "../../Styles/CommonComponent/FieldHelp.css";
import { helpFor } from "../../utils/fieldHelp";

/** Field labels on the Add / Edit / View screens (forms, modals, detail cards, settings rows). */
const LABELS = "label, .afx-label, .afx-meta-card-label, .afx-checkbox-label, .st-row-name, .acx-field-k";
/** Never in a list's grid, the menus or the top bar: the ⓘ is for fields, not columns. */
const OUTSIDE = ".dg-panel, .sb-root, nav, header, [data-no-help]";
const BOX_ID = "fh-descriptions";

/** A label's own words, leaving out an ⓘ already added to it and any control inside it. */
function labelText(el) {
  let text = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === 1 && n.classList.contains("fh-i")) return;
    if (n.nodeType === 1 && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(n.tagName)) return;
    text += n.textContent;
  });
  return text;
}

/** The field a label belongs to: its own control, one inside it, or the first one in the same field box. */
function controlOf(el) {
  if (el.control) return el.control;
  const inside = el.querySelector("input, select, textarea");
  if (inside) return inside;
  const box = el.closest(".afx-field, .st-row, .acx-field");
  return box ? box.querySelector("input, select, textarea") : null;
}

/** One hidden element per explanation, for screen readers (aria-describedby on the field points at it). */
function descriptionId(text) {
  let box = document.getElementById(BOX_ID);
  if (!box) {
    box = document.createElement("div");
    box.id = BOX_ID;
    box.className = "fh-sr";
    document.body.appendChild(box);
  }
  const existing = [...box.children].find((c) => c.textContent === text);
  if (existing) return existing.id;
  const d = document.createElement("span");
  d.id = `fh-d${box.children.length + 1}`;
  d.textContent = text;
  box.appendChild(d);
  return d.id;
}

/** Points the field at its explanation (or, with no id, takes ours off), keeping any description it already had. */
function describe(control, id) {
  if (!control) return;
  const ids = (control.getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && !x.startsWith("fh-d"));
  const next = id ? [...ids, id] : ids;
  if (next.length) control.setAttribute("aria-describedby", next.join(" "));
  else control.removeAttribute("aria-describedby");
}

/** Adds (or takes away) the ⓘ on every field label whose words have an explanation. */
export function attachHelp(root = document.body, pathname = window.location.pathname) {
  root.querySelectorAll(LABELS).forEach((el) => {
    if (el.closest(OUTSIDE)) return;
    const help = helpFor(labelText(el), pathname);
    let icon = el.querySelector(":scope > .fh-i");
    if (!help) {
      if (icon) {
        icon.remove();
        describe(controlOf(el), null);
      }
      return;
    }
    if (!icon) {
      // for the mouse and touch; hidden from screen readers, which hear the help with the field itself
      icon = document.createElement("button");
      icon.type = "button";
      icon.className = "fh-i";
      icon.tabIndex = -1;
      icon.setAttribute("aria-hidden", "true");
      el.appendChild(icon);
    }
    icon.dataset.help = help;
    icon.title = "";
    describe(controlOf(el), descriptionId(help));
  });
}

/**
 * The ⓘ next to the important fields of every Add / Edit / View screen: hover or tap it to read what the field is
 * about (screen readers hear it with the field). It watches the page, so screens and modals that open later — and new
 * modules — get it too; the explanations live in utils/fieldHelp.js, keyed by the label.
 */
export default function FieldHelpLayer() {
  const [tip, setTip] = useState(null); // { text, x, y, above, width }
  const timer = useRef(null);

  const scan = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => attachHelp(), 60);
  }, []);

  useEffect(() => {
    attachHelp();
    const ours = (n) => n.nodeType === 1 && (n.classList?.contains("fh-i") || n.id === BOX_ID || n.parentElement?.id === BOX_ID);
    const watch = new MutationObserver((changes) => {
      if (changes.every((c) => c.type === "childList" && [...c.addedNodes, ...c.removedNodes].every(ours))) return; // our own
      scan();
    });
    watch.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("popstate", scan);
    return () => { watch.disconnect(); window.removeEventListener("popstate", scan); clearTimeout(timer.current); };
  }, [scan]);

  useEffect(() => {
    let pinned = null; // the ⓘ tapped open (stays until tapped again, elsewhere, or Esc)
    const iconOf = (e) => e.target?.closest?.(".fh-i");
    const show = (icon) => {
      const r = icon.getBoundingClientRect();
      const width = Math.min(300, window.innerWidth - 24);
      const x = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12));
      const below = r.bottom + 8 + 120 < window.innerHeight;
      setTip({ text: icon.dataset.help, x, y: below ? r.bottom + 8 : r.top - 8, above: !below, width });
    };
    const hide = () => { pinned = null; setTip(null); };
    const over = (e) => { const i = iconOf(e); if (i) show(i); };
    const out = (e) => { if (iconOf(e) && !pinned) setTip(null); };
    const click = (e) => {
      const i = iconOf(e);
      if (!i) { if (pinned) hide(); return; }
      e.preventDefault(); // a tap inside a <label> must not jump into its field
      e.stopPropagation();
      if (pinned === i) { hide(); return; }
      pinned = i;
      show(i);
    };
    const key = (e) => { if (e.key === "Escape") hide(); };
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className={`fh-tip ${tip.above ? "fh-tip--above" : ""}`} data-testid="field-help" aria-hidden="true"
      style={{ left: tip.x, top: tip.y, width: tip.width }}>
      {tip.text}
    </div>
  );
}

import fs from "fs";
import path from "path";

// The toast look lives in CSS only; these checks pin the rules the shop asked for, so a later edit can't quietly
// bring back the blue side border or the narrow card.
const css = fs.readFileSync(path.join(__dirname, "Toast.css"), "utf8");
/** The body of the rule for exactly this selector (spaces before "{" allowed), or "". */
const rule = (selector) => {
  const at = css.split("\n").findIndex((line) => line.startsWith(selector) && /^\s*\{/.test(line.slice(selector.length)));
  if (at < 0) return "";
  const rest = css.split("\n").slice(at).join("\n");
  return rest.slice(0, rest.indexOf("}") + 1);
};

describe("Toast styles", () => {
  it("has no coloured side border (it used to make every toast blue on the left)", () => {
    expect(css).not.toMatch(/border-left/);
    expect(rule(".Toastify__toast-container .Toastify__toast")).toContain("border: 1px solid var(--tc-border)");
  });

  it("is at least half the screen wide, and full width on a phone", () => {
    expect(css).toContain("--toastify-toast-width: max(50vw, 360px)");
    expect(rule(".Toastify__toast-container .Toastify__toast")).toContain("width: var(--toastify-toast-width)");
    expect(css).toMatch(/@media \(max-width: 768px\) \{\s*\.Toastify__toast-container \{ --toastify-toast-width: 100%/);
  });

  it("the card is black in the dark theme and white in the light theme", () => {
    expect(rule(".Toastify__toast-container")).toContain("--tc-bg:      #0b0b0f");
    expect(rule('body[data-theme="light"] .Toastify__toast-container')).toContain("--tc-bg:      #ffffff");
    expect(rule(".Toastify__toast-container .Toastify__toast")).toContain("background: var(--tc-bg)");
  });

  it("the action colour is only on the bottom line (and the icon): green, red, yellow, blue", () => {
    expect(rule(".Toastify__toast-container .Toastify__progress-bar--success")).toContain("var(--tc-success)");
    expect(rule(".Toastify__toast-container .Toastify__progress-bar--error")).toContain("var(--tc-error)");
    expect(rule(".Toastify__toast-container .Toastify__progress-bar--warning")).toContain("var(--tc-warning)");
    expect(rule(".Toastify__toast-container .Toastify__progress-bar--info")).toContain("var(--tc-info)");
    expect(rule(".Toastify__toast-container .Toastify__progress-bar--default")).toContain("var(--tc-muted)");
    // the library's rainbow (light) and purple (dark) theme bars are replaced
    expect(css).toContain("--toastify-color-progress-light:   var(--tc-muted)");
    expect(css).toContain("--toastify-color-progress-dark:    var(--tc-muted)");
  });

  it("uses only the two theme colours and the four action colours", () => {
    const hexes = [...new Set(css.match(/#[0-9a-fA-F]{6}\b/g))].sort();
    expect(hexes).toEqual([
      "#059669", "#0b0b0f", "#0f172a", "#10b981", "#2563eb", "#3b82f6", "#64748b", "#a1a1aa",
      "#d97706", "#dc2626", "#ef4444", "#f59e0b", "#f5f5f7", "#ffffff",
    ].sort());
  });
});

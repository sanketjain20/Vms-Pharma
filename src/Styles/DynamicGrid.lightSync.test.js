import fs from "fs";
import path from "path";

// The light theme (Theme.css) recolours pages by class-name fragment with !important. Inside the grid, DynamicGrid.css
// puts the grid's own colours back so light looks like dark. These checks pin that: each coloured part has a light
// rule using the same token as in dark, and that rule out-ranks the generic light rule that used to win.
const grid = fs.readFileSync(path.join(__dirname, "DynamicGrid.css"), "utf8");
const theme = fs.readFileSync(path.join(__dirname, "Theme.css"), "utf8");

/** CSS specificity [ids, classes+attributes+pseudo-classes, elements] of one selector (enough for these selectors). */
function specificity(selector) {
  let s = selector;
  let classes = 0;
  // :not(x) counts as x
  s = s.replace(/:not\(([^)]*)\)/g, (_, inner) => { const [, c, e] = specificity(inner); classes += c; return " ".repeat(e ? 1 : 0); });
  classes += (s.match(/\[[^\]]*\]/g) || []).length; s = s.replace(/\[[^\]]*\]/g, "");
  classes += (s.match(/\.[\w-]+/g) || []).length; s = s.replace(/\.[\w-]+/g, "");
  classes += (s.match(/:(?!:)[\w-]+/g) || []).length; s = s.replace(/:[\w-]+/g, "");
  const elements = (s.match(/(^|[\s>+~])[a-z]+/gi) || []).length;
  return [0, classes, elements];
}
const beats = (a, b) => (a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2]);

/** The light sync rule for a part: its selector and body. */
function lightRule(part) {
  const re = new RegExp(`(body\\[data-theme="light"\\] \\.dg-panel\\.dg-panel\\.dg-panel\\.dg-panel ${part.replace(/\./g, "\\.")})\\s*\\{([^}]*)\\}`);
  const m = re.exec(grid);
  return m ? { selector: m[1], body: m[2] } : null;
}

describe("DynamicGrid — light theme looks like dark", () => {
  it.each([
    [".dg-export-btn.dg-export-btn", "--dg-teal"],
    [".dg-icon-btn.dg-icon-btn--edit", "--dg-accent"],
    [".dg-icon-btn.dg-icon-btn--view", "--dg-slate"],
    [".dg-icon-btn.dg-icon-btn--activate", "--dg-success"],
    [".dg-icon-btn.dg-icon-btn--download", "--dg-warning"],
    [".dg-icon-btn.dg-icon-btn--payment", "--dg-teal"],
    [".dg-icon-btn.dg-icon-btn--disable", "--dg-danger"],
    [".dg-stat-card.dg-stat-card--green", "--dg-success"],
    [".dg-stat-card.dg-stat-card--red", "--dg-danger"],
    [".dg-tab.dg-tab--active", "--dg-accent"],
    [".dg-tab.dg-tab--amber.dg-tab--active", "--dg-warning"],
    [".dg-pager-cur.dg-pager-cur", "--dg-accent"],
    [".dg-colpick-btn.dg-colpick-btn", "--dg-accent"],
  ])("%s keeps its %s colour in light mode", (part, token) => {
    const rule = lightRule(part);
    expect(rule).not.toBeNull();
    expect(rule.body).toContain(`var(${token})`);
    expect(rule.body).toContain("!important");
  });

  it("the light tokens are the dark ones, only darker shades for a white page", () => {
    const light = /body\[data-theme="light"\] \.dg-panel \{([^}]*)\}/.exec(grid)[1];
    ["--dg-teal", "--dg-accent", "--dg-success", "--dg-danger", "--dg-warning", "--dg-slate"].forEach((t) => expect(light).toContain(`${t}:`));
  });

  it("each light rule out-ranks the generic light button rule that greyed the grid out", () => {
    const generic = /body\[data-theme="light"\] button:not\(\[class\*="primary"\]\)[^,{]*/.exec(theme)[0];
    [".dg-export-btn.dg-export-btn", ".dg-icon-btn.dg-icon-btn--edit", ".dg-tab.dg-tab--active", ".dg-pager-btn.dg-pager-btn"].forEach((part) => {
      expect(beats(specificity(lightRule(part).selector), specificity(generic))).toBe(true);
    });
  });

  it("the columns button is an icon with a dot, not a count", () => {
    expect(grid).toMatch(/\.dg-colpick-dot \{/);
    expect(grid).not.toMatch(/\.dg-colpick-count/);
  });
});

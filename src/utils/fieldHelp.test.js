import fs from "fs";
import path from "path";
import { helpKey, helpFor, HELP_KEYS } from "./fieldHelp";

describe("field help — which label gets which explanation", () => {
  it("reads a label the way it shows on screen", () => {
    expect(helpKey("Credit Limit (₹)*")).toBe("credit limit");
    expect(helpKey("  Selling Price (₹) : ")).toBe("selling price");
    expect(helpKey("Ref / txn no. (optional)")).toBe("ref / txn no.");
    expect(helpKey("Certificate Rate (%)")).toBe("certificate rate");
  });

  it("explains the important fields and leaves plain ones alone", () => {
    expect(helpFor("Credit Limit (₹)")).toMatch(/most this retailer may owe you.*0 = no limit/);
    expect(helpFor("HSN Code")).toMatch(/GST tariff code/);
    expect(helpFor("Shop Name")).toBeNull();
    expect(helpFor("Phone")).toBeNull();
    expect(helpFor("")).toBeNull();
  });

  it("a label that means something else on one screen gets that screen's text", () => {
    expect(helpFor("Free quantity", "/master/purchase")).toMatch(/supplier gives free/);
    expect(helpFor("Free quantity", "/master/scheme")).toMatch(/customer gets free/);
    expect(helpFor("Refund Mode", "/master/sales-return")).toMatch(/Credit Note keeps it against what they owe you/);
    expect(helpFor("Refund Mode", "/master/purchase-return")).toMatch(/Debit Note/);
    expect(helpFor("Refund Mode", "/master/sales")).toBeNull();
    expect(helpFor("Money", "/master/accounting")).toMatch(/In \(credit\)/);
  });

  it("every explanation belongs to a label that is really on a screen (a renamed label must keep its help)", () => {
    const labels = new Set();
    const walk = (dir) => fs.readdirSync(dir).forEach((f) => {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) return walk(p);
      if (!/\.js$/.test(f) || /test/.test(f)) return;
      const t = fs.readFileSync(p, "utf8");
      const patterns = [
        /<label[^>]*>(?:\s*<input(?:[^>]|=>)*\/>(?:\{" "\})?)?\s*([A-Za-z][^<{]{1,160})/g, // <label>Text</label>, or a checkbox then text
        /(?<![-\w])label:\s*"([^"]{2,160})"/g,                                     // field configs { label: "…" }
        /<(?:Field|ViewField|FieldCard|Card|Row)\b[^>]*\blabel="([^"]+)"/g,        // view cards and settings rows
        /className="(?:afx-meta-card-label|acx-field-k)">([^<]{2,60})</g,
      ];
      patterns.forEach((re) => { let m; while ((m = re.exec(t))) labels.add(helpKey(m[1])); });
    });
    walk(path.join(__dirname, "..", "MyComponents"));
    const missing = HELP_KEYS.filter((k) => !labels.has(k));
    expect(missing).toEqual([]);
  });
});

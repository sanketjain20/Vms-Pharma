// Standard GST state/UT codes (as published by CBIC), mirroring the backend
// list in VMS2 Utils/GstStateCodeUtil.java — keep the two in sync.
// Used by Vendor/Retailer/Supplier forms (state dropdown, GSTIN -> state
// auto-select) and anywhere a place-of-supply needs a human label.
export const GST_STATE_CODES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "25", name: "Daman and Diu" },
  { code: "26", name: "Dadra and Nagar Haveli" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (Old)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
  { code: "99", name: "Centre Jurisdiction" },
];

const STATE_NAME_BY_CODE = Object.fromEntries(GST_STATE_CODES.map((s) => [s.code, s.name]));

export function stateNameForCode(code) {
  if (!code) return null;
  return STATE_NAME_BY_CODE[code] || null;
}

/**
 * Derives the 2-digit GST state code from the first two characters of a
 * GSTIN. Returns null if the GSTIN is missing, too short, its first two
 * characters aren't digits, or the resulting code isn't a known state code.
 * Mirrors GstStateCodeUtil.stateCodeFromGstin on the backend.
 */
export function stateCodeFromGstin(gstin) {
  if (!gstin) return null;
  const trimmed = String(gstin).trim().toUpperCase();
  if (trimmed.length < 2) return null;
  const code = trimmed.slice(0, 2);
  if (!/^\d{2}$/.test(code)) return null;
  return STATE_NAME_BY_CODE[code] ? code : null;
}

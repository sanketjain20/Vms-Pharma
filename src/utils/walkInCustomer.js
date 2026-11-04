// The walk-in customer typed on a bill: an optional name and an optional mobile number.
// Mirrors the backend's Utils/WalkInCustomer.java so the screen refuses exactly what the server would:
//   - only for a bill with no retailer (a retailer bill already has its customer, so nothing is sent);
//   - name trimmed, at most 150 characters;
//   - mobile = Indian 10-digit mobile (first digit 6–9); spaces, dashes, dots and brackets are ignored
//     and a leading +91 / 91 / 0 is removed, so "+91 98765-43210" is sent as "9876543210".

export const MAX_NAME_LENGTH = 150;

/** The 10-digit mobile in `raw`, or null if it is not a valid Indian mobile number. */
export function normalizeMobile(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.length === 12 && s.startsWith("91")) s = s.slice(2);
  else if (s.length === 11 && s.startsWith("0")) s = s.slice(1);
  return /^[6-9]\d{9}$/.test(s) ? s : null;
}

/**
 * @returns {{ customerName: string|null, customerPhone: string|null, errors: { customerName?: string, customerPhone?: string } }}
 *          the values to send (both null for a retailer bill) and any field errors to show.
 */
export function resolveWalkIn({ retailerId, name, phone }) {
  if (retailerId) return { customerName: null, customerPhone: null, errors: {} };

  const errors = {};
  const cleanName = String(name ?? "").trim().replace(/\s+/g, " ");
  if (cleanName.length > MAX_NAME_LENGTH) errors.customerName = `Customer name can be at most ${MAX_NAME_LENGTH} characters`;

  let cleanPhone = null;
  if (String(phone ?? "").trim() !== "") {
    cleanPhone = normalizeMobile(phone);
    if (!cleanPhone) errors.customerPhone = "Enter a valid 10-digit mobile number";
  }
  return { customerName: cleanName || null, customerPhone: cleanPhone, errors };
}

/** "9876543210" → "98765 43210" for display. */
export function formatMobile(phone) {
  const p = normalizeMobile(phone);
  return p ? `${p.slice(0, 5)} ${p.slice(5)}` : (phone || "");
}

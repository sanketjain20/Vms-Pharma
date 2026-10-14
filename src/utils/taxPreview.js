// Client-side preview of the threshold-excess tax engine — mirrors VMS2's
// Utils/TcsCalculator.java + Utils/PanUtil.java exactly, since both sides
// share that one pure calculator:
//   * Sales/PaymentCollect — retailer-side 194Q estimate (TCS 206C(1H)
//     itself was withdrawn 1 April 2025; this is informational only, never
//     withheld — see Entity/Sales.java's Javadoc).
//   * Purchase/SupplierPaymentAdd — supplier-side 194Q, still real tax,
//     genuinely withheld and deposited.
// Named generically (not "tcsPreview") so both sides can share it instead
// of duplicating the same math.
//
// This is a preview only. The backend recalculates authoritatively against
// the party's true financial-year cumulative turnover at the moment the
// sale/purchase/payment is actually posted (PartyTurnoverCommonRepository,
// under a row lock), so a concurrent transaction for the same party between
// this preview and submit can still shift the final number slightly.

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function isValidPan(pan) {
  return !!pan && PAN_PATTERN.test(String(pan).trim().toUpperCase());
}

/** The PAN embedded in a 15-character GSTIN (characters 3-12), or null. */
export function panFromGstin(gstin) {
  if (!gstin) return null;
  const normalised = String(gstin).trim().toUpperCase();
  if (normalised.length !== 15) return null;
  const candidate = normalised.substring(2, 12);
  return isValidPan(candidate) ? candidate : null;
}

export function partyHasPan(pan, gstNumber) {
  return isValidPan(pan) || panFromGstin(gstNumber) !== null;
}

/**
 * @param cumulativeBefore  retailer's FY cumulative consideration so far (0 if none/unknown)
 * @param consideration     this sale's GST-inclusive, discount-net amount (pre-TCS)
 * @param threshold          vendor's configured TCS threshold
 * @param ratePercent         rate applied when the retailer has a PAN
 * @param ratePercentWithoutPan rate applied when the retailer has no PAN
 * @param hasPan             whether the retailer has a valid PAN (or one derivable from GSTIN)
 */
export function calculateTcsPreview({
  cumulativeBefore = 0,
  consideration = 0,
  threshold = 0,
  ratePercent = 0,
  ratePercentWithoutPan = 0,
  hasPan = false,
}) {
  const zero = { taxable: 0, rate: 0, tcs: 0 };
  if (!(consideration > 0)) return zero;

  const cumulativeAfter = (cumulativeBefore || 0) + consideration;
  let taxable = cumulativeAfter - (threshold || 0);
  if (!(taxable > 0)) return zero;
  if (taxable > consideration) taxable = consideration;
  taxable = Math.round(taxable * 100) / 100;

  const rate = hasPan ? (ratePercent || 0) : (ratePercentWithoutPan || 0);
  const tcs = Math.round(taxable * rate) / 100;

  return { taxable, rate, tcs };
}

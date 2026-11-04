// A cancelled (voided) bill: the server keeps its number, sets its value to zero and saves what it held as a snapshot.
// The Sales View shows the bill as it was, marked Cancelled.

/** The sale to show: for a cancelled bill, what it held (from the snapshot) with the cancellation details on top. */
export function withCancelledSnapshot(sale) {
  if (!sale || !sale.cancelled || !sale.cancelledSnapshot) return sale;
  try {
    const before = JSON.parse(sale.cancelledSnapshot);
    return {
      ...before,
      uKey: sale.uKey,
      invoiceNumber: sale.invoiceNumber,
      cancelled: true,
      cancelledAt: sale.cancelledAt,
      cancelledByName: sale.cancelledByName,
      cancelReason: sale.cancelReason,
      remainingAmount: 0, // nothing is owed on a cancelled bill
    };
  } catch {
    return sale; // an unreadable snapshot: show the (zeroed) bill as it is now
  }
}

/** "30-10-2026 14:05" from an ISO date-time; "" when missing. */
export function cancelledWhen(iso) {
  if (!iso) return "";
  const [date, time = ""] = String(iso).split("T");
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}${time ? ` ${time.slice(0, 5)}` : ""}`;
}

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import SalesView from "./SalesView";

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          status: 200,
          data: {
            id: 26,
            invoiceNumber: "INV000026",
            billingMode: "CASH",
            createdAt: "2026-07-16",
            retailerName: null,
            paymentType: "PAID",
            remainingAmount: 0,
            dueDate: null,
            totalAmount: 480,
            totalTax: 84.6,
            totalDiscount: 10,
            netAmount: 554.6,
            items: [
              {
                product: "Paracetamol 500mg",
                batchNumberSnapshot: "B12345",
                expiryDateSnapshot: "2027-01-01",
                hsnCodeSnapshot: "3004",
                quantity: 2,
                sellingPrice: 240,
                taxAmount: 84.6,
                subtotal: 480,
                expiryStatus: "OK",
              },
            ],
          },
        }),
    })
  );
});

test("diagnostic: does the line-item row actually render into the DOM", async () => {
  const { container } = render(<SalesView uKey="test-ukey" onClose={() => {}} />);

  await waitFor(() => screen.getByText(/Invoice · INV000026/i), { timeout: 5000 });

  const table = container.querySelector(".afx-line-table table");
  // eslint-disable-next-line no-console
  console.log("=== TABLE FOUND? ===", !!table);

  const rows = container.querySelectorAll(".afx-line-table tbody tr");
  // eslint-disable-next-line no-console
  console.log("=== ROW COUNT ===", rows.length);

  const sectionTitle = container.querySelector(".afx-section-title");
  // eslint-disable-next-line no-console
  console.log("=== SECTION TITLE TEXT ===", sectionTitle?.textContent);

  // eslint-disable-next-line no-console
  console.log("=== BODY INNER HTML (between section title and totals) ===");
  const body = container.querySelector(".afx-body");
  // eslint-disable-next-line no-console
  console.log(body.innerHTML);
});

import { render, screen } from "@testing-library/react";
import EwayBill from "./EwayBill";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

describe("EwayBill list page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the page title and an empty state on first load", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: { content: [], totalPages: 1, totalElements: 0 } }));

    render(<EwayBill />);

    expect(screen.getByText("E-Way Bills")).toBeInTheDocument();
    expect(await screen.findByText(/No e-way bills generated yet\./i)).toBeInTheDocument();
  });

  it("lists e-way bills with supply direction, status, and Cancel/Extend actions when eligible", async () => {
    apiClient.mockReturnValue(
      jsonResponse({
        status: 200,
        data: {
          content: [
            {
              uKey: "ewb-1",
              ewayBillNo: "123456789012",
              supplyType: "O",
              docNo: "INV00001",
              fromGstin: "27AAPFU0939F1ZV",
              toGstin: "07AAPFU0939F1ZX",
              transportDistanceKm: 250,
              status: "GENERATED",
              validUpto: "2026-03-16T23:59:59",
              cancellable: true,
              extendable: true,
            },
          ],
          totalPages: 1,
          totalElements: 1,
        },
      })
    );

    render(<EwayBill />);

    expect(await screen.findByText("123456789012")).toBeInTheDocument();
    expect(screen.getByText("Outward (Sales)")).toBeInTheDocument();
    expect(screen.getByText("250 km")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("marks an inward (purchase) e-way bill correctly and shows no actions once cancelled", async () => {
    apiClient.mockReturnValue(
      jsonResponse({
        status: 200,
        data: {
          content: [
            {
              uKey: "ewb-2",
              ewayBillNo: "223456789012",
              supplyType: "I",
              docNo: "PUR00001",
              fromGstin: "07AAPFU0939F1ZX",
              toGstin: "27AAPFU0939F1ZV",
              transportDistanceKm: 100,
              status: "CANCELLED",
              validUpto: "2026-03-16T23:59:59",
              cancellable: false,
              extendable: false,
            },
          ],
          totalPages: 1,
          totalElements: 1,
        },
      })
    );

    render(<EwayBill />);

    expect(await screen.findByText("Inward (Purchase)")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Extend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});

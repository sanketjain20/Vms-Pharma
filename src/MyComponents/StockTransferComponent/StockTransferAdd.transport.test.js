import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StockTransferAdd from "./StockTransferAdd";
import StockTransferView from "./StockTransferView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const godownDropdown = [
  { id: 1, name: "Main Warehouse" },
  { id: 2, name: "Regional Store" },
];
const productList = [{ id: 101, name: "Paracetamol 500mg" }];

function mockApi() {
  apiClient.mockImplementation((url, options) => {
    if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
    if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
    if (options?.method === "POST") return jsonResponse({ status: 200, data: {} });
    return jsonResponse({ status: 200, data: null });
  });
}

function postedBody() {
  const call = apiClient.mock.calls.find(([, options]) => options?.method === "POST");
  return call ? JSON.parse(call[1].body) : null;
}

async function fillRequired() {
  render(<StockTransferAdd onSubmit={() => {}} onClose={() => {}} />);
  await waitFor(() => expect(screen.queryByText(/Loading godowns and products/i)).not.toBeInTheDocument());
  fireEvent.click(screen.getAllByText("Search godowns…")[0]);
  fireEvent.mouseDown(await screen.findByText("Main Warehouse"));
  fireEvent.click(screen.getAllByText("Search godowns…")[0]);
  fireEvent.mouseDown(await screen.findByText("Regional Store"));
}

async function addProductAndSave() {
  fireEvent.click(screen.getByText(/Items/));
  fireEvent.click(screen.getByText("Select product"));
  fireEvent.mouseDown(await screen.findByText("Paracetamol 500mg"));
  fireEvent.click(screen.getByRole("button", { name: /Save Stock Transfer/i }));
}

describe("StockTransferAdd — transporter and expected arrival", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi();
  });

  it("POSTs the transporter and expected arrival date", async () => {
    await fillRequired();
    fireEvent.change(screen.getByLabelText("Transporter"), { target: { value: "Fast Cargo" } });
    fireEvent.change(screen.getByLabelText("Expected arrival"), { target: { value: "2099-01-05" } });

    await addProductAndSave();

    await waitFor(() => expect(postedBody()).not.toBeNull());
    expect(postedBody()).toMatchObject({ transporter: "Fast Cargo", expectedDate: "2099-01-05" });
  });

  it("sends null transport details when they are left empty", async () => {
    await fillRequired();
    await addProductAndSave();

    await waitFor(() => expect(postedBody()).not.toBeNull());
    expect(postedBody()).toMatchObject({ transporter: null, expectedDate: null });
  });

  it("blocks an expected arrival before the transfer date", async () => {
    await fillRequired();
    fireEvent.change(screen.getByLabelText("Expected arrival"), { target: { value: "2000-01-01" } });

    await addProductAndSave();

    fireEvent.click(screen.getByText("Details"));
    expect(await screen.findByText("Expected arrival cannot be before the transfer date")).toBeInTheDocument();
    expect(postedBody()).toBeNull();
  });
});

describe("StockTransferView — transport details", () => {
  it("shows the transporter and expected arrival", async () => {
    apiClient.mockReturnValue(jsonResponse({
      status: 200,
      data: {
        uKey: "st-1", transferNumber: "ST000001", fromGodownName: "Main Warehouse", toGodownName: "Regional Store",
        transferDate: "2026-10-01", expectedDate: "2026-10-03", status: "IN_TRANSIT", vehicleNumber: "GJ01",
        transporter: "Fast Cargo", items: [],
      },
    }));

    render(<StockTransferView uKey="st-1" onClose={() => {}} />);

    expect(await screen.findByText("Fast Cargo")).toBeInTheDocument();
    expect(screen.getByText("2026-10-03")).toBeInTheDocument();
  });
});

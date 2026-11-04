import apiClient from "../Config/apiClient";
import {
  checkCustomItem, toCustomLine, formFromLine, customTax, fetchCustomItemSetting, saveCustomItemSetting,
  CUSTOM_GST_SLABS, MAX_ITEM_NAME_LENGTH,
} from "./customItems";

jest.mock("../Config/apiClient");

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const form = (o) => ({ name: "Alteration", quantity: "1", price: "100", gstRate: "0", hsnCode: "", costPrice: "", ...o });

describe("checkCustomItem — mirrors the server's CustomSaleItem rules", () => {
  it("cleans a valid item", () => {
    const { errors, line } = checkCustomItem(form({ name: "  Blue   kurta ", quantity: "2", price: "450.5", gstRate: "5", hsnCode: " 6109 10 ", costPrice: "300" }));
    expect(errors).toEqual({});
    expect(line).toEqual({ name: "Blue kurta", quantity: 2, price: 450.5, gstRate: 5, hsnCode: "610910", costPrice: 300 });
  });

  it("blank GST, HSN and cost mean 0%, none and unknown", () => {
    expect(checkCustomItem(form({ gstRate: "" })).line).toMatchObject({ gstRate: 0, hsnCode: null, costPrice: null });
  });

  it("refuses a missing or too long name", () => {
    expect(checkCustomItem(form({ name: "  " })).errors.name).toBe("Enter a name for the item");
    expect(checkCustomItem(form({ name: "x".repeat(MAX_ITEM_NAME_LENGTH) })).line).not.toBeNull();
    expect(checkCustomItem(form({ name: "x".repeat(MAX_ITEM_NAME_LENGTH + 1) })).errors.name).toMatch(/200/);
  });

  it.each([["0"], ["-1"], ["1.5"], [""]])("refuses quantity %p", (q) => {
    expect(checkCustomItem(form({ quantity: q })).errors.quantity).toBeTruthy();
  });

  it.each([["0"], ["-5"], [""], ["abc"]])("refuses price %p", (p) => {
    expect(checkCustomItem(form({ price: p })).errors.price).toBe("Enter a price above zero");
  });

  it("accepts every offered GST slab and refuses anything else", () => {
    CUSTOM_GST_SLABS.forEach((r) => expect(checkCustomItem(form({ gstRate: String(r) })).line).not.toBeNull());
    expect(checkCustomItem(form({ gstRate: "13" })).errors.gstRate).toBe("Choose a GST rate");
  });

  it("HSN must be 4, 6 or 8 digits when given", () => {
    ["6109", "610910", "61091000"].forEach((h) => expect(checkCustomItem(form({ hsnCode: h })).line.hsnCode).toBe(h));
    ["610", "61091", "61A9"].forEach((h) => expect(checkCustomItem(form({ hsnCode: h })).errors.hsnCode).toBeTruthy());
  });

  it("a negative cost is refused", () => {
    expect(checkCustomItem(form({ costPrice: "-1" })).errors.costPrice).toBeTruthy();
    expect(checkCustomItem(form({ costPrice: "0" })).line.costPrice).toBe(0);
  });
});

describe("custom lines", () => {
  it("toCustomLine builds a line the sales screens can show, with its tax from its own GST %", () => {
    const line = toCustomLine({ name: "Saree", quantity: 2, price: 500, gstRate: 5, hsnCode: null, costPrice: null }, 7);
    expect(line).toMatchObject({
      lineKey: 7, custom: true, productId: null, productName: "Saree", itemName: "Saree", quantity: 2, sellingPrice: 500,
      gstRate: 5, taxAmount: 50, totalAmount: 1050, schemeOff: true, schemeId: null, batchId: null,
    });
    expect(customTax({ sellingPrice: 10, quantity: 3, gstRate: 18 })).toBeCloseTo(5.4);
  });

  it("formFromLine fills the form for editing, or gives an empty one", () => {
    expect(formFromLine(null)).toEqual({ name: "", quantity: "1", price: "", gstRate: "0", hsnCode: "", costPrice: "" });
    expect(formFromLine({ itemName: "Saree", quantity: 2, sellingPrice: 500, gstRate: 5, hsnCode: "5007", costPrice: 300 }))
      .toEqual({ name: "Saree", quantity: "2", price: "500", gstRate: "5", hsnCode: "5007", costPrice: "300" });
  });
});

describe("the shop's switch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads it", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, data: { allowCustomItems: true, canChange: false } }));
    await expect(fetchCustomItemSetting()).resolves.toEqual({ allowCustomItems: true, roundBillTotal: true, canChange: false });
    expect(apiClient.mock.calls[0][0]).toMatch(/\/api\/Sales\/CustomItemSetting$/);
  });

  it("stays off when it can't be read (older backend or offline)", async () => {
    apiClient.mockImplementation(() => Promise.reject(new Error("offline")));
    await expect(fetchCustomItemSetting()).resolves.toEqual({ allowCustomItems: false, roundBillTotal: true, canChange: false });
    apiClient.mockImplementation(() => ok({ status: 404, data: null }));
    await expect(fetchCustomItemSetting()).resolves.toEqual({ allowCustomItems: false, roundBillTotal: true, canChange: false });
  });

  it("saves it", async () => {
    apiClient.mockImplementation(() => ok({ status: 200, message: "Custom items are now allowed on bills." }));
    await expect(saveCustomItemSetting(true)).resolves.toMatchObject({ status: 200 });
    const [url, opts] = apiClient.mock.calls[0];
    expect(url).toMatch(/\/api\/Sales\/CustomItemSetting$/);
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ allowCustomItems: true });
  });
});

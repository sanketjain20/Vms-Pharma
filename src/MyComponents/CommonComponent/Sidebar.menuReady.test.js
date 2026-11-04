import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";
import apiClient from "../../Config/apiClient";
import { resetMenuReady, whenMenuReady } from "../../utils/menuReady";

jest.mock("../../Config/apiClient");

const readyNow = async () => {
  let done = false;
  whenMenuReady(60000).then(() => { done = true; });
  await Promise.resolve();
  return done;
};

describe("Sidebar — tells the page when its menu is on screen (Home builds its 3D scenes after that)", () => {
  beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); resetMenuReady(); });

  it("after the modules arrive and the menu is drawn", async () => {
    let answer;
    apiClient.mockReturnValue(new Promise((r) => { answer = r; }));
    const { container } = render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(await readyNow()).toBe(false);          // still waiting for the request

    answer({ ok: true, json: async () => ({ status: 200, data: ["DASHBOARD", "SALES"] }) });
    await waitFor(async () => expect(await readyNow()).toBe(true));
    expect(container.querySelectorAll(".sb-nav > .sb-item").length).toBeGreaterThan(0);
  });

  it("also when the request fails, so nothing waits on a menu that will never come", async () => {
    apiClient.mockRejectedValue(new Error("offline"));
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(async () => expect(await readyNow()).toBe(true));
  });
});

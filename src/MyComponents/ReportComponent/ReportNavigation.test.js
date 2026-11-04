import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Reports from "./Reports";
import OpenReport from "./OpenReport";
import apiClient from "../../Config/apiClient";
import { resetBusinessProfile } from "../../utils/businessProfile";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ ...jest.requireActual("react-router-dom"), useNavigate: () => mockNavigate }));
jest.mock("../../Config/apiClient");
jest.mock("./LedgerCanvas", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

beforeEach(() => {
  jest.clearAllMocks();
  resetBusinessProfile();
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Reports/GetAllReports") || url.includes("Report") && !url.includes("Permission")) {
      return ok({ status: 200, data: [{ reportCode: "R5", name: "Sales Report", disabled: false }] });
    }
    return ok({ status: 200, data: [] });
  });
});

describe("Reports list → a report (page turn)", () => {
  it("opens the report screen once, although the sheet and its gleam both finish animating", async () => {
    render(<MemoryRouter><Reports /></MemoryRouter>);
    fireEvent.click((await screen.findAllByText("Sales Report"))[0]);
    const sheet = document.querySelector(".lg-turn-sheet");
    expect(sheet).toBeTruthy();

    // the ::before gleam's end arrives on the sheet itself, then the sheet's own
    const gleamEnd = new Event("animationend", { bubbles: true });
    Object.defineProperty(gleamEnd, "pseudoElement", { value: "::before" });
    act(() => { sheet.dispatchEvent(gleamEnd); });
    fireEvent.animationEnd(sheet);
    fireEvent.animationEnd(sheet); // and any repeat

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/master/reports/open", { state: { reportName: "Sales Report", from: "reports" } });
  });
});

describe("Report screen → Back", () => {
  const openScreen = (state) => render(
    <MemoryRouter initialEntries={[{ pathname: "/master/reports/open", state }]}><OpenReport /></MemoryRouter>,
  );
  const back = () => {
    jest.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    act(() => { jest.advanceTimersByTime(600); }); // after the book-closing motion
    jest.useRealTimers();
  };

  afterEach(() => window.history.replaceState(null, ""));

  it("steps back one page to the list it came from", () => {
    window.history.replaceState({ idx: 1 }, "");
    openScreen({ reportName: "Sales Report", from: "reports" });
    back();
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("opened some other way (a reload, a link), it goes to the list instead of leaving the app", () => {
    window.history.replaceState({ idx: 0 }, "");
    openScreen({ reportName: "Sales Report" });
    back();
    expect(mockNavigate).toHaveBeenCalledWith("/master/reports", { replace: true });
  });
});

import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import Home, { Reveal } from "./Home";
import apiClient from "../Config/apiClient";

jest.mock("../Config/apiClient");
// the real scenes need WebGL; they are tested on their own in HomeScenes/
jest.mock("./HomeScenes/StockFlowScene", () => ({ className }) => require("react").createElement("div", { "data-testid": "stockflow-scene", className }));
jest.mock("./HomeScenes/RobotScene", () => () => require("react").createElement("div", { "data-testid": "robot-scene" }));
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const SUMMARY = { collectedToday: 12500, billsGenerated: 42, expiring30d: 7, outstandingDues: 98000 };
const FEED = [{ message: "Bill INV-101 created for Shop Five" }, { message: "₹2,000 collected from Shop Six" }];

function mockApi({ summary = SUMMARY, feed = FEED } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Dashboard/GetHomeSummary")) return ok({ status: 200, data: summary });
    if (url.includes("/api/Dashboard/GetActivityFeed")) return ok({ status: 200, data: feed });
    if (url.includes("/api/Vendor/GetUserRoleId")) return ok({ status: 200, data: 3 });
    return ok({ status: 200, data: null });
  });
}

beforeAll(() => {
  // jsdom has no canvas or media playback; the ray band and videos only need these not to throw
  HTMLCanvasElement.prototype.getContext = () => null;
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("vmsUser", JSON.stringify({ data: { name: "Asha" } }));
});

describe("Home — content carried over from the old page", () => {
  it("greets the signed-in user by name", async () => {
    mockApi();
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Namaste, Asha.");
    await waitFor(() => expect(apiClient).toHaveBeenCalled());
  });

  it("shows the four live stats from GetHomeSummary once they load", async () => {
    mockApi();
    render(<Home />);

    await waitFor(() => expect(screen.getByTestId("stat-billsGenerated")).toHaveTextContent("42"), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId("stat-collectedToday")).toHaveTextContent("₹12,500"), { timeout: 3000 });
    expect(screen.getByTestId("stat-expiring30d")).toHaveTextContent("Expiring in 30d");
    await waitFor(() => expect(screen.getByTestId("stat-expiring30d")).toHaveTextContent("7"), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId("stat-outstandingDues")).toHaveTextContent("₹98,000"), { timeout: 3000 });
  });

  it("shows a dash while the stats are loading", () => {
    apiClient.mockImplementation(() => new Promise(() => {}));
    render(<Home />);
    expect(screen.getByTestId("stat-collectedToday")).toHaveTextContent("—");
  });

  it("flows the logged activity through the ticker (duplicated for a seamless loop)", async () => {
    mockApi();
    render(<Home />);
    const ticker = screen.getByLabelText("Logged activity");
    await waitFor(() => expect(within(ticker).getAllByText("Bill INV-101 created for Shop Five")).toHaveLength(2));
    expect(within(ticker).getAllByText("₹2,000 collected from Shop Six")).toHaveLength(2);
  });

  it("falls back to a placeholder line when there is no activity yet", async () => {
    mockApi({ feed: [] });
    render(<Home />);
    expect(screen.getAllByText(/Live activity will appear here/)).toHaveLength(2);
  });

  it("Quick Sale, Dashboard and How it works go to their pages", async () => {
    mockApi();
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /Quick Sale/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "How it works" }));
    expect(mockNavigate.mock.calls.map(c => c[0])).toEqual(["/master/salesshrt", "/master/dashboard", "/onboarding"]);
  });

  it("every module card opens its module", () => {
    mockApi();
    render(<Home />);
    // a card's accessible name is its tag, label and hint read in order
    const expected = [
      ["Stock in Purchase Stock in · supplier dues", "/master/purchase"],
      ["Billing Sales FIFO billing · invoices", "/master/salesshrt"],
      ["Stock Inventory Live stock · expiry", "/master/inventory"],
      ["Customers Retailers Credit · outstanding", "/master/retailer"],
      ["Collections Payments Collect · due tracking", "/master/payment-collection"],
      ["Insight Reports GSTR-1 · recall trace", "/master/reports"],
    ];
    expected.forEach(([name, path]) => {
      mockNavigate.mockClear();
      fireEvent.click(screen.getByRole("button", { name }));
      expect(mockNavigate).toHaveBeenCalledWith(path);
    });
  });

  it("keeps the ray band with its colour picker and remembers the choice", () => {
    mockApi();
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Teal" }));
    expect(screen.getByRole("button", { name: "Teal" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("vmsRayPreset")).toBe("teal");
  });

  it("keeps the 'why it runs itself' list", () => {
    mockApi();
    render(<Home />);
    ["Auto FIFO batches", "Credit limit enforcement", "Nightly expiry scheduler", "GST-ready invoices",
      "Batch recall trace", "Zero manual outstanding"].forEach(t => expect(screen.getByText(t)).toBeInTheDocument());
  });
});

describe("Reveal — scroll-in animation", () => {
  const original = window.IntersectionObserver;
  afterEach(() => { window.IntersectionObserver = original; });

  it("without IntersectionObserver the content is shown straight away", () => {
    delete window.IntersectionObserver;
    render(<Reveal>Hello</Reveal>);
    expect(screen.getByText("Hello")).toHaveClass("hc-reveal", "is-in");
  });

  it("waits until it scrolls into view, then stays shown and stops observing", () => {
    let fire;
    const disconnect = jest.fn();
    window.IntersectionObserver = jest.fn(function (cb, opts) {
      fire = cb;
      this.opts = opts;
      this.observe = jest.fn();
      this.disconnect = disconnect;
    });

    render(<Reveal from="left" delay={0.3}>Panel</Reveal>);
    const el = screen.getByText("Panel");
    expect(el).not.toHaveClass("is-in");
    expect(el).toHaveClass("hc-reveal--left");
    expect(el.style.getPropertyValue("--rv-delay")).toBe("0.3s");
    expect(window.IntersectionObserver.mock.calls[0][1]).toEqual({ rootMargin: "0px 0px -100px 0px" });

    act(() => fire([{ isIntersecting: false }]));
    expect(el).not.toHaveClass("is-in");
    act(() => fire([{ isIntersecting: true }]));
    expect(el).toHaveClass("is-in");
    expect(disconnect).toHaveBeenCalled();
  });
});

describe("3D scenes", () => {
  it("loads the stock-flow scene behind the hero and the juggling robot under 'Every box, in balance'", async () => {
    mockApi();
    render(<Home />);
    const hero = await screen.findByTestId("stockflow-scene");
    expect(hero).toHaveClass("hc-hero-scene");
    const robot = await screen.findByTestId("robot-scene");
    expect(screen.getByText("Move your cursor to look around")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Every box, in balance" })).toBeInTheDocument();
    expect(screen.getByText(/VMS keeps every box in the air/)).toBeInTheDocument();
    expect(robot).toBeInTheDocument();
  });

  it("no longer ships any background video", () => {
    mockApi();
    const { container } = render(<Home />);
    expect(container.innerHTML).not.toMatch(/<video/);
  });
});

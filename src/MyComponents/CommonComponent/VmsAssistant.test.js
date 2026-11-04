import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import VmsAssistant from "./VmsAssistant";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
// the shop: a clothing store that does not track expiry (decides which pages the menu has)
let mockProfile = { trackExpiry: false, isPharma: false };
jest.mock("../../utils/businessProfile", () => ({
  PHARMA_PROFILE: { trackExpiry: true, isPharma: true },
  fetchBusinessProfile: () => Promise.resolve(mockProfile),
}));

function jsonResponse(body) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

function renderAt(path = "/master/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <VmsAssistant />
    </MemoryRouter>
  );
}

async function openPanel() {
  await userEvent.click(screen.getByTitle("VMS Assistant"));
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockProfile = { trackExpiry: false, isPharma: false };
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", { value: {}, configurable: true });
  }
  navigator.clipboard.writeText = jest.fn().mockResolvedValue();
});

describe("VmsAssistant", () => {
  it("is hidden on the login page", () => {
    renderAt("/");
    expect(screen.queryByTitle("VMS Assistant")).not.toBeInTheDocument();
  });

  it("is hidden on the forgot-password page", () => {
    renderAt("/forgotpassword");
    expect(screen.queryByTitle("VMS Assistant")).not.toBeInTheDocument();
  });

  it("opens the panel and shows the welcome message plus quick actions", async () => {
    renderAt();
    await openPanel();

    expect(screen.getByText(/Hi, I'm your VMS Assistant/)).toBeInTheDocument();
    expect(screen.getByText("How does VMS flow work?")).toBeInTheDocument();
  });

  it("sends a message and renders whatever dynamic reply the backend returns", async () => {
    apiClient.mockReturnValue(
      jsonResponse({ status: 200, data: { reply: "Purchases create batches with expiry and cost price." } })
    );
    renderAt();
    await openPanel();

    await userEvent.type(screen.getByPlaceholderText(/Ask about sales/i), "how does purchase work?");
    await userEvent.click(screen.getByTitle("Send"));

    expect(screen.getByText("how does purchase work?")).toBeInTheDocument();
    expect(await screen.findByText("Purchases create batches with expiry and cost price.")).toBeInTheDocument();

    const [url, options] = apiClient.mock.calls[0];
    expect(url).toContain("/api/Chat/SendMessage");
    const body = JSON.parse(options.body);
    expect(body.messages[body.messages.length - 1]).toEqual({ role: "user", content: "how does purchase work?" });
    expect(body.pageContext).toBe("Dashboard");
  });

  it("renders **bold** and list markdown from the reply as real elements, not raw asterisks", async () => {
    apiClient.mockReturnValue(
      jsonResponse({ status: 200, data: { reply: "Steps:\n- **First** step\n- Second step" } })
    );
    renderAt();
    await openPanel();
    await userEvent.type(screen.getByPlaceholderText(/Ask about sales/i), "steps?");
    await userEvent.click(screen.getByTitle("Send"));

    expect(await screen.findByText("First")).toBeInTheDocument();
    expect(screen.getByText("First").tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*First\*\*/)).not.toBeInTheDocument();
  });

  it("shows a retry option when the backend call fails, and retries on click", async () => {
    apiClient
      .mockReturnValueOnce(jsonResponse({ status: 500, message: "Server error" }))
      .mockReturnValueOnce(jsonResponse({ status: 200, data: { reply: "Now it works." } }));
    renderAt();
    await openPanel();

    await userEvent.type(screen.getByPlaceholderText(/Ask about sales/i), "hello");
    await userEvent.click(screen.getByTitle("Send"));

    const retryBtn = await screen.findByRole("button", { name: /retry/i });
    expect(screen.getByText("Server error")).toBeInTheDocument();

    await userEvent.click(retryBtn);

    expect(await screen.findByText("Now it works.")).toBeInTheDocument();
    expect(apiClient).toHaveBeenCalledTimes(2);
  });

  it("sends the quick-action prompt when a suggestion chip is clicked", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: { reply: "It starts with master data." } }));
    renderAt();
    await openPanel();

    await userEvent.click(screen.getByText("How does VMS flow work?"));

    expect(await screen.findByText("It starts with master data.")).toBeInTheDocument();
  });

  it("copies a reply to the clipboard when the copy button is clicked", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: { reply: "Copy me." } }));
    renderAt();
    await openPanel();
    await userEvent.type(screen.getByPlaceholderText(/Ask about sales/i), "hi");
    await userEvent.click(screen.getByTitle("Send"));
    await screen.findByText("Copy me.");

    const copyButtons = screen.getAllByTitle("Copy");
    await userEvent.click(copyButtons[copyButtons.length - 1]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Copy me.");
  });

  it("resets the conversation and clears persisted history", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: { reply: "Some reply." } }));
    renderAt();
    await openPanel();
    await userEvent.type(screen.getByPlaceholderText(/Ask about sales/i), "hi");
    await userEvent.click(screen.getByTitle("Send"));
    await screen.findByText("Some reply.");

    await userEvent.click(screen.getByTitle("Reset chat"));

    expect(screen.getByText(/Hi, I'm your VMS Assistant/)).toBeInTheDocument();
    expect(screen.queryByText("Some reply.")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("vmsAssistantHistory")).toBeNull();
  });

  it("persists the conversation across a remount", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: { reply: "Persisted reply." } }));
    const { unmount } = renderAt();
    await openPanel();
    await userEvent.type(screen.getByPlaceholderText(/Ask about sales/i), "hi");
    await userEvent.click(screen.getByTitle("Send"));
    await screen.findByText("Persisted reply.");
    unmount();

    renderAt();
    await openPanel();

    await waitFor(() => expect(screen.getByText("Persisted reply.")).toBeInTheDocument());
  });
});

describe("VmsAssistant — knows the pages from the menu", () => {
  const sentBody = () => JSON.parse(apiClient.mock.calls[0][1].body);
  const ask = async (text = "hi") => {
    await userEvent.type(screen.getByPlaceholderText(/Ask about sales/i), text);
    await userEvent.click(screen.getByTitle("Send"));
    await waitFor(() => expect(apiClient).toHaveBeenCalled());
  };

  beforeEach(() => apiClient.mockReturnValue(jsonResponse({ status: 200, data: { reply: "ok" } })));

  it("names the page the user is on from the menu, including newer pages", async () => {
    renderAt("/master/stock-transfer");
    await openPanel();
    await ask();
    expect(sentBody().pageContext).toBe("Stock Transfers");
  });

  it("sends the pages this user can open — their modules, their kind of shop", async () => {
    window.localStorage.setItem("modules", JSON.stringify(["SALES", "STOCK_TRANSFER", "PRODUCT_STYLE", "Alerts"]));
    renderAt("/master/sales");
    await openPanel();
    await ask();
    const pages = sentBody().availablePages;
    expect(pages).toEqual(expect.arrayContaining([
      "Billing & GST › Sales",
      "Billing & GST › Stock Transfers",
      "Masters › Styles (Sizes & Colours)",
      "Quick Sale",
      "Account settings",
    ]));
    expect(pages).not.toContain("Inventory › Alerts › Expiry Alerts"); // this shop doesn't track expiry
    expect(pages.some((p) => p.includes("Purchase Orders"))).toBe(false); // not in this role
  });

  it("never reads the shop profile while hidden (login screens)", () => {
    renderAt("/");
    expect(apiClient).not.toHaveBeenCalled();
  });

  it("a pharmacy's assistant isn't told about styles", async () => {
    mockProfile = { trackExpiry: true, isPharma: true };
    window.localStorage.setItem("modules", JSON.stringify(["SALES", "PRODUCT_STYLE"]));
    renderAt("/master/sales");
    await openPanel();
    await ask();
    expect(sentBody().availablePages.some((p) => p.includes("Styles"))).toBe(false);
  });

  it("offers 'ask about a module' chips only for pages the user can open", async () => {
    window.localStorage.setItem("modules", JSON.stringify(["SALES", "STOCK_TRANSFER"]));
    renderAt("/home");
    await openPanel();
    expect(screen.getByRole("button", { name: "Sales" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stock Transfers" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Purchase" })).toBeNull();
  });
});

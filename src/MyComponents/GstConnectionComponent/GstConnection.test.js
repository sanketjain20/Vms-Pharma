import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import GstModeBanner, { ModeTag } from "./GstModeBanner";
import GstConnectionModal from "./GstConnectionModal";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) });
const channel = (o = {}) => ({ ready: true, problem: null, credentialSaved: false, credentialEnabled: false, credentialEnvironment: null, gstin: null, ...o });

const STUB = { mode: "STUB", live: false, provider: "NIC", level: "TEST", headline: "STUB MODE — e-invoices and e-way bills are simulated",
  detail: "Nothing is sent to the GST portal.", einvoice: channel(), eway: channel() };
const SANDBOX = { ...STUB, mode: "SANDBOX", headline: "SANDBOX MODE — test documents only", detail: "Documents go to the provider's test environment." };
const BLOCKED = { ...STUB, mode: "PRODUCTION", level: "BLOCKED", headline: "PRODUCTION MODE — not ready to issue documents",
  detail: "E-invoicing credentials are not set up or not enabled for this business." };
const LIVE = { ...STUB, mode: "PRODUCTION", live: true, level: "LIVE", headline: "PRODUCTION MODE", detail: "Documents are registered." };

const CREDS = [
  { credentialType: "EINVOICE", gstin: null, environment: "SANDBOX", enabled: false, hasUsername: false, hasPassword: false, hasClientId: false, hasClientSecret: false },
  { credentialType: "EWAYBILL", gstin: "27AAPFU0939F1ZV", environment: "SANDBOX", enabled: true, hasUsername: true, hasPassword: true, hasClientId: true, hasClientSecret: true },
];

function mockApi({ status = STUB, creds = CREDS, saveResult = { status: 200, message: "GST credentials saved." }, testResult } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    const method = options.method || "GET";
    if (url.includes("/api/Gst/Status")) return json({ status: 200, data: status });
    if (url.includes("/api/Gst/Credentials") && method === "GET") return json({ status: 200, data: creds });
    if (url.includes("/api/Gst/Credentials") && method === "PUT") return json(saveResult, saveResult.status === 200);
    if (url.includes("/api/Gst/TestConnection")) return json(testResult || { status: 200, data: { success: true, mode: status.mode, message: "Connected to the SANDBOX e-invoice server." } });
    return json({ status: 404, message: "unmocked " + url }, false);
  });
}

const callsTo = (fragment, method) =>
  apiClient.mock.calls.filter(([url, o]) => url.includes(fragment) && (!method || (o?.method || "GET") === method));

beforeEach(() => jest.clearAllMocks());

describe("ModeTag", () => {
  it("shows TEST for simulated and sandbox documents, nothing for real or old ones", () => {
    const { rerender, container } = render(<ModeTag mode="STUB" />);
    expect(screen.getByText("TEST · simulated")).toHaveAttribute("title", expect.stringMatching(/not registered/i));
    rerender(<ModeTag mode="SANDBOX" />);
    expect(screen.getByText("TEST · sandbox")).toBeInTheDocument();
    rerender(<ModeTag mode="PRODUCTION" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ModeTag mode={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("GstModeBanner", () => {
  it("warns in STUB mode that documents are simulated", async () => {
    mockApi({ status: STUB });
    render(<GstModeBanner />);
    const banner = await screen.findByTestId("gst-mode-banner");
    expect(banner).toHaveTextContent("STUB MODE — e-invoices and e-way bills are simulated");
    expect(banner).toHaveClass("gst-alert--warning");
  });

  it("warns in SANDBOX mode too", async () => {
    mockApi({ status: SANDBOX });
    render(<GstModeBanner />);
    expect(await screen.findByTestId("gst-mode-banner")).toHaveTextContent("SANDBOX MODE — test documents only");
  });

  it("is a danger banner saying what is missing when a remote mode cannot issue", async () => {
    mockApi({ status: BLOCKED });
    render(<GstModeBanner />);
    const banner = await screen.findByTestId("gst-mode-banner");
    expect(banner).toHaveClass("gst-alert--danger");
    expect(banner).toHaveTextContent("not ready to issue documents");
    expect(banner).toHaveTextContent("credentials are not set up");
  });

  it("shows no warning once production is ready, but keeps the settings reachable", async () => {
    mockApi({ status: LIVE });
    render(<GstModeBanner />);
    expect(await screen.findByRole("button", { name: "GST connection" })).toBeInTheDocument();
    expect(screen.queryByTestId("gst-mode-banner")).not.toBeInTheDocument();
  });

  it("shows nothing while loading and never breaks the page if the status cannot be read", async () => {
    apiClient.mockImplementation(() => Promise.reject(new Error("offline")));
    const { container } = render(<GstModeBanner />);
    await waitFor(() => expect(apiClient).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the GST connection settings from the banner", async () => {
    mockApi({ status: STUB });
    render(<GstModeBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "GST connection" }));
    expect(await screen.findByRole("dialog", { name: "GST connection" })).toBeInTheDocument();
  });
});

describe("GstConnectionModal", () => {
  async function open(opts, props = {}) {
    mockApi(opts);
    const onClose = jest.fn();
    const onSaved = jest.fn();
    render(<GstConnectionModal onClose={onClose} onSaved={onSaved} {...props} />);
    await screen.findByLabelText("Business GSTIN");
    return { onClose, onSaved };
  }

  const fillAll = () => {
    fireEvent.change(screen.getByLabelText("Business GSTIN"), { target: { value: "27aapfu0939f1zv" } });
    fireEvent.change(screen.getByLabelText("GSP / portal username"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pass" } });
    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "cid" } });
    fireEvent.change(screen.getByLabelText("Client secret"), { target: { value: "secret" } });
  };

  it("says which mode the system is in, and that credentials are unused in STUB mode", async () => {
    await open({ status: STUB });
    expect(await screen.findByTestId("gst-current-mode")).toHaveTextContent("STUB mode");
    expect(screen.getByTestId("gst-current-mode")).toHaveTextContent("credentials are not used yet");
  });

  it("starts empty for a channel with nothing saved and loads what is saved for the other one", async () => {
    await open({});
    expect(screen.getByLabelText("Business GSTIN")).toHaveValue("");
    fireEvent.click(screen.getByRole("tab", { name: "E-way bill" }));
    expect(screen.getByLabelText("Business GSTIN")).toHaveValue("27AAPFU0939F1ZV");
    expect(screen.getByLabelText("Enabled")).toBeChecked();
  });

  it("never shows a saved secret, only that one is saved", async () => {
    await open({});
    fireEvent.click(screen.getByRole("tab", { name: "E-way bill" }));
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveAttribute("placeholder", "Saved — leave blank to keep");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Client secret")).toHaveAttribute("type", "password");
  });

  it("saves the form with a tidied GSTIN and reloads, calling onSaved", async () => {
    const { onSaved } = await open({});
    fillAll();
    fireEvent.click(screen.getByLabelText("Enabled"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("E-invoice credentials saved.")).toBeInTheDocument();
    const put = callsTo("/api/Gst/Credentials", "PUT");
    expect(put).toHaveLength(1);
    expect(JSON.parse(put[0][1].body)).toEqual({
      credentialType: "EINVOICE", gstin: "27AAPFU0939F1ZV", environment: "SANDBOX", enabled: true,
      username: "user", password: "pass", clientId: "cid", clientSecret: "secret",
    });
    expect(onSaved).toHaveBeenCalled();
    expect(callsTo("/api/Gst/Credentials", "GET").length).toBeGreaterThan(1); // reloaded
  });

  it("refuses a bad form before calling the server", async () => {
    await open({});
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/15-character GSTIN/)).toBeInTheDocument();
    expect(callsTo("/api/Gst/Credentials", "PUT")).toHaveLength(0);
  });

  it("lets the E-way bill form be saved with every secret left blank (they are already saved)", async () => {
    await open({});
    fireEvent.click(screen.getByRole("tab", { name: "E-way bill" }));
    fireEvent.click(screen.getByLabelText("Enabled"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("E-way bill credentials saved.")).toBeInTheDocument();
    const body = JSON.parse(callsTo("/api/Gst/Credentials", "PUT")[0][1].body);
    expect(body).toMatchObject({ credentialType: "EWAYBILL", enabled: false, password: "", clientSecret: "" });
  });

  it("shows the server's message when saving fails", async () => {
    await open({ saveResult: { status: 400, message: "The server has no encryption key (VMS_GST_CRYPTO_KEY), so credentials cannot be stored safely." } });
    fillAll();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/VMS_GST_CRYPTO_KEY/)).toBeInTheDocument();
  });

  it("warns when the credentials are for a different environment than the system's mode", async () => {
    await open({ status: SANDBOX });
    fireEvent.change(screen.getByLabelText("Environment these credentials are for"), { target: { value: "PRODUCTION" } });
    expect(screen.getByRole("alert")).toHaveTextContent("The system is in SANDBOX mode, so these PRODUCTION credentials will not be used");
  });

  it("does not warn about a mismatch in STUB mode", async () => {
    await open({ status: STUB });
    fireEvent.change(screen.getByLabelText("Environment these credentials are for"), { target: { value: "PRODUCTION" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tests the connection for the chosen channel and shows the result", async () => {
    await open({ status: SANDBOX });
    fireEvent.click(screen.getByRole("tab", { name: "E-way bill" }));
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText("Connected to the SANDBOX e-invoice server.")).toBeInTheDocument();
    expect(callsTo("/api/Gst/TestConnection/EWAYBILL", "POST")).toHaveLength(1);
  });

  it("shows a failed connection test as an error, and a stub 'nothing contacted' as information", async () => {
    await open({ status: SANDBOX, testResult: { status: 200, data: { success: false, mode: "SANDBOX", message: "Could not reach the e-invoice portal." } } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    const fail = await screen.findByText("Could not reach the e-invoice portal.");
    expect(fail).toHaveClass("gst-alert--danger");
  });

  it("shows the stub's note in the information style", async () => {
    await open({ status: STUB, testResult: { status: 200, data: { success: true, mode: "STUB", message: "STUB MODE: no connection was made." } } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText("STUB MODE: no connection was made.")).toHaveClass("gst-alert--info");
  });

  it("closes with the Close button, Escape, and a click on the backdrop but not inside the dialog", async () => {
    const { onClose } = await open({});
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog").parentElement);
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.click(within(screen.getByRole("dialog")).getByText("GST connection"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

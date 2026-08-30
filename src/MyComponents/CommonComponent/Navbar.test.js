import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Navbar from "./Navbar";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function renderNavbar() {
  const utils = render(
    <MemoryRouter>
      <Navbar sidebarOpen={false} theme="dark" onToggleTheme={() => {}} />
    </MemoryRouter>
  );
  return { ...utils, openDropdown: () => utils.container.querySelector(".profile-avatar") };
}

describe("Navbar logout", () => {
  beforeEach(() => {
    localStorage.setItem("vmsUser", JSON.stringify({ data: { name: "Test Vendor", token: "tok" } }));
    localStorage.setItem("modules", JSON.stringify(["SALES", "PURCHASE"]));
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("clears both vmsUser and modules from storage on successful logout", async () => {
    apiClient.mockResolvedValue({ ok: true });
    const { openDropdown } = renderNavbar();

    await userEvent.click(openDropdown());
    await userEvent.click(screen.getByText(/logout/i));

    expect(localStorage.getItem("vmsUser")).toBeNull();
    expect(localStorage.getItem("modules")).toBeNull();
  });

  it("keeps stored session data when the logout request fails", async () => {
    window.alert = jest.fn();
    apiClient.mockResolvedValue({ ok: false });
    const { openDropdown } = renderNavbar();

    await userEvent.click(openDropdown());
    await userEvent.click(screen.getByText(/logout/i));

    expect(localStorage.getItem("vmsUser")).not.toBeNull();
    expect(localStorage.getItem("modules")).not.toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import GuestOnly from "./GuestOnly";

// A JWT-shaped (but unsigned) token carrying just an `exp` claim — see
// RequireAuth.test.js for why a bare placeholder string won't do anymore.
function makeToken(expiresInSeconds) {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }));
  return `${header}.${payload}.signature`;
}

function renderAt(path, storedUser) {
  if (storedUser === undefined) {
    localStorage.removeItem("vmsUser");
  } else {
    localStorage.setItem("vmsUser", JSON.stringify(storedUser));
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <GuestOnly>
              <div>Login Page</div>
            </GuestOnly>
          }
        />
        <Route path="/home" element={<div>Protected Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("GuestOnly", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("renders the login page when there is no stored token", () => {
    renderAt("/", undefined);

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Home")).not.toBeInTheDocument();
  });

  it("redirects an already-authenticated user away from the login page", () => {
    renderAt("/", { data: { token: makeToken(3600) } });

    expect(screen.getByText("Protected Home")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });

  it("shows the login page (does not redirect) when the stored token has expired", () => {
    renderAt("/", { data: { token: makeToken(-3600) } });

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Home")).not.toBeInTheDocument();
  });
});

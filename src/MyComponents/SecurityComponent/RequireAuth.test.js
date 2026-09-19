import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequireAuth, { isAuthenticated } from "./RequireAuth";

// A JWT-shaped (but unsigned) token carrying just an `exp` claim — enough
// for RequireAuth's client-side expiry check, which only ever reads the
// payload segment.
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
        <Route path="/" element={<div>Login Page</div>} />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <div>Protected Home</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAuth", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("redirects to the login page when there is no stored token", () => {
    renderAt("/home", undefined);

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Home")).not.toBeInTheDocument();
  });

  it("redirects to the login page when vmsUser has no token", () => {
    renderAt("/home", { data: {} });

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Home")).not.toBeInTheDocument();
  });

  it("redirects to the login page when vmsUser is malformed JSON", () => {
    localStorage.setItem("vmsUser", "{not-json");

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/" element={<div>Login Page</div>} />
          <Route
            path="/home"
            element={
              <RequireAuth>
                <div>Protected Home</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders the protected content when a token is present and not expired", () => {
    renderAt("/home", { data: { token: makeToken(3600) } });

    expect(screen.getByText("Protected Home")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });

  it("redirects to the login page when the stored token has expired", () => {
    renderAt("/home", { data: { token: makeToken(-3600) } });

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Home")).not.toBeInTheDocument();
  });

  it("clears the stale session from storage when the token has expired", () => {
    renderAt("/home", { data: { token: makeToken(-3600) } });

    expect(localStorage.getItem("vmsUser")).toBeNull();
    expect(localStorage.getItem("modules")).toBeNull();
  });

  it("redirects to the login page when the token isn't a decodable JWT", () => {
    renderAt("/home", { data: { token: "not-a-real-jwt" } });

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  describe("isAuthenticated", () => {
    afterEach(() => {
      localStorage.clear();
    });

    it("returns true for a present, unexpired token", () => {
      localStorage.setItem("vmsUser", JSON.stringify({ data: { token: makeToken(3600) } }));
      expect(isAuthenticated()).toBe(true);
    });

    it("returns false for an expired token", () => {
      localStorage.setItem("vmsUser", JSON.stringify({ data: { token: makeToken(-1) } }));
      expect(isAuthenticated()).toBe(false);
    });
  });
});

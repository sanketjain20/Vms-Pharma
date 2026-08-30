import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequireAuth from "./RequireAuth";

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

  it("renders the protected content when a token is present", () => {
    renderAt("/home", { data: { token: "valid-token" } });

    expect(screen.getByText("Protected Home")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });
});

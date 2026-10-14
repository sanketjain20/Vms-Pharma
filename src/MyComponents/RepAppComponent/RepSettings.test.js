import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import RepSettings, { ACCENTS, DEFAULT_ACCENT, passwordStrength, readAccent, saveAccent, validateNewPassword } from "./RepSettings";
import { createMemoryDb, setMeta, getMeta } from "./repDb";

jest.mock("../../Config/apiClient");

const PROFILE = {
  name: "Ravi Kumar", email: "ravi@acme.com", phone: "9820011223", address: "MG Road, Pune", company: "Acme Pharma",
  vendorCode: "ACM-0042", memberSince: "2026-03-14T09:00:00", retailerCount: 12,
};
const USER = { name: "Ravi Kumar", shopName: "Acme Pharma", address: "MG Road, Pune", vendorId: 7 };

const ok = (data) => ({ ok: true, status: 200, data, message: "" });
const offline = () => ({ ok: false, networkError: true, message: "You're offline." });

function setup({ profile = ok(PROFILE), changePassword, online = true, db = createMemoryDb(), accent = "teal", photo = null, updatePhoto, processImage } = {}) {
  const api = {
    profile: jest.fn(async () => profile),
    changePassword: jest.fn(changePassword || (async () => ({ ok: true, status: 200, message: "Password updated successfully." }))),
    updatePhoto: jest.fn(updatePhoto || (async () => ({ ok: true, status: 200, message: "Photo updated." }))),
  };
  const onAccent = jest.fn();
  const onPhotoChange = jest.fn();
  const onProfileSaved = jest.fn();
  const proc = processImage || jest.fn(async () => "data:image/jpeg;base64,/9j/4AAQ");
  const utils = render(
    <RepSettings user={USER} db={db} api={api} online={online} accent={accent} onAccent={onAccent}
      photo={photo} onPhotoChange={onPhotoChange} onProfileSaved={onProfileSaved} processImage={proc} />
  );
  return { api, onAccent, onPhotoChange, onProfileSaved, processImage: proc, db, ...utils };
}

const fill = (current, next, confirm) => {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Update password" }));

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

describe("password rules", () => {
  it("validates in the same order the server does", () => {
    expect(validateNewPassword("", "x", "x")).toMatch(/all three/);
    expect(validateNewPassword("Old12345", "Ab1", "Ab1")).toMatch(/at least 8/);
    expect(validateNewPassword("Old12345", "onlyletters", "onlyletters")).toMatch(/letter and one number/);
    expect(validateNewPassword("Old12345", "12345678", "12345678")).toMatch(/letter and one number/);
    expect(validateNewPassword("Old12345", "NewPass456", "Different1")).toMatch(/don't match/);
    expect(validateNewPassword("Same12345", "Same12345", "Same12345")).toMatch(/different/);
    expect(validateNewPassword("Old12345", "NewPass456", "NewPass456")).toBeNull();
  });

  it("scores strength from 0 to 4", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("abc").label).toBe("Too weak");
    expect(passwordStrength("abcdefgh").score).toBe(1);
    expect(passwordStrength("Abcdefg1").score).toBe(3);
    expect(passwordStrength("Abcdefg1!xyz").label).toBe("Strong");
  });
});

describe("RepSettings — your details", () => {
  it("shows the rep's details from the server, read-only", async () => {
    const { container } = setup();

    const details = await screen.findByLabelText("Your details");
    await waitFor(() => expect(within(details).getByText("ravi@acme.com")).toBeInTheDocument());
    expect(within(details).queryByText("Rep ID")).not.toBeInTheDocument(); // not shown to the rep
    expect(screen.queryByText("ACM-0042")).not.toBeInTheDocument();
    expect(within(details).getByText("ravi@acme.com")).toBeInTheDocument();
    expect(within(details).getByText("9820011223")).toBeInTheDocument();
    expect(within(details).getByText("12")).toBeInTheDocument();
    const joined = new Date(PROFILE.memberSince).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    expect(within(details).getByText(joined)).toBeInTheDocument(); // formatted in the viewer's own locale
    // basic details are not editable here: the only inputs are the three password fields and the photo picker
    const editable = [...container.querySelectorAll("input")].map((i) => i.id || i.type);
    expect(editable.sort()).toEqual(["file", "ra-pw-confirm", "ra-pw-current", "ra-pw-new"]);
    expect(screen.getByText(/managed by your office/)).toBeInTheDocument();
  });

  it("falls back to what the login knew when there is no connection and nothing cached", async () => {
    setup({ profile: offline() });

    const details = await screen.findByLabelText("Your details");
    expect(within(details).getAllByText("Ravi Kumar").length).toBeGreaterThan(0);
    expect(within(details).getByText("Acme Pharma")).toBeInTheDocument();
    expect(within(details).queryByText("ravi@acme.com")).not.toBeInTheDocument(); // not known offline
    expect(screen.getByText(/connect to refresh/)).toBeInTheDocument();
  });

  it("shows the last saved copy straight away, and saves a fresh one for next time", async () => {
    const db = createMemoryDb();
    await setMeta(db, "profile", { ...PROFILE, phone: "OLD-NUMBER" });
    let answer;
    const api = { profile: jest.fn(() => new Promise((resolve) => { answer = () => resolve(ok(PROFILE)); })), changePassword: jest.fn() };
    render(<RepSettings user={USER} db={db} api={api} online accent="teal" onAccent={jest.fn()} />);

    expect(await screen.findByText("OLD-NUMBER")).toBeInTheDocument(); // cached, while the network is still thinking
    answer();
    expect(await screen.findByText("9820011223")).toBeInTheDocument(); // then the fresh one
    expect((await getMeta(db, "profile")).phone).toBe("9820011223");
  });

  it("tells the rep when the details couldn't be refreshed", async () => {
    setup({ profile: { ok: false, status: 500, message: "Error while fetching your profile" } });
    expect(await screen.findByText("Error while fetching your profile")).toBeInTheDocument();
  });
});

describe("RepSettings — change password", () => {
  it("sends the current and new password, then clears the form and confirms", async () => {
    const { api } = setup();
    fill("OldPass123", "NewPass456", "NewPass456");
    submit();

    expect(await screen.findByText(/Password updated/)).toBeInTheDocument();
    expect(api.changePassword).toHaveBeenCalledWith({ currentPassword: "OldPass123", newPassword: "NewPass456" });
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it.each([
    ["empty fields", ["", "", ""], /all three/],
    ["a short password", ["OldPass123", "Ab1", "Ab1"], /at least 8/],
    ["no number", ["OldPass123", "onlyletters", "onlyletters"], /letter and one number/],
    ["a mismatch", ["OldPass123", "NewPass456", "NewPass457"], /don't match/],
    ["the same password", ["OldPass123", "OldPass123", "OldPass123"], /different/],
  ])("blocks %s without calling the server", async (_name, [c, n, f], message) => {
    const { api } = setup();
    fill(c, n, f);
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it("shows the server's reason, e.g. a wrong current password, and keeps what was typed", async () => {
    setup({ changePassword: async () => ({ ok: false, status: 400, message: "Current password is incorrect." }) });
    fill("WrongPass1", "NewPass456", "NewPass456");
    submit();

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveValue("NewPass456");
  });

  it("explains a lost connection without claiming the password changed", async () => {
    setup({ changePassword: async () => offline() });
    fill("OldPass123", "NewPass456", "NewPass456");
    submit();

    expect(await screen.findByText(/Your password was not changed/)).toBeInTheDocument();
  });

  it("doesn't even try while offline", async () => {
    const { api } = setup({ online: false });
    fill("OldPass123", "NewPass456", "NewPass456");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("need a connection");
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it("can show and hide each password, and shows a live strength meter", () => {
    setup();
    const field = screen.getByLabelText("New password");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
    expect(field).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide new password" }));
    expect(field).toHaveAttribute("type", "password");

    expect(screen.queryByText("Too weak")).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: "abc" } });
    expect(screen.getByText("Too weak")).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "Abcdefg1!xyz" } });
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("prevents a double submit while the request is in flight", async () => {
    let release;
    const { api } = setup({ changePassword: () => new Promise((r) => { release = () => r({ ok: true, status: 200, message: "" }); }) });
    fill("OldPass123", "NewPass456", "NewPass456");
    submit();

    expect(await screen.findByRole("button", { name: "Updating…" })).toBeDisabled();
    release();
    await screen.findByText(/Password updated/);
    expect(api.changePassword).toHaveBeenCalledTimes(1);
  });
});

describe("RepSettings — accent colour", () => {
  it("offers every accent as a radio, with the current one selected", () => {
    setup({ accent: "violet" });

    const group = screen.getByRole("radiogroup", { name: "Accent colour" });
    expect(within(group).getAllByRole("radio")).toHaveLength(ACCENTS.length);
    expect(within(group).getByRole("radio", { name: "Violet" })).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: "Teal" })).toHaveAttribute("aria-checked", "false");
  });

  it("reports the choice, and can reset to the default", () => {
    const { onAccent } = setup({ accent: "rose" });

    fireEvent.click(screen.getByRole("radio", { name: "Ocean" }));
    expect(onAccent).toHaveBeenCalledWith("ocean");

    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(onAccent).toHaveBeenLastCalledWith(DEFAULT_ACCENT);
  });

  it("hides the reset button when already on the default", () => {
    setup({ accent: "teal" });
    expect(screen.queryByRole("button", { name: "Reset to default" })).not.toBeInTheDocument();
  });

  it("remembers the choice per rep, and ignores a saved value it doesn't recognise", () => {
    expect(readAccent(7)).toBe("teal");
    saveAccent(7, "amber");
    expect(readAccent(7)).toBe("amber");
    expect(readAccent(8)).toBe("teal"); // a different rep on the same phone
    localStorage.setItem("vmsRepAccent:7", "hot-pink");
    expect(readAccent(7)).toBe("teal");
  });
});

describe("RepSettings — profile photo", () => {
  const pick = (file = new File(["x"], "me.jpg", { type: "image/jpeg" })) =>
    fireEvent.change(screen.getByLabelText("Choose profile photo"), { target: { files: [file] } });

  it("shows initials until there is a photo, then the photo", () => {
    const first = setup({ photo: null });
    expect(first.container.querySelector("img.ra-avatar--img")).toBeNull();
    expect(screen.getAllByText("RK").length).toBeGreaterThan(0);
    first.unmount();

    const second = setup({ photo: "data:image/jpeg;base64,/9j/AAA" });
    expect(second.container.querySelector("img.ra-avatar--img")).toHaveAttribute("src", "data:image/jpeg;base64,/9j/AAA");
  });

  it("resizes the chosen picture on the phone, uploads it, and tells the app", async () => {
    const file = new File(["x"], "me.jpg", { type: "image/jpeg" });
    const { api, onPhotoChange, processImage } = setup();

    pick(file);

    expect(await screen.findByText("Photo updated.")).toBeInTheDocument();
    expect(processImage).toHaveBeenCalledWith(file);
    expect(api.updatePhoto).toHaveBeenCalledWith({ photo: "data:image/jpeg;base64,/9j/4AAQ" });
    expect(onPhotoChange).toHaveBeenCalledWith("data:image/jpeg;base64,/9j/4AAQ");
  });

  it("the camera badge and the button both open the file chooser", () => {
    setup();
    const input = screen.getByLabelText("Choose profile photo");
    const click = jest.spyOn(input, "click");

    fireEvent.click(screen.getByRole("button", { name: "Change profile photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Add photo" }));

    expect(click).toHaveBeenCalledTimes(2);
  });

  it("says why when the picture can't be used, and uploads nothing", async () => {
    const { api, onPhotoChange } = setup({ processImage: jest.fn(async () => { throw new Error("That photo is too big — choose one under 10 MB."); }) });

    pick();

    expect(await screen.findByText(/too big/)).toBeInTheDocument();
    expect(api.updatePhoto).not.toHaveBeenCalled();
    expect(onPhotoChange).not.toHaveBeenCalled();
  });

  it("shows the server's refusal and leaves the photo as it was", async () => {
    const { onPhotoChange } = setup({ updatePhoto: async () => ({ ok: false, status: 400, message: "That file isn't a real image." }) });

    pick();

    expect(await screen.findByText("That file isn't a real image.")).toBeInTheDocument();
    expect(onPhotoChange).not.toHaveBeenCalled();
  });

  it("doesn't claim success when the connection drops mid-upload", async () => {
    const { onPhotoChange } = setup({ updatePhoto: async () => offline() });

    pick();

    expect(await screen.findByText(/Your photo was not changed/)).toBeInTheDocument();
    expect(onPhotoChange).not.toHaveBeenCalled();
  });

  it("doesn't try while offline", async () => {
    const { api, processImage } = setup({ online: false });

    pick();

    expect(await screen.findByText(/need a connection to change your photo/)).toBeInTheDocument();
    expect(processImage).not.toHaveBeenCalled();
    expect(api.updatePhoto).not.toHaveBeenCalled();
  });

  it("removes the photo (and only offers that when there is one)", async () => {
    const none = setup({ photo: null });
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
    none.unmount();

    const { api, onPhotoChange } = setup({ photo: "data:image/jpeg;base64,/9j/AAA" });
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));

    expect(await screen.findByText("Photo removed.")).toBeInTheDocument();
    expect(api.updatePhoto).toHaveBeenCalledWith({ photo: null });
    expect(onPhotoChange).toHaveBeenCalledWith(null);
  });

  it("disables the buttons while a photo is saving", async () => {
    let release;
    setup({ updatePhoto: () => new Promise((r) => { release = () => r({ ok: true, status: 200, message: "" }); }) });

    pick();

    expect(await screen.findByRole("button", { name: "Saving photo…" })).toBeDisabled();
    release();
    await screen.findByText("Photo updated.");
  });
});

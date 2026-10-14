// Pure helpers for the GST connection UI: the TEST tag, the banner look, and the credentials form check.

/** Only a PRODUCTION document is a registered one. Anything else gets a tag so it can't be mistaken for a real one. */
export function modeTag(mode) {
  switch (mode) {
    case "STUB":
      return { label: "TEST · simulated", tone: "warning", title: "Simulated in STUB mode. Not registered with the GST portal — do not use for compliance." };
    case "SANDBOX":
      return { label: "TEST · sandbox", tone: "warning", title: "Issued in the provider's SANDBOX. A test document with no legal effect." };
    default:
      return null; // PRODUCTION, or an older record from before modes existed
  }
}

/** Banner colour class for the status level the server reports. LIVE shows no banner at all. */
export function bannerTone(level) {
  if (level === "BLOCKED") return "danger";
  if (level === "TEST") return "warning";
  return null;
}

// 15 characters: 2 digits (state), 5 letters, 4 digits, 1 letter, 1 letter/digit, "Z", 1 letter/digit. The server also checks the checksum.
const GSTIN_SHAPE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

export const normalizeGstin = (v) => String(v || "").trim().toUpperCase();

export const SECRET_FIELDS = [
  ["username", "hasUsername", "GSP / portal username"],
  ["password", "hasPassword", "Password"],
  ["clientId", "hasClientId", "Client ID"],
  ["clientSecret", "hasClientSecret", "Client secret"],
];

/**
 * null when the form can be saved, otherwise the sentence to show. `saved` is what the server already holds for this
 * channel: a secret may stay blank only if one is saved already, so the first save needs all four.
 */
export function credentialProblem(form, saved) {
  if (!GSTIN_SHAPE.test(normalizeGstin(form.gstin))) return "Enter the business's own 15-character GSTIN.";
  if (form.environment !== "SANDBOX" && form.environment !== "PRODUCTION") return "Choose SANDBOX or PRODUCTION.";
  const missing = SECRET_FIELDS.filter(([key, savedKey]) => !String(form[key] || "").trim() && !(saved && saved[savedKey]));
  if (missing.length) return `Enter the ${missing.map((m) => m[2].toLowerCase()).join(", ")} (needed the first time; blank keeps a saved value).`;
  const tooLong = SECRET_FIELDS.find(([key]) => String(form[key] || "").length > 150);
  if (tooLong) return `${tooLong[2]} is too long.`;
  return null;
}

/** The request body for PUT /api/Gst/Credentials. Blank secrets are sent as blank so the server keeps the saved ones. */
export function credentialRequest(type, form) {
  return {
    credentialType: type,
    gstin: normalizeGstin(form.gstin),
    environment: form.environment,
    enabled: !!form.enabled,
    username: form.username || "",
    password: form.password || "",
    clientId: form.clientId || "",
    clientSecret: form.clientSecret || "",
  };
}

/** Form state for a channel from what the server reports (secrets are never sent back, so they start blank). */
export function formFrom(saved) {
  return {
    gstin: (saved && saved.gstin) || "",
    environment: (saved && saved.environment) || "SANDBOX",
    enabled: !!(saved && saved.enabled),
    username: "",
    password: "",
    clientId: "",
    clientSecret: "",
  };
}

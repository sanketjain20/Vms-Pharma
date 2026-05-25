import { toast } from "react-toastify";

export function getApiMessage(payload, fallback = "Request failed") {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;

  const direct =
    payload.message ||
    payload.error ||
    payload.title ||
    payload.detail ||
    payload.errorMessage;
  if (direct) return String(direct);

  const validation = payload.errors || payload.validationErrors;
  if (validation) {
    if (Array.isArray(validation)) {
      return validation.map(String).join("\n");
    }

    if (typeof validation === "object") {
      return Object.entries(validation)
        .flatMap(([field, value]) => {
          const messages = Array.isArray(value) ? value : [value];
          return messages.filter(Boolean).map((message) => `${field}: ${message}`);
        })
        .join("\n");
    }
  }

  return fallback;
}

export function toastApiError(payload, fallback = "Request failed") {
  toast.error(getApiMessage(payload, fallback));
}

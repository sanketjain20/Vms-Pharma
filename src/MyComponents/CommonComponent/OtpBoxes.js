import React, { useRef } from "react";

/**
 * Numeric code entry: one box per digit, auto-advance on type, backspace
 * moves back, paste of the full code fills every box. Extracted out of
 * LoginComponent/ForgotPassword.js (which used a fixed 6 digits) so
 * LoginPage's MFA step can reuse it with an admin-configurable length
 * (see Setting.js's "Code length" MFA policy field).
 */
export default function OtpBoxes({ value, onChange, length = 6 }) {
  const refs = useRef([]);
  const digits = value.padEnd(length, " ").split("").slice(0, length);
  const indices = Array.from({ length }, (_, i) => i);

  const handleKey = (e, i) => {
    if (e.key === "Backspace") {
      const next = value.slice(0, i > 0 && !value[i] ? i - 1 : i);
      onChange(next);
      if (i > 0 && !value[i]) refs.current[i - 1]?.focus();
    }
  };
  const handleChange = (e, i) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    if (!ch) return;
    const arr = value.padEnd(length, " ").split("");
    arr[i] = ch;
    onChange(arr.join("").replace(/\s/g, "").slice(0, length));
    if (i < length - 1) refs.current[i + 1]?.focus();
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted) { onChange(pasted); refs.current[Math.min(pasted.length, length - 1)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="auth-otp-line">
      {indices.map((i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`auth-otp-cell${digits[i] && digits[i] !== " " ? " is-filled" : ""}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] !== " " ? digits[i] : ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

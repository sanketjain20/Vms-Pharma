import React, { useEffect, useState } from "react";

/**
 * A "Resend code" button that shows a countdown while disabled. No existing
 * OTP flow (ForgotPassword) had a cooldown before login MFA needed one — the
 * backend enforces the real limit (MfaGlobalSetting.resendCooldownSeconds);
 * this is purely the UI countdown so the button doesn't invite a request
 * that the backend would just reject with 429.
 */
export default function ResendTimer({ availableAt, onResend, disabled, children = "Resend code" }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!availableAt || availableAt <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [availableAt]);

  const secondsLeft = availableAt ? Math.max(0, Math.ceil((availableAt - now) / 1000)) : 0;
  const isCoolingDown = secondsLeft > 0;

  return (
    <button className="auth-link auth-resend" disabled={disabled || isCoolingDown} onClick={onResend} type="button">
      {isCoolingDown ? `Resend code in ${secondsLeft}s` : children}
    </button>
  );
}

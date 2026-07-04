import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const shortcuts = {
      p: "/products",
      v: "/vendors",
      s: "/sales",
      i: "/inventory",
      c: "/customers",
      d: "/dashboard",
      k: "/search", // quick search
    };

    const handleKeyDown = (event) => {
      // ❌ Ignore when typing in input fields
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Ctrl + Key shortcuts
      if (event.ctrlKey) {
        const key = event.key.toLowerCase();

        if (shortcuts[key]) {
          event.preventDefault();
          navigate(shortcuts[key]);
        }
      }

      // Optional: Alt shortcuts (faster ERP feel)
      if (event.altKey) {
        const key = event.key.toLowerCase();

        if (key === "p") navigate("/products");
        if (key === "v") navigate("/vendors");
        if (key === "s") navigate("/sales");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate]);
}
"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  resolveInitialTheme,
  type Theme,
} from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = resolveInitialTheme();
    setTheme(initial);
    applyTheme(initial);
    setReady(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const label = theme === "dark" ? "Light" : "Dark";

  return (
    <button
      type="button"
      className="live-icon-btn"
      onClick={toggle}
      aria-label={`Switch to ${label.toLowerCase()} theme`}
      title={`Switch to ${label.toLowerCase()} theme`}
      disabled={!ready}
    >
      {label}
    </button>
  );
}

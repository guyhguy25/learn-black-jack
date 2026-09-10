export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "learn-blackjack-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore quota / private mode
  }
}

export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? "dark";
}

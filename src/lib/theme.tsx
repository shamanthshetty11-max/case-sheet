import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const KEY = "casesync-theme";

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>({
  theme: "light",
  toggle: () => {},
  set: () => {},
});

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
  document.documentElement.style.colorScheme = t;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem(KEY) as Theme | null)) || null;
    const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial: Theme = stored ?? (prefersDark ? "dark" : "light");
    setTheme(initial);
    applyTheme(initial);
  }, []);
  function set(t: Theme) {
    setTheme(t);
    applyTheme(t);
    try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  }
  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => set(theme === "dark" ? "light" : "dark"), set }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
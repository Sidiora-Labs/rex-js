import * as React from "react";

type Theme = "light" | "dark" | "system";
type Accent = "ink" | "dx-gradient";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  accent: Accent;
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
  toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const THEME_KEY = "dx-theme";
const ACCENT_KEY = "dx-accent";

function readStored(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    return;
  }
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function isAccent(value: string | null): value is Accent {
  return value === "ink" || value === "dx-gradient";
}

function getSystem(): "light" | "dark" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system");
  const [accent, setAccentState] = React.useState<Accent>("ink");
  const [system, setSystem] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const storedTheme = readStored(THEME_KEY);
    const storedAccent = readStored(ACCENT_KEY);
    if (isTheme(storedTheme)) setThemeState(storedTheme);
    if (isAccent(storedAccent)) setAccentState(storedAccent);
    setSystem(getSystem());
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  // Keep every same-origin document (e.g. block preview iframes) in sync.
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && isTheme(e.newValue)) setThemeState(e.newValue);
      if (e.key === ACCENT_KEY && isAccent(e.newValue)) setAccentState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const resolvedTheme = theme === "system" ? system : theme;

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.classList.toggle("accent-dx-gradient", accent === "dx-gradient");
  }, [resolvedTheme, accent]);

  const setTheme = React.useCallback((t: Theme) => {
    writeStored(THEME_KEY, t);
    setThemeState(t);
  }, []);
  const setAccent = React.useCallback((a: Accent) => {
    writeStored(ACCENT_KEY, a);
    setAccentState(a);
  }, []);
  const toggleTheme = React.useCallback(
    () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    [resolvedTheme, setTheme],
  );

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, accent, setTheme, setAccent, toggleTheme }),
    [theme, resolvedTheme, accent, setTheme, setAccent, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

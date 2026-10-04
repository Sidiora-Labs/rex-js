import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "./ui/button.tsx";
import { useTheme } from "./ui/theme-provider.tsx";

export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-demo-theme-toggle={resolvedTheme}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
    >
      {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
    </Button>
  );
}

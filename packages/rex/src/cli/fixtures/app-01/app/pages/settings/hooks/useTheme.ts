export function useTheme(): string {
  return window.localStorage.getItem("app-01.theme") ?? "light";
}

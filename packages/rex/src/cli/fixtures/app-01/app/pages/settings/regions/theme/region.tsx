import { region } from "@sidioralabs/rex/client";
import { useTheme } from "../../hooks/useTheme.ts";

export default region("theme", () => {
  const theme = useTheme();
  return <p>Theme: {theme}</p>;
});

import { useCount } from "./hooks/useCount.ts";
import MainRegion from "./regions/main/region.tsx";

export default function HomeView() {
  const count = useCount();
  return (
    <article>
      <MainRegion />
      <p>{count}</p>
    </article>
  );
}

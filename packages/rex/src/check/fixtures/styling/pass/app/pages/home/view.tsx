import CardsRegion from "./regions/cards/region.tsx";

export default function HomeView() {
  return (
    <article className="grid gap-4 p-gutter bg-surface text-fg">
      <h1 className="text-2xl">Home</h1>
      <CardsRegion />
    </article>
  );
}

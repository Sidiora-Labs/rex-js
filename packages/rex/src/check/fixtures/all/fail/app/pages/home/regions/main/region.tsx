import Badge from "./parts/badge.tsx";

export default function MainRegion() {
  return (
    <section className="bg-red-500">
      <Badge />
      <canvas width={120} height={40} />
    </section>
  );
}

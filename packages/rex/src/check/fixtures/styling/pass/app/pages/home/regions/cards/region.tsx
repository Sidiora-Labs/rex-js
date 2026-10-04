import Card from "./parts/Card.tsx";

export default function CardsRegion() {
  return (
    <section
      data-rex-region="home/cards"
      className="grid gap-gutter md:grid-cols-[1fr_2fr] hover:bg-surface"
      style={{ padding: "var(--spacing-gutter)", borderColor: "#1f2937", margin: 0 }}
    >
      <Card title="Balance" />
      <p className="text-white bg-black/50 p-[1px] w-[13px] text-[14px] bg-[var(--color-surface)]">
        Synced
      </p>
    </section>
  );
}

import Badge from "./parts/Badge.tsx";

export default function ListRegion() {
  return (
    <ul className="bg-red-500 p-[3px] gap-4">
      <li onMouseEnter={() => undefined}>Preview</li>
      <li draggable>Drag me</li>
      <li style={{ color: "#ff0000", borderColor: "var(--rex-border)" }}>Red</li>
      <Badge />
    </ul>
  );
}

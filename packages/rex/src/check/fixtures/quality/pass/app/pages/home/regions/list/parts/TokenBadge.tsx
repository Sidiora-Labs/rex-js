export default function TokenBadge() {
  return (
    <rex-token-badge symbol="PAX" tabIndex={0}>
      <rex-price tabindex="0" />
      <rex-sparkline data-rex-alternative="home/show-table" />
    </rex-token-badge>
  );
}

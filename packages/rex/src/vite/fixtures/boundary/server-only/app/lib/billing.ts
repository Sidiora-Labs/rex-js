import "@sidioralabs/rex/server-only";

export function chargeCents(amount: number): number {
  return Math.round(amount * 100);
}

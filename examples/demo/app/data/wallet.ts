import { bind, memoryStore, type InferEntity } from "@sidioralabs/rex";
import { account } from "../entities/account.ts";
import { contact } from "../entities/contact.ts";
import { token } from "../entities/token.ts";

export type Account = InferEntity<typeof account>;
export type Token = InferEntity<typeof token>;
export type Contact = InferEntity<typeof contact>;

export const DEFAULT_ACCOUNT = "main";
export const DUST_THRESHOLD_USD = "1";
export const DEFAULT_SEND_AMOUNT = "0.001";

const SCALE = 1_000_000n;
const DECIMALS = 6;

export const accounts = bind(
  account,
  memoryStore(account, [
    {
      id: DEFAULT_ACCOUNT,
      name: "Main wallet",
      address: "0x5a1e000000000000000000000000000000c0ffee",
      hideDust: false,
      sendToken: "eth",
      sendContact: "alice",
      lastTransfer: null,
    },
  ]),
);

export const TOKEN_SEED: readonly Token[] = [
  { id: "dust", symbol: "DUST", name: "Dust Token", balance: "0.05", priceUsd: "0.004" },
  { id: "eth", symbol: "ETH", name: "Ether", balance: "25", priceUsd: "3000" },
  { id: "pax", symbol: "PAX", name: "Paxeer", balance: "320", priceUsd: "0.25" },
  { id: "usdc", symbol: "USDC", name: "USD Coin", balance: "1500", priceUsd: "1" },
];

export const CHANGE_24H_PCT: Readonly<Record<string, number>> = {
  dust: -12.5,
  eth: 2.84,
  pax: 6.1,
  usdc: 0.01,
};

export function change24hPct(tokenId: string): number {
  return CHANGE_24H_PCT[tokenId] ?? 0;
}

function changeUsdOf(valueUsd: string, pct: number): number {
  const value = Number(valueUsd);
  return value - value / (1 + pct / 100);
}

export const TOKEN_PRICES = TOKEN_SEED.map(({ id, symbol, name, priceUsd }) => ({
  id,
  symbol,
  name,
  priceUsd,
}));

export const tokens = bind(token, memoryStore(token, [...TOKEN_SEED]));

export const contacts = bind(
  contact,
  memoryStore(contact, [
    { id: "alice", name: "Alice", address: "0xa11ce00000000000000000000000000000000001" },
    { id: "bob", name: "Bob", address: "0xb0b0000000000000000000000000000000000002" },
    { id: "carol", name: "Carol", address: "0xca201000000000000000000000000000000000003" },
  ]),
);

export function toUnits(amount: string): bigint {
  const negative = amount.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? amount.slice(1) : amount).split(".");
  if (fraction.length > DECIMALS) {
    throw new Error(`amounts have at most ${DECIMALS} decimals, received ${amount}`);
  }
  const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(DECIMALS, "0"));
  return negative ? -units : units;
}

export function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  const text = fraction === "" ? whole.toString() : `${whole}.${fraction}`;
  return negative ? `-${text}` : text;
}

export function valueUsd(entry: Token): string {
  return fromUnits((toUnits(entry.balance) * toUnits(entry.priceUsd)) / SCALE);
}

export function isDust(entry: Token): boolean {
  return toUnits(valueUsd(entry)) < toUnits(DUST_THRESHOLD_USD);
}

export function accountIdOf(attributes: { readonly account?: unknown }): string {
  return typeof attributes.account === "string" && attributes.account.length > 0
    ? attributes.account
    : DEFAULT_ACCOUNT;
}

export async function requireAccount(id: string): Promise<Account> {
  const found = await accounts.get(id);
  if (found === undefined) throw new Error(`account "${id}" does not exist`);
  return found;
}

export function nextId(ids: readonly string[], current: string): string {
  const sorted = [...ids].sort();
  const index = sorted.indexOf(current);
  const next = sorted[(index + 1) % sorted.length];
  if (next === undefined) throw new Error("there is nothing to pick from");
  return next;
}

export async function walletOverview(accountId: string) {
  const owner = await requireAccount(accountId);
  const held = (await tokens.list()).items.map((entry) => ({
    ...entry,
    valueUsd: valueUsd(entry),
    dust: isDust(entry),
    change24hPct: change24hPct(entry.id).toFixed(2),
  }));
  const total = held.reduce((sum, entry) => sum + toUnits(entry.valueUsd), 0n);
  const changeUsd = held.reduce(
    (sum, entry) => sum + changeUsdOf(entry.valueUsd, Number(entry.change24hPct)),
    0,
  );
  const totalNumber = Number(fromUnits(total));
  const before = totalNumber - changeUsd;
  return {
    account: owner,
    tokens: held,
    contacts: (await contacts.list()).items,
    totalUsd: fromUnits(total),
    change24hUsd: changeUsd.toFixed(2),
    change24hPct: (before === 0 ? 0 : (changeUsd / before) * 100).toFixed(2),
  };
}

export async function tokenPrices() {
  return (await tokens.list()).items.map(({ id, symbol, name, priceUsd }) => ({
    id,
    symbol,
    name,
    priceUsd,
  }));
}

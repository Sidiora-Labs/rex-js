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

export const tokens = bind(
  token,
  memoryStore(token, [
    { id: "dust", symbol: "DUST", name: "Dust Token", balance: "0.05", priceUsd: "0.004" },
    { id: "eth", symbol: "ETH", name: "Ether", balance: "25", priceUsd: "3000" },
    { id: "pax", symbol: "PAX", name: "Paxeer", balance: "320", priceUsd: "0.25" },
    { id: "usdc", symbol: "USDC", name: "USD Coin", balance: "1500", priceUsd: "1" },
  ]),
);

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
  }));
  const total = held.reduce((sum, entry) => sum + toUnits(entry.valueUsd), 0n);
  return {
    account: owner,
    tokens: held,
    contacts: (await contacts.list()).items,
    totalUsd: fromUnits(total),
  };
}

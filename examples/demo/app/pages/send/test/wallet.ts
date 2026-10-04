import type { Actor, ActorInput } from "@sidioralabs/rex";
import { createTestApp, setupRexTesting, type TestApp } from "@sidioralabs/rex/testing";
import app from "rex:app";
import { afterEach } from "vitest";
import { DEFAULT_ACCOUNT, accounts, contacts, tokens } from "../../../data/wallet.ts";

const seed = {
  accounts: (await accounts.list()).items,
  tokens: (await tokens.list()).items,
  contacts: (await contacts.list()).items,
};

export async function restoreWallet(): Promise<void> {
  await Promise.all([
    ...seed.accounts.map((record) => accounts.put(record)),
    ...seed.tokens.map((record) => tokens.put(record)),
    ...seed.contacts.map((record) => contacts.put(record)),
  ]);
}

export function setupWalletTests(): void {
  setupRexTesting({ afterEach });
  afterEach(restoreWallet);
}

export function walletApp(actor: Actor | ActorInput): TestApp {
  return createTestApp(app, { actor });
}

export async function tokenBalance(id: string): Promise<string | undefined> {
  return (await tokens.get(id))?.balance;
}

export async function mainAccount() {
  return accounts.get(DEFAULT_ACCOUNT);
}

import { policy } from "@sidioralabs/rex";

const WALLET_PERMISSIONS = ["wallet.send", "wallet.manage"] as const;

export const wallet = policy("wallet", {
  permissions: WALLET_PERMISSIONS,
  resolve: (actor) =>
    WALLET_PERMISSIONS.filter((permission) => actor.permissions.includes(permission)),
});

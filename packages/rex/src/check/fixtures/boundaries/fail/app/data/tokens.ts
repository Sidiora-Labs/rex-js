import { bind, memoryStore } from "@sidioralabs/rex";
import { token } from "../entities/token.ts";

export const tokenStore = bind(token, memoryStore(token));

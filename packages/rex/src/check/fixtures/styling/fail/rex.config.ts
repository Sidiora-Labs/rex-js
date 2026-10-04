import { defineConfig } from "@sidioralabs/rex/config";
import app from "rex:app";

const colors = ["#000000"];

export default defineConfig({ app, check: { tokens: { colors } } });

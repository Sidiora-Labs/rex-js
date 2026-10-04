import { buildDemo } from "./walk.ts";

const EXTERNAL_DEMO_URL = "REX_DEMO_URL";

export default function globalSetup(): void {
  const external = process.env[EXTERNAL_DEMO_URL];
  if (external !== undefined && external !== "") return;
  buildDemo();
}

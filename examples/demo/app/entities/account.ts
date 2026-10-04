import { entity } from "@sidioralabs/rex";
import { boolean, id, ref, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export const account = entity("account", {
  fields: {
    id: id(),
    name: text({ min: 1 }),
    address: text({ min: 1 }),
    hideDust: boolean(),
    sendToken: ref("token"),
    sendContact: ref("contact"),
    lastTransfer: z.nullable(text({ min: 1 })),
  },
  label: (record) => record.name,
});

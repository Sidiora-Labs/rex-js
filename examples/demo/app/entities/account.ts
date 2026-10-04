import { boolean, entity, id, ref, text } from "@sidioralabs/rex";
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

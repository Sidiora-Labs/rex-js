import { boolean, entity, id, ref, text } from "@sidioralabs/rex";

export const account = entity("account", {
  fields: {
    id: id(),
    name: text({ min: 1 }),
    address: text({ min: 1 }),
    hideDust: boolean(),
    sendToken: ref("token"),
    sendContact: ref("contact"),
    lastTransfer: text({ min: 1 }).nullable(),
  },
  label: (record) => record.name,
});

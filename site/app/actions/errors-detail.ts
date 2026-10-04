import { REX_ERROR_CATALOG, action, always, type RexErrorCode } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { errorDetail } from "../server/content/errors.ts";

const codes = Object.keys(REX_ERROR_CATALOG).sort() as [RexErrorCode, ...RexErrorCode[]];
const code = z.enum(codes);

export const errorsDetail = action("errors-detail", {
  input: z.object({ code }),
  output: z.object({
    code,
    area: z.string(),
    areaTitle: z.string(),
    prefix: z.string(),
    message: z.string(),
    hint: z.string(),
    docs: z.string(),
    route: z.string(),
    doc: z.object({ slug: z.string(), title: z.string(), href: z.string() }),
    previous: z.nullable(code),
    next: z.nullable(code),
  }),
  policy: always(),
  effect: "read",
  label: "Read one error code",
  handler: (input) => errorDetail(input.code),
});

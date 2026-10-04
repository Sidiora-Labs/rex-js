import { REX_ERROR_CATALOG, page, type RexErrorCode } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { errorsDetail } from "../../actions/errors-detail.ts";

const codes = Object.keys(REX_ERROR_CATALOG).sort() as [RexErrorCode, ...RexErrorCode[]];

export default page("error", {
  route: "/errors/:code",
  params: z.object({ code: z.enum(codes) }),
  render: "static",
  paths: () => codes.map((code) => ({ code })),
  load: { detail: errorsDetail },
  chrome: { title: "Error code", header: false, back: "errors" },
  regions: ["detail"],
});

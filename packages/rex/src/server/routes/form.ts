import { ORPCError, call } from "@orpc/server";
import type { Context, Hono } from "hono";
import type { AnyAction } from "../../core/action.ts";
import type { JsonSchema } from "../../core/schema.ts";
import type { StandardIssue } from "../../core/standard.ts";
import type { ManifestAction } from "../../manifest/types.ts";
import type { RexServerSetup } from "../app.ts";
import {
  RexDensityError,
  createRexContext,
  type RexContext,
} from "../context.ts";
import {
  CONFIRM_FIELD,
  CSRF_FIELD,
  FORM_PREFIX,
  coerceFormData,
  ensureCsrfToken,
  fieldErrors,
  formEntries,
  formRedirectTarget,
  outcomeCookie,
  readCsrfToken,
  refererPath,
  renderConfirmPage,
  renderFormErrorPage,
  submittedActionId,
  verifyCsrf,
  type FormOutcome,
} from "../form.ts";
import {
  ORIGIN_HEADER,
  isAllowedOrigin,
  resolveSecurityPolicy,
} from "../middleware/security.ts";
import {
  CONFIRM_PROCEDURE,
  buildActionRouter,
  type ActionProcedure,
  type ConfirmProcedure,
} from "../router.ts";

export const FORM_ROUTE = `${FORM_PREFIX}/:action`;

const FORM_CONTENT_TYPES = [
  "application/x-www-form-urlencoded",
  "multipart/form-data",
];

interface FormTarget {
  readonly declared: AnyAction;
  readonly schema: JsonSchema;
  readonly procedure: ActionProcedure<AnyAction>;
}

function manifestActions(body: string): ReadonlyMap<string, ManifestAction> {
  const parsed = JSON.parse(body) as {
    readonly actions?: readonly ManifestAction[];
  };
  return new Map(
    (parsed.actions ?? []).map((declared) => [declared.id, declared]),
  );
}

function actionLabel(declared: AnyAction): string {
  return declared.label ?? declared.id;
}

function errorPage(
  c: Context,
  status: 400 | 403 | 404 | 415,
  title: string,
  message: string,
  setCookie: string | null = null,
): Response {
  const back = refererPath(c.req.raw) ?? "/";
  const response = c.html(
    renderFormErrorPage({ title, message, back }),
    status,
  );
  if (setCookie !== null) response.headers.append("set-cookie", setCookie);
  return response;
}

function issuesOf(error: ORPCError<string, unknown>): readonly StandardIssue[] {
  const data = error.data;
  if (typeof data !== "object" || data === null) return [];
  const issues = (data as { readonly issues?: unknown }).issues;
  return Array.isArray(issues) ? (issues as readonly StandardIssue[]) : [];
}

function reasonOf(error: ORPCError<string, unknown>): string | null {
  const data = error.data;
  if (typeof data !== "object" || data === null) return null;
  const reason = (data as { readonly reason?: unknown }).reason;
  return typeof reason === "string" ? reason : null;
}

function failureOutcome(declared: AnyAction, error: unknown): FormOutcome {
  const label = actionLabel(declared);
  const at = new Date().toISOString();
  if (!(error instanceof ORPCError)) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      actionId: declared.id,
      ok: false,
      message: `${label} failed: ${message}`,
      at,
      code: "INTERNAL_SERVER_ERROR",
      fields: {},
    };
  }
  const typed = error as ORPCError<string, unknown>;
  const issues = issuesOf(typed);
  if (typed.code === "BAD_REQUEST" && issues.length > 0) {
    const fields = fieldErrors(issues);
    const summary = Object.entries(fields)
      .map(([name, messages]) => `${name} ${messages.join(", ")}`)
      .join("; ");
    return {
      actionId: declared.id,
      ok: false,
      message: `${label}: invalid input: ${summary}`,
      at,
      code: typed.code,
      fields,
    };
  }
  if (typed.code === "FORBIDDEN") {
    return {
      actionId: declared.id,
      ok: false,
      message: `${label}: not allowed (${reasonOf(typed) ?? typed.message})`,
      at,
      code: typed.code,
      fields: {},
    };
  }
  return {
    actionId: declared.id,
    ok: false,
    message: `${label} failed: ${typed.message}`,
    at,
    code: typed.code,
    fields: {},
  };
}

function redirectWithOutcome(
  c: Context,
  location: string,
  outcome: FormOutcome,
): Response {
  const response = c.redirect(location, 303);
  response.headers.append("set-cookie", outcomeCookie(outcome, c.req.raw));
  return response;
}

function formContext(
  base: RexContext,
  confirm: string | undefined,
): RexContext {
  return {
    actor: base.actor,
    density: base.density,
    confirm,
    nonce: base.nonce,
    locale: base.locale,
  };
}

export function installFormRoute(app: Hono, setup: RexServerSetup): void {
  const options = setup.options;
  const router = buildActionRouter(
    options.registry,
    options.confirmTtlMs === undefined
      ? { ledger: options.ledger }
      : { ledger: options.ledger, confirmTtlMs: options.confirmTtlMs },
  ) as unknown as Readonly<Record<string, ActionProcedure<AnyAction>>> & {
    readonly [CONFIRM_PROCEDURE]: ConfirmProcedure;
  };
  const schemas = manifestActions(setup.manifestBody);
  const targets = new Map<string, FormTarget>();
  for (const declared of options.registry.actions) {
    const procedure = router[declared.id];
    if (procedure === undefined) continue;
    const manifest = schemas.get(declared.id);
    if (manifest === undefined) {
      throw new Error(
        `installFormRoute: action "${declared.id}" is missing from the manifest`,
      );
    }
    targets.set(declared.id, { declared, schema: manifest.input, procedure });
  }
  const confirmProcedure = router[CONFIRM_PROCEDURE];
  const origins = resolveSecurityPolicy(options).security.origins;

  app.post(FORM_ROUTE, async (c) => {
    const request = c.req.raw;
    if (!isAllowedOrigin(request.headers.get(ORIGIN_HEADER), request.url, origins)) {
      return errorPage(
        c,
        403,
        "Form rejected",
        "The form was posted from an origin this server does not accept.",
      );
    }
    const target = targets.get(c.req.param("action"));
    if (target === undefined) {
      return errorPage(
        c,
        404,
        "Unknown action",
        `No action "${c.req.param("action")}" exists.`,
      );
    }
    const { declared, schema, procedure } = target;
    const contentType = (
      request.headers.get("content-type") ?? ""
    ).toLowerCase();
    if (!FORM_CONTENT_TYPES.some((type) => contentType.startsWith(type))) {
      return errorPage(
        c,
        415,
        "Unsupported form encoding",
        "Post the form as application/x-www-form-urlencoded or multipart/form-data.",
      );
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return errorPage(
        c,
        400,
        "Unreadable form",
        "The form body could not be read.",
      );
    }
    const cookieToken = readCsrfToken(request);
    if (!verifyCsrf(cookieToken, form.get(CSRF_FIELD))) {
      return errorPage(
        c,
        403,
        "Form expired",
        "The form security token is missing or does not match. Go back, reload the page and submit again.",
        cookieToken === null ? ensureCsrfToken(request).setCookie : null,
      );
    }
    const submitted = submittedActionId(form, schema);
    if (submitted !== null && submitted !== declared.id) {
      return errorPage(
        c,
        400,
        "Mismatched action",
        `The form names action "${submitted}" but was posted to "${declared.id}".`,
      );
    }
    let base: RexContext;
    try {
      base = await createRexContext(request, options.actor);
    } catch (error) {
      if (error instanceof RexDensityError) {
        return errorPage(c, 400, "Invalid density", error.message);
      }
      throw error;
    }
    const input = coerceFormData(form, schema);
    const back = refererPath(request) ?? "/";
    const confirmField = form.get(CONFIRM_FIELD);
    const confirm =
      typeof confirmField === "string" && confirmField !== ""
        ? confirmField
        : undefined;

    if (declared.effect === "irreversible" && confirm === undefined) {
      try {
        const grant = await call(
          confirmProcedure,
          { action: declared.id, input },
          { context: formContext(base, undefined) },
        );
        return c.html(
          renderConfirmPage({
            actionId: declared.id,
            label: actionLabel(declared),
            title:
              declared.form?.confirmTitle ?? `Confirm ${actionLabel(declared)}`,
            input,
            entries: formEntries(form, schema),
            csrf: cookieToken as string,
            token: grant.token,
            cancel: back,
            expiresAt: grant.expiresAt,
          }),
          200,
        );
      } catch (error) {
        return redirectWithOutcome(c, back, failureOutcome(declared, error));
      }
    }

    try {
      await call(procedure, input, { context: formContext(base, confirm) });
    } catch (error) {
      return redirectWithOutcome(c, back, failureOutcome(declared, error));
    }
    return redirectWithOutcome(
      c,
      formRedirectTarget(request, declared.form?.redirect ?? null),
      {
        actionId: declared.id,
        ok: true,
        message: `${actionLabel(declared)} succeeded`,
        at: new Date().toISOString(),
        code: null,
        fields: {},
      },
    );
  });
}

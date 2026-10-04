# A form that works without JavaScript

Every action is also reachable as an HTML form post at `/rex/form/<action>`. `ActionForm` from `@sidioralabs/rex/client` renders that form: without JavaScript the browser posts it and the server answers with a redirect; with JavaScript the submit is intercepted and runs through the same invoker as `act(action).run`, with the same confirmation and outcome handling.

## 1. Optionally tune the form route on the action

`action()` accepts `form: { redirect?, confirmTitle? }`:

```ts
import { action } from "@sidioralabs/rex";
import { money, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { wallet } from "../policies/wallet.ts";

export const send = action("send", {
  input: z.object({ amount: money() }),
  output: z.object({ transfer: text({ min: 1 }), balance: money() }),
  policy: wallet.requires({ unlocked: true, account: true, permissions: ["wallet.send"] }),
  effect: "irreversible",
  label: "Send",
  form: { redirect: "/send", confirmTitle: "Send tokens" },
  handler: async (input, ctx) => {
    // ...
  },
});
```

- `redirect` is the path the form route redirects to after the post (a path on this origin starting with `/`). Without it the route redirects to the path of the `Referer`, or `/`.
- `confirmTitle` is the heading of the server-rendered confirmation page for an irreversible action.

`action()` rejects any other key under `form` with `REX207`.

## 2. Render `ActionForm` in a region

`ActionForm` takes the action declaration, so it belongs in `region.tsx`, which may import `app/actions`. The action must be declared by the page in `page.ts` (`actions: [send]`); otherwise `ActionForm` throws.

```tsx
import { ActionForm, region } from "@sidioralabs/rex/client";
import { send } from "../../../../actions/send.ts";

export default region("form", () => (
  <ActionForm action={send} defaultValues={{ amount: "0.5" }} submitLabel="Send" />
));
```

Props:

| Prop            | Meaning                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| `action`        | the action declaration                                                            |
| `defaultValues` | initial values of the generated inputs                                            |
| `submitLabel`   | the submit button text; the action label by default                               |
| `children`      | your own inputs instead of the generated ones; name them by the input field paths |
| `onResult`      | called with the `ActResult` after a JavaScript submit                             |

The rendered markup is a real form:

```html
<form method="post" action="/rex/form/send" aria-label="Send" data-rex-form="send/send">
  <input type="hidden" name="_csrf" value="..." />
  <input type="hidden" name="_action" value="send" />
  <!-- one labelled input per field of the input JSON Schema -->
  <button type="submit" data-rex="send/send">Send</button>
</form>
```

Inputs are derived from the action's input JSON Schema in the manifest: strings render as text inputs, numbers and integers as number inputs, booleans as checkboxes, enums as selects and arrays as multi-selects; nested objects are flattened into dotted field paths such as `recipient.name`. The submit button carries the action's `data-rex` address and its allowed state, like any control bound with `act()`.

## What the form route does

`POST /rex/form/<action>` (`packages/rex/src/server/routes/form.ts`):

1. accepts `multipart/form-data` or `application/x-www-form-urlencoded`;
2. checks `Origin`: the same origin, or one listed in the `security: { origins }` option of `createRexServer`;
3. checks the double-submit CSRF token: the `_csrf` field must equal the `rex-csrf` cookie, which `ActionForm` writes in the browser (`SameSite=Lax`, `Secure` on https) when the server rendered no token;
4. coerces the fields with the input schema (numbers, booleans, and arrays from repeated names);
5. for an irreversible action posted without `_confirm`, answers with a confirmation page instead of running it (below);
6. runs the action through the action router, so policy, validation and the audit record are the same as for an RPC call;
7. writes the outcome into the `rex-outcome` cookie (60 seconds) and answers `303 See Other` to `form.redirect`, the `Referer` path, or `/`.

On the next render the outcome region shows the cookie outcome and clears the cookie. When validation fails, the outcome carries the field errors and `ActionForm` renders each one next to its field (`data-rex-field-error="<path>"`); errors for fields it did not render are listed under the form.

## The confirmation page

An irreversible action posted without `_confirm` gets a server-rendered page: a `role="alertdialog"` section with `data-rex-confirm="<page>/<action>"`, the `confirmTitle` (or the label) as heading, every submitted field listed in a `<dl data-rex-confirm-input>`, the expiry time of the confirmation, a `Confirm <label>` submit button (`data-rex-confirm-accept`) that posts the same input with `_confirm`, and a Cancel link (`data-rex-confirm-cancel`) back to where the form was. With JavaScript, the same action opens the in-page confirmation dialog instead.

## Try it without JavaScript

Disable JavaScript in the browser, open the page, submit the form, and check the outcome region after the redirect. In Playwright, create the context with `javaScriptEnabled: false` and assert the audit record the post wrote.

## Checks

- A page rendered `static` must render every action as a form; `rex build` fails with "action ... is not rendered as a form; render it with ActionForm so it works without JavaScript" otherwise. See [Ship a static page](static-page.md).
- The form route refuses a post without a matching CSRF token or from an origin that is not allowed, before the action runs.

Related: [agent-contract.md](../agent-contract.md#confirmation-protocol), [migration.md](../migration.md#upgrading-from-01-to-02) for the Origin check.

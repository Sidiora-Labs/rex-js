# Gate a flow on an approval

A flow is a sequence of action steps and approval gates whose progress is kept in a journal. When an instance reaches an approval gate it pauses; the page that shows the flow gains an Approve and a Reject affordance for the actors the gate allows, and the decision is written to the audit ledger. This recipe gates a large transfer in the wallet on a review.

## 1. Declare the flow

```sh
rex make flow large-send
```

writes `app/flows/large-send.ts` with one approval gate `review` and `memoryJournal()`. Edit it to run steps around the gate:

```ts
import { flow, memoryJournal } from "@sidioralabs/rex";
import { loadWallet } from "../actions/load-wallet.ts";
import { send } from "../actions/send.ts";
import { wallet } from "../policies/wallet.ts";

export const largeSend = flow("large-send", {
  steps: [
    { action: loadWallet, input: () => ({}) },
    { approval: "review", label: "Review the transfer", approvers: wallet.can("wallet.manage") },
    { action: send, input: (ctx) => ctx.input },
  ],
  journal: memoryJournal(),
});
```

- An action step names an action and maps the flow context (`actor`, the flow `input`, and the `outputs` of earlier steps) to that action's input. The step evaluates the action's policy for the actor running the flow, validates the input and runs the handler.
- An approval step has an id (`approval`, a Rex name), a `label` and an `approvers` predicate: any policy predicate such as `wallet.can("wallet.manage")`, `wallet.requires({ ... })` or `always()`.
- `journal` stores instances. `memoryJournal()` keeps them in memory; implement the `Journal` interface (`open`, `record`, `load`, `list`) for a durable store.

`flow()` validates the steps when the module loads and rejects an empty step list, unknown keys and invalid gate names with a `RexDeclarationError`.

## 2. Serve it

Nothing to wire: `createRexServer` serves every registered flow at `/rex/flow` with three procedures, `status`, `start` and `decide`, all taking `{ flow, instance }` (`start` also takes `input`, `decide` takes `decision: "approve" | "reject"`). `start` runs the instance from its first incomplete step until it completes, fails or pauses at a gate. `decide` requires a pending gate and an actor the gate allows, records the decision and resumes the instance or ends it as `rejected`. Every decision appends an audit record with action id `<flow>.<gate>.<decision>`, effect `irreversible` and the outcome.

## 3. Show it on a page

`useFlow(flow, instanceId)` from `@sidioralabs/rex/client` loads the instance status and returns a handle:

| Field | Meaning |
| --- | --- |
| `state` | `{ status, gate, ... }` from the server, `null` before the first load |
| `gate` | the approval step the instance is paused at, or `null` |
| `allowed`, `reason` | whether the current actor may decide the gate, and why not |
| `start(input?)` | start or resume the instance |
| `approve()`, `reject()` | decide the gate (with confirmation) |
| `approveProps`, `rejectProps` | props for the two controls, `null` when no gate is pending |
| `pending`, `error`, `refresh()` | request state |

A region binds it to a part:

```tsx
import { region, useFlow } from "@sidioralabs/rex/client";
import { largeSend } from "../../../../flows/large-send.ts";
import ReviewGate from "./parts/ReviewGate.tsx";

export default region("review", () => {
  const review = useFlow(largeSend, "transfer-42");
  return (
    <ReviewGate
      status={review.state?.status ?? "idle"}
      gate={review.gate?.label ?? null}
      approve={review.approveProps}
      reject={review.rejectProps}
      onStart={() => {
        void review.start({ amount: "250" });
      }}
    />
  );
});
```

The part spreads `approve` and `reject` on its buttons (`<button {...approve}>Approve</button>`); each carries `data-rex="<page>/large-send.review.approve"` (or `.reject`), `data-rex-allowed`, `disabled` and the reason as `title` when the actor may not decide.

## What agents see

While the instance is paused at `review`, the page's sidecar and palette list two more actions, `large-send.review.approve` and `large-send.review.reject`, labelled "Approve Review the transfer" and "Reject Review the transfer", with effect `irreversible`, an empty input schema, the routes `click` and `palette`, and `allowed` and `reason` from the gate's `approvers`. A decision goes through the confirmation dialog like any irreversible action, and the result is written to the outcome region.

Related: [primitives.md](../primitives.md#flow), [agent-contract.md](../agent-contract.md#flow-approval-gates).

# Database transactions

Rex's Drizzle store accepts an async SQLite database or its native Drizzle
transaction. Create all participating stores from the transaction passed to the
callback. Await the callback's work before returning; Drizzle commits on success
and rolls back when the callback throws.

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { bind, entity } from "@sidioralabs/rex";
import { id, integer } from "@sidioralabs/rex/schema";
import { createTableStatement, drizzleStore } from "@sidioralabs/rex/store/drizzle";

const account = entity("account", {
  fields: { id: id(), balance: integer() },
  label: (record) => record.id,
});
const transfer = entity("transfer", {
  fields: { id: id(), amount: integer() },
  label: (record) => record.id,
});

const client = createClient({ url: "file:app.db" });
const db = drizzle(client);

// Initial setup only; use application-owned migrations for schema changes.
await db.run(createTableStatement(account));
await db.run(createTableStatement(transfer));

await db.transaction(async (tx) => {
  const accounts = bind(account, drizzleStore(account, tx, { createTable: false }));
  const transfers = bind(transfer, drizzleStore(transfer, tx, { createTable: false }));
  await accounts.put({ id: "owner", balance: 80 });
  await transfers.put({ id: "transfer-1", amount: 20 });
});

// Close during application shutdown, after all database work has settled.
client.close();
```

Keep the database module server-only. An Action handler can call an
application-owned function containing this transaction; Rex does not start a
transaction automatically or put one in ActionContext. Transaction-bound stores
must stay inside the callback. A store constructed from the outer database does
not join the transaction, and returning a store does not extend its lifetime.

Create tables before entering the transaction and set `createTable: false` on
each transaction-bound store. `CREATE TABLE IF NOT EXISTS` initializes a missing
table; it does not migrate an existing schema. The application owns migration
ordering and locking, database credentials, connection reuse, pool limits,
timeouts, retries and shutdown. Configure these through the chosen driver and
deployment platform. Rex does not prevent serverless connection exhaustion.

The regression coverage uses real local libsql: commit and rollback across two
stores, and visibility from a second connection to the same WAL database while a
write transaction remains open. The reader sees the previously committed values
until commit. This does not qualify remote libsql, concurrent writers, other SQL
dialects or distributed transactions. A list's count and rows are separate
queries; consistency outside a suitable native transaction is not guaranteed.

Database atomicity does not include Rex's audit append, external network calls
or a queue publish. Keep durable delivery and idempotency in the application's
chosen database/queue integration; a successful transaction alone is not
exactly-once Action execution.

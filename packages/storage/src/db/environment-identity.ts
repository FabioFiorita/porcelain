import { randomUUID } from 'node:crypto';
import { Effect } from 'effect';
import { SqlClient } from 'effect/sql';

export const createEnvironmentIdentity = Effect.fn(
  'Storage.createEnvironmentIdentity',
)(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`INSERT INTO environment (singleton, id) VALUES (1, ${randomUUID()}) ON CONFLICT (singleton) DO NOTHING`;
});

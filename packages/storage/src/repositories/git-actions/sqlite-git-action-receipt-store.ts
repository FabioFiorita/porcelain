import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import type { GitActionReceipt } from '@porcelain/git-actions/models';
import { GitActionReceiptRow } from '../../db/models/git-action-receipts.ts';

function receiptFromRow({
  reason,
  message,
  result,
  finishedAt,
  dismissedAt,
  ...receipt
}: GitActionReceiptRow): GitActionReceipt {
  return {
    ...receipt,
    ...(reason === null ? {} : { reason }),
    ...(message === null ? {} : { message }),
    ...(result === null ? {} : { result }),
    ...(finishedAt === null ? {} : { finishedAt }),
    ...(dismissedAt === null ? {} : { dismissedAt }),
  };
}
function receiptRow(receipt: GitActionReceipt) {
  return {
    ...receipt,
    reason: receipt.reason ?? null,
    message: receipt.message ?? null,
    result: receipt.result ?? null,
    finishedAt: receipt.finishedAt ?? null,
    dismissedAt: receipt.dismissedAt ?? null,
  };
}
export const sqliteGitActionReceiptStoreLayer = Layer.effect(
  GitActionReceiptStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // Keep the execution fence separate from the public receipt's running state.
    // Shipped receipts without a fence predate durable execution and are ambiguous.
    yield* sql`CREATE TABLE IF NOT EXISTS porcelain_git_action_execution_v1 (
      request_id TEXT PRIMARY KEY REFERENCES git_action_receipts(request_id) ON DELETE CASCADE,
      phase TEXT NOT NULL CHECK (phase IN ('queued', 'started'))
    )`.pipe(Effect.orDie);
    const read = SqlSchema.findOneOption({
      Request: Schema.Struct({ requestId: Schema.String }),
      Result: GitActionReceiptRow,
      execute: (input) =>
        sql`SELECT * FROM git_action_receipts WHERE request_id = ${input.requestId}`,
    });
    const running = SqlSchema.findAll({
      Request: Schema.Void,
      Result: GitActionReceiptRow,
      execute: () =>
        sql`SELECT * FROM git_action_receipts WHERE state = 'running'`,
    });
    const latest = SqlSchema.findOneOption({
      Request: Schema.Struct({ worktreeId: Schema.String }),
      Result: GitActionReceiptRow,
      execute: (input) =>
        sql`SELECT * FROM git_action_receipts WHERE worktree_id = ${input.worktreeId} AND state = 'interrupted' AND dismissed_at IS NULL ORDER BY finished_at DESC LIMIT 1`,
    });
    const finished = SqlSchema.findAll({
      Request: Schema.Void,
      Result: Schema.Struct({
        requestId: Schema.String,
        finishedAt: Schema.String,
      }),
      execute: () =>
        sql`SELECT request_id, finished_at FROM git_action_receipts WHERE finished_at IS NOT NULL`,
    });

    return GitActionReceiptStore.of({
      read: Effect.fn('GitActionReceiptStore.read')(function* (
        input: Parameters<GitActionReceiptStore['read']>[0],
      ) {
        return Option.getOrUndefined(
          Option.map(yield* read(input).pipe(Effect.orDie), receiptFromRow),
        );
      }),
      running: Effect.fn('GitActionReceiptStore.running')(function* () {
        return (yield* running(undefined).pipe(Effect.orDie)).map(
          receiptFromRow,
        );
      }),
      latestInterrupted: Effect.fn('GitActionReceiptStore.latestInterrupted')(
        function* (
          input: Parameters<GitActionReceiptStore['latestInterrupted']>[0],
        ) {
          return Option.getOrUndefined(
            Option.map(yield* latest(input).pipe(Effect.orDie), receiptFromRow),
          );
        },
      ),
      finished: Effect.fn('GitActionReceiptStore.finished')(function* () {
        return yield* finished(undefined).pipe(Effect.orDie);
      }),
      insert: Effect.fn('GitActionReceiptStore.insert')(function* (
        input: Parameters<GitActionReceiptStore['insert']>[0],
      ) {
        return yield* Effect.gen(function* () {
          const row = yield* Schema.encodeEffect(GitActionReceiptRow.insert)(
            receiptRow(input),
          );
          yield* sql`INSERT INTO git_action_receipts ${sql.insert(row)}`;
          yield* sql`INSERT INTO porcelain_git_action_execution_v1 (request_id, phase) VALUES (${input.requestId}, 'queued')`;
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      claimExecution: Effect.fn('GitActionReceiptStore.claimExecution')(
        function* (
          input: Parameters<GitActionReceiptStore['claimExecution']>[0],
        ) {
          const claimed =
            yield* sql`UPDATE porcelain_git_action_execution_v1 SET phase = 'started' WHERE request_id = ${input.requestId} AND phase = 'queued' RETURNING request_id`.pipe(
              Effect.orDie,
            );
          return claimed.length === 1;
        },
      ),
      save: Effect.fn('GitActionReceiptStore.save')(function* (
        input: Parameters<GitActionReceiptStore['save']>[0],
      ) {
        return yield* Effect.gen(function* () {
          const row = yield* Schema.encodeEffect(GitActionReceiptRow.insert)(
            receiptRow(input),
          );
          yield* sql`UPDATE git_action_receipts SET ${sql.update(row, ['requestId', 'projectId', 'worktreeId'])} WHERE request_id = ${input.requestId}`;
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      remove: Effect.fn('GitActionReceiptStore.remove')(function* (
        input: Parameters<GitActionReceiptStore['remove']>[0],
      ) {
        if (!input.requestIds.length) return;
        yield* sql`DELETE FROM git_action_receipts WHERE ${sql.in('requestId', input.requestIds)}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);

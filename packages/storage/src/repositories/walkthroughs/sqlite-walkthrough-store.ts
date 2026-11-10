import { Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';
import { WalkthroughStore } from '@porcelain/walkthroughs/ports';
import {
  answerStateSchema,
  walkthroughJobSchema,
  type EvidenceAsset,
  type AnswerState,
  type PostState,
  type StoredWalkthroughMessage,
  type WalkthroughFailure,
  type WalkthroughJob,
  type WalkthroughRun,
} from '@porcelain/walkthroughs/models';

type MessageRow = {
  id: string;
  runId: string;
  worktreeId: string;
  stopTitle: string | null;
  text: string;
  createdAt: string;
  postStatus: string;
  postUrl: string | null;
  postedAt: string | null;
  answer: string;
};
const postState = (row: MessageRow): PostState =>
  row.postStatus === 'posted' && row.postUrl !== null && row.postedAt !== null
    ? { status: 'posted', url: row.postUrl, postedAt: row.postedAt }
    : row.postStatus === 'saved'
      ? { status: 'saved' }
      : { status: 'none' };
const decodeAnswer = Schema.decodeUnknownSync(
  Schema.fromJsonString(answerStateSchema),
);
const message = (row: MessageRow): StoredWalkthroughMessage => ({
  id: row.id,
  runId: row.runId,
  worktreeId: row.worktreeId,
  stopTitle: row.stopTitle ?? undefined,
  text: row.text,
  createdAt: row.createdAt,
  post: postState(row),
  answer: decodeAnswer(row.answer),
});

export const sqliteWalkthroughStoreLayer = Layer.effect(
  WalkthroughStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const decode = Schema.decodeUnknownSync(
      Schema.fromJsonString(walkthroughJobSchema),
    );
    return WalkthroughStore.of({
      accept: Effect.fn('WalkthroughStore.accept')(function* (
        job: WalkthroughJob,
      ) {
        return yield* Effect.gen(function* () {
          yield* sql`INSERT INTO walkthrough_runs (id, worktree_id, head_oid, status, payload) VALUES (${job.run.id}, ${job.run.worktreeId}, ${job.run.headOid}, 'queued', ${JSON.stringify(job)}) ON CONFLICT(worktree_id, head_oid) WHERE status != 'failed' DO NOTHING`;
          const rows = yield* sql<{
            payload: string;
          }>`SELECT payload FROM walkthrough_runs WHERE worktree_id = ${job.run.worktreeId} AND head_oid = ${job.run.headOid} ORDER BY sequence DESC LIMIT 1`;
          return decode(rows[0]?.payload).run;
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      read: Effect.fn('WalkthroughStore.read')(function* (worktreeId: string) {
        const rows = yield* sql<{
          payload: string;
        }>`SELECT payload FROM walkthrough_runs WHERE worktree_id = ${worktreeId} ORDER BY sequence DESC LIMIT 1`.pipe(
          Effect.orDie,
        );
        return rows[0] === undefined ? undefined : decode(rows[0].payload).run;
      }),
      listPending: Effect.fn('WalkthroughStore.listPending')(function* () {
        const rows = yield* sql<{
          payload: string;
        }>`SELECT payload FROM walkthrough_runs WHERE status IN ('queued', 'running') ORDER BY sequence`.pipe(
          Effect.orDie,
        );
        return rows.map((row) => decode(row.payload));
      }),
      claim: Effect.fn('WalkthroughStore.claim')(function* (id: string) {
        const rows =
          yield* sql`UPDATE walkthrough_runs SET status = 'running', payload = json_set(payload, '$.run.state', json('{"status":"running"}')) WHERE id = ${id} AND status = 'queued' RETURNING id`.pipe(
            Effect.orDie,
          );
        return rows.length === 1;
      }),
      save: Effect.fn('WalkthroughStore.save')(function* (run: WalkthroughRun) {
        yield* sql`UPDATE walkthrough_runs SET status = ${run.state.status}, payload = json_set(payload, '$.run', json(${JSON.stringify(run)})) WHERE id = ${run.id}`.pipe(
          Effect.orDie,
        );
      }),
      saveAssets: Effect.fn('WalkthroughStore.saveAssets')(function* (
        id: string,
        assets: readonly EvidenceAsset[],
      ) {
        yield* Effect.forEach(
          assets,
          (asset) =>
            sql`INSERT INTO walkthrough_evidence (run_id, asset_id, media_type, caption, bytes) VALUES (${id}, ${asset.id}, ${asset.mediaType}, ${asset.caption}, ${asset.bytes}) ON CONFLICT(run_id, asset_id) DO NOTHING`,
        ).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      readAsset: Effect.fn('WalkthroughStore.readAsset')(function* (
        id: string,
        assetId: string,
        worktreeId: string,
      ) {
        const rows = yield* sql<{
          assetId: string;
          mediaType: string;
          caption: string;
          bytes: Uint8Array;
        }>`SELECT asset_id, media_type, caption, bytes FROM walkthrough_evidence WHERE run_id = ${id} AND asset_id = ${assetId} AND EXISTS (SELECT 1 FROM walkthrough_runs WHERE id = ${id} AND worktree_id = ${worktreeId})`.pipe(
          Effect.orDie,
        );
        const row = rows[0];
        return row === undefined
          ? undefined
          : {
              id: row.assetId,
              mediaType: row.mediaType,
              caption: row.caption,
              bytes: row.bytes,
            };
      }),
      readJob: Effect.fn('WalkthroughStore.readJob')(function* (runId: string) {
        const rows = yield* sql<{
          payload: string;
        }>`SELECT payload FROM walkthrough_runs WHERE id = ${runId}`.pipe(
          Effect.orDie,
        );
        return rows[0] === undefined ? undefined : decode(rows[0].payload);
      }),
      listReadyRuns: Effect.fn('WalkthroughStore.listReadyRuns')(function* (
        worktreeId: string,
      ) {
        const rows = yield* sql<{
          payload: string;
        }>`SELECT payload FROM walkthrough_runs WHERE worktree_id = ${worktreeId} AND status = 'ready' ORDER BY sequence`.pipe(
          Effect.orDie,
        );
        return rows.map((row) => decode(row.payload).run);
      }),
      addMessage: Effect.fn('WalkthroughStore.addMessage')(function* (
        value: StoredWalkthroughMessage,
      ) {
        yield* sql`INSERT INTO walkthrough_messages (id, run_id, worktree_id, stop_title, text, created_at, answer) VALUES (${value.id}, ${value.runId}, ${value.worktreeId}, ${value.stopTitle ?? null}, ${value.text}, ${value.createdAt}, ${JSON.stringify(value.answer)})`.pipe(
          Effect.orDie,
        );
      }),
      readMessage: Effect.fn('WalkthroughStore.readMessage')(function* (
        worktreeId: string,
        messageId: string,
      ) {
        const rows =
          yield* sql<MessageRow>`SELECT * FROM walkthrough_messages WHERE id = ${messageId} AND worktree_id = ${worktreeId}`.pipe(
            Effect.orDie,
          );
        return rows[0] === undefined ? undefined : message(rows[0]);
      }),
      listMessages: Effect.fn('WalkthroughStore.listMessages')(function* (
        worktreeId: string,
      ) {
        const rows =
          yield* sql<MessageRow>`SELECT * FROM walkthrough_messages WHERE worktree_id = ${worktreeId} ORDER BY sequence`.pipe(
            Effect.orDie,
          );
        return rows.map(message);
      }),
      readOldestAnswering: Effect.fn('WalkthroughStore.readOldestAnswering')(
        function* () {
          const rows =
            yield* sql<MessageRow>`SELECT * FROM walkthrough_messages WHERE answer_status = 'answering' ORDER BY sequence LIMIT 1`.pipe(
              Effect.orDie,
            );
          return rows[0] === undefined ? undefined : message(rows[0]);
        },
      ),
      settleAnswer: Effect.fn('WalkthroughStore.settleAnswer')(function* (
        messageId: string,
        answer: Exclude<AnswerState, { status: 'answering' }>,
      ) {
        yield* sql`UPDATE walkthrough_messages SET answer_status = ${answer.status}, answer = ${JSON.stringify(answer)} WHERE id = ${messageId} AND answer_status = 'answering'`.pipe(
          Effect.orDie,
        );
      }),
      failAnswering: Effect.fn('WalkthroughStore.failAnswering')(function* (
        failure: WalkthroughFailure,
      ) {
        const rows = yield* sql<{
          worktreeId: string;
        }>`UPDATE walkthrough_messages SET answer_status = 'failed', answer = ${JSON.stringify({ status: 'failed', failure })} WHERE answer_status = 'answering' RETURNING worktree_id`.pipe(
          Effect.orDie,
        );
        return [...new Set(rows.map((row) => row.worktreeId))];
      }),
      requeueAnswer: Effect.fn('WalkthroughStore.requeueAnswer')(function* (
        worktreeId: string,
        messageId: string,
      ) {
        const rows =
          yield* sql`UPDATE walkthrough_messages SET answer_status = 'answering', answer = '{"status":"answering"}' WHERE id = ${messageId} AND worktree_id = ${worktreeId} AND answer_status = 'failed' RETURNING id`.pipe(
            Effect.orDie,
          );
        return rows.length === 1;
      }),
      saveForLater: Effect.fn('WalkthroughStore.saveForLater')(function* (
        worktreeId: string,
        messageId: string,
        saved: boolean,
      ) {
        yield* sql`UPDATE walkthrough_messages SET post_status = ${saved ? 'saved' : 'none'} WHERE id = ${messageId} AND worktree_id = ${worktreeId} AND post_status != 'posted'`.pipe(
          Effect.orDie,
        );
      }),
      markPosted: Effect.fn('WalkthroughStore.markPosted')(function* (
        worktreeId: string,
        messageIds: readonly string[],
        url: string,
        postedAt: string,
      ) {
        yield* Effect.forEach(
          messageIds,
          (id) =>
            sql`UPDATE walkthrough_messages SET post_status = 'posted', post_url = ${url}, posted_at = ${postedAt} WHERE id = ${id} AND worktree_id = ${worktreeId} AND post_status != 'posted'`,
        ).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
    });
  }),
);

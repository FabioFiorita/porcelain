import { Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';
import { WalkthroughStore } from '@porcelain/walkthroughs/ports';
import {
  walkthroughJobSchema,
  type WalkthroughJob,
  type WalkthroughRun,
  type EvidenceAsset,
} from '@porcelain/walkthroughs/models';

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
          yield* sql`INSERT INTO walkthrough_runs (id, worktree_id, head_oid, status, payload) VALUES (${job.run.id}, ${job.run.worktreeId}, ${job.run.headOid}, 'queued', ${JSON.stringify(job)}) ON CONFLICT(worktree_id, head_oid) DO NOTHING`;
          const rows = yield* sql<{
            payload: string;
          }>`SELECT payload FROM walkthrough_runs WHERE worktree_id = ${job.run.worktreeId} AND head_oid = ${job.run.headOid}`;
          return decode(rows[0]?.payload).run;
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      read: Effect.fn('WalkthroughStore.read')(function* (
        worktreeId: string,
        headOid?: string,
      ) {
        const rows = yield* sql<{
          payload: string;
        }>`SELECT payload FROM walkthrough_runs WHERE worktree_id = ${worktreeId} ORDER BY CASE WHEN head_oid = ${headOid ?? ''} THEN 0 ELSE 1 END, sequence DESC LIMIT 1`.pipe(
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
    });
  }),
);

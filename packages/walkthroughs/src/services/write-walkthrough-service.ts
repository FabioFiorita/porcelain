import { Context, DateTime, Effect, Layer } from 'effect';
import type { WalkthroughJob } from '../models/walkthrough.ts';
import { EvidenceReader } from '../ports/evidence-reader.ts';
import { TranscriptReader } from '../ports/transcript-reader.ts';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughWriter } from '../ports/walkthrough-writer.ts';

import { qualifyWalkthrough } from '../rules/qualify-walkthrough.ts';
export class WriteWalkthroughService extends Context.Service<
  WriteWalkthroughService,
  {
    readonly execute: (job: WalkthroughJob) => Effect.Effect<void>;
  }
>()('@porcelain/walkthroughs/WriteWalkthroughService') {
  static readonly layer = Layer.effect(
    WriteWalkthroughService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const writer = yield* WalkthroughWriter;
      const transcripts = yield* TranscriptReader;
      const evidenceReader = yield* EvidenceReader;
      return {
        execute: Effect.fn('WriteWalkthroughService.execute')(function* (
          job: WalkthroughJob,
        ) {
          let run = { ...job.run, state: { status: 'running' as const } };
          yield* Effect.gen(function* () {
            const evidence = yield* evidenceReader.read(job);
            run = { ...run, evidenceUnavailable: evidence.unavailable };
            yield* store.saveAssets(run.id, evidence.assets);
            const transcript = yield* transcripts.read(job.worktreePath);
            const result = yield* writer.write({
              ...job,
              evidence,
              transcript,
              recordSession: (sessionId) => {
                run = { ...run, sessionId };
                return store.save(run);
              },
            });
            const content = qualifyWalkthrough(
              {
                ...result.content,
                checks:
                  evidence.unavailable === undefined
                    ? result.content.checks
                    : undefined,
              },
              job.files,
              evidence.assets.map((asset) => asset.id),
            );
            yield* store.save({
              ...run,
              sessionId: result.sessionId,
              state: {
                status: 'ready',
                content,
                writtenAt: yield* DateTime.now.pipe(
                  Effect.map(DateTime.formatIso),
                ),
                durationMs: result.durationMs,
                costUsd: result.costUsd,
              },
            });
          }).pipe(
            Effect.catch((failure) =>
              store.save({
                ...run,
                state: {
                  status: 'failed',
                  failure: { kind: failure.kind, message: failure.message },
                },
              }),
            ),
          );
        }),
      };
    }),
  );
}

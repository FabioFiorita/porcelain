import { Context, DateTime, Effect, Layer } from 'effect';
import type {
  WalkthroughJob,
  WalkthroughProgress,
  WalkthroughRun,
} from '../models/walkthrough.ts';
import { EvidenceReader } from '../ports/evidence-reader.ts';
import { TranscriptReader } from '../ports/transcript-reader.ts';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughWriter } from '../ports/walkthrough-writer.ts';

import { qualifyWalkthrough } from '../rules/qualify-walkthrough.ts';
export class WriteWalkthroughService extends Context.Service<
  WriteWalkthroughService,
  {
    readonly execute: (
      job: WalkthroughJob,
      changed: () => Effect.Effect<void>,
    ) => Effect.Effect<void>;
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
          changed: () => Effect.Effect<void>,
        ) {
          let run: WalkthroughRun = {
            ...job.run,
            state: { status: 'running' },
          };
          const record = Effect.fn('WriteWalkthroughService.record')(function* (
            stage: WalkthroughProgress['stage'],
            message: string,
          ) {
            const at = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
            run = {
              ...run,
              progress: [...(run.progress ?? []), { stage, at, message }],
            };
            yield* store.save(run);
            yield* changed();
          });
          yield* Effect.gen(function* () {
            yield* record(
              'evidence',
              run.pullRequestNumber === undefined
                ? 'No pull request is attached. Continuing without pull request evidence.'
                : 'Reading existing pull request evidence and checks.',
            );
            const evidence = yield* evidenceReader.read(job);
            run = { ...run, evidenceUnavailable: evidence.unavailable };
            yield* store.saveAssets(run.id, evidence.assets);
            const unavailable =
              evidence.unavailable === undefined
                ? undefined
                : {
                    head_mismatch: 'The pull request is at another commit.',
                    github_account:
                      'No GitHub account is selected for this project.',
                    github_unavailable: 'GitHub could not be reached.',
                  }[evidence.unavailable];
            yield* record(
              'transcript',
              unavailable
                ? `${unavailable} Continuing without pull request evidence. Reading the coding conversation.`
                : `Collected ${evidence.assets.length} evidence assets. Reading the coding conversation.`,
            );
            const transcript = yield* transcripts.read(job.worktreePath);
            yield* record(
              'writing',
              `${run.writer.provider === 'codex' ? 'Codex' : 'Claude'} is writing the walkthrough from the captured change.`,
            );
            const result = yield* writer.write({
              ...job,
              evidence,
              transcript,
              recordSession: (sessionId) => {
                run = { ...run, sessionId };
                return store.save(run);
              },
            });
            yield* record(
              'validating',
              'Checking the written walkthrough against captured files and evidence.',
            );
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
            run = {
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
            };
            yield* record('ready', 'Walkthrough written and saved.');
          }).pipe(
            Effect.catch(
              Effect.fn('WriteWalkthroughService.fail')(function* (failure) {
                run = {
                  ...run,
                  state: {
                    status: 'failed',
                    failure: { kind: failure.kind, message: failure.message },
                  },
                };
                yield* record('failed', failure.message);
              }),
            ),
          );
        }),
      };
    }),
  );
}

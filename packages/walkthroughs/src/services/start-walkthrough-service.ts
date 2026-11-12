import { ResolveWalkthroughWriterService } from './resolve-walkthrough-writer-service.ts';
import { Context, DateTime, Effect, Layer } from 'effect';
import { IdSource } from '@porcelain/kernel/ports';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { GitIoFailure } from '@porcelain/git/errors';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughSourceReader } from '../ports/walkthrough-source-reader.ts';
import { type WalkthroughRun } from '../models/walkthrough.ts';
import type { WalkthroughFailedError } from '../errors/walkthrough-failed-error.ts';
export class StartWalkthroughService extends Context.Service<
  StartWalkthroughService,
  {
    readonly execute: (input: {
      automaticKey?: string;
      targetBranch?: string;
      worktreeId: string;
      worktreePath: string;
      projectId: string;
      base: string | undefined;
      pullRequestNumber: number | undefined;
      writer: WalkthroughRun['writer'] | undefined;
    }) => Effect.Effect<
      WalkthroughRun,
      GitIoFailure | WalkthroughFailedError,
      WorktreeRead
    >;
  }
>()('@porcelain/walkthroughs/StartWalkthroughService') {
  static readonly layer = Layer.effect(
    StartWalkthroughService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const resolveWriter = yield* ResolveWalkthroughWriterService;
      const source = yield* WalkthroughSourceReader;
      const ids = yield* IdSource;
      return {
        execute: Effect.fn('StartWalkthroughService.execute')(
          function* (input) {
            const writer = yield* resolveWriter.execute(input);
            const snapshot = yield* source.read(input);
            const createdAt = yield* DateTime.now.pipe(
              Effect.map(DateTime.formatIso),
            );
            return yield* store.accept(
              {
                worktreePath: input.worktreePath,
                files: snapshot.files,
                patch: snapshot.patch,
                omittedFiles: snapshot.omittedFiles,
                run: {
                  id: ids.next(),
                  projectId: input.projectId,
                  worktreeId: input.worktreeId,
                  pullRequestNumber: input.pullRequestNumber,
                  pullRequestRepository: snapshot.githubRepository,
                  baseOid: snapshot.baseOid,
                  headOid: snapshot.headOid,
                  contentTreeOid: snapshot.contentTreeOid,
                  baseRef: snapshot.baseRef,
                  includesUncommitted: snapshot.includesUncommitted,
                  branch: snapshot.branch,
                  writer,
                  sessionId: undefined,
                  createdAt,
                  progress: [
                    {
                      stage: 'queued',
                      at: createdAt,
                      message: `Captured ${snapshot.files.length} ${snapshot.files.length === 1 ? 'file' : 'files'} for ${snapshot.headOid.slice(0, 7)}${snapshot.includesUncommitted ? ' and uncommitted work' : ''}. Waiting for the writer.`,
                    },
                  ],
                  state: { status: 'queued' },
                },
              },
              input.automaticKey,
            );
          },
        ),
      };
    }),
  );
}

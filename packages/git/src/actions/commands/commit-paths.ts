import { Effect, FileSystem, type Scope } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import { dirname, join } from 'node:path';
import { isRelativePath } from '@porcelain/kernel/rules';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import { readOptionalActionOid } from './read-optional-action-oid.ts';
import { rejectBusyCheckout } from './reject-busy-checkout.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionBranch } from './read-action-branch.ts';
import { readActionCommand } from './read-action-command.ts';
import { readActionHead } from './read-action-head.ts';

export const commitPaths = Effect.fn('Git.commitPaths')(function* (
  process: GitProcessRunner,
  preparation: GitActionCommand<'commit' | 'amend'>,
  paths: readonly string[],
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const intent = preparation.intent;
  const messageOnly = intent.action === 'amend' && paths.length === 0;
  const merging =
    intent.action === 'commit' && preparation.preview.inProgress === 'merge';
  if (intent.action === 'commit' && paths.length === 0 && !merging)
    return yield* new GitActionRejectedError({ reason: 'REQUEST_MISMATCH' });
  if (
    paths.length > process.limits.actions.maxCommitPaths ||
    paths.some(
      (path) => !isRelativePath(path, process.limits.inspection.maxPathLength),
    )
  )
    return yield* new GitActionRejectedError({
      reason: 'UNSUPPORTED_CONFIGURATION',
      detail: `Porcelain commits at most ${process.limits.actions.maxCommitPaths.toLocaleString('en-US')} files at once, each inside the checkout and outside \`.git\`. Select fewer files and try again.`,
    });
  const indexPath = (yield* readActionCommand(process, [
    'rev-parse',
    '--path-format=absolute',
    '--git-path',
    'index',
  ])).trimEnd();
  const lockPath = `${indexPath}.lock`;
  const fs = yield* FileSystem.FileSystem;
  let temporary: string | undefined;
  let published = false;
  let preserve = false;
  let acquired = false;
  return yield* Effect.gen(function* (): Effect.fn.Return<
    GitActionOutcome,
    ActionFailure,
    ActionPlatform | Scope.Scope
  > {
    const lock = yield* fs
      .open(lockPath, { flag: 'wx', mode: 0o600 })
      .pipe(
        Effect.mapError(
          (cause) =>
            new GitActionRejectedError({ reason: 'CHECKOUT_BUSY', cause }),
        ),
      );
    acquired = true;
    const inProgress = yield* rejectBusyCheckout(process, true, true);
    const mergeHeadOid =
      inProgress === 'merge'
        ? yield* readOptionalActionOid(process, 'MERGE_HEAD')
        : null;
    const headOid = yield* readOptionalActionOid(process, 'HEAD');
    const branch = yield* readActionBranch(process);
    if (
      headOid !== preparation.preview.headOid ||
      branch !== preparation.preview.branch ||
      inProgress !== (preparation.preview.inProgress ?? null) ||
      mergeHeadOid !== (preparation.preview.mergeHeadOid ?? null)
    )
      return yield* new GitActionRejectedError({
        reason: 'CHANGED_SINCE_LOOKED',
      });
    temporary = yield* fs.makeTempDirectory({
      directory: dirname(indexPath),
      prefix: 'porcelain-index-',
    });
    const indexFile = join(temporary, 'index');
    const original = yield* fs
      .readFile(indexPath)
      .pipe(
        Effect.catchReason('PlatformError', 'NotFound', () =>
          Effect.succeed(null),
        ),
      );
    if (original) yield* fs.writeFile(indexFile, original);
    const pathsFile = join(temporary, 'paths');
    yield* fs.writeFileString(pathsFile, `${paths.join('\0')}\0`);
    const run = (args: string[], input?: string) =>
      process.execute(['--literal-pathspecs', ...args], input, {
        indexFile,
      });
    const present = new Set(
      (yield* readActionCommand(process, [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '-z',
      ])).split('\0'),
    );
    const addPaths = paths.filter((path) => present.has(path));
    if (addPaths.length) {
      yield* fs.writeFileString(pathsFile, `${addPaths.join('\0')}\0`);
      const added = yield* run([
        'add',
        '--all',
        `--pathspec-from-file=${pathsFile}`,
        '--pathspec-file-nul',
      ]);
      const addFailure = processFailure(added);
      if (addFailure) return addFailure;
    }
    yield* fs.writeFileString(pathsFile, `${paths.join('\0')}\0`);
    if (!messageOnly && !merging) {
      const changed = yield* run([
        'diff',
        '--cached',
        '--quiet',
        '--no-ext-diff',
        '--no-textconv',
        '--',
        ...paths,
      ]);
      if (!changed.interrupted && changed.exitCode === 0)
        return { state: 'no-change', refreshRequired: false };
      if (changed.interrupted || changed.exitCode !== 1)
        return (
          processFailure(changed) ?? {
            state: 'rejected',
            refreshRequired: true,
          }
        );
    }
    const reconcile = Effect.gen(function* () {
      const head = yield* readActionHead(process).pipe(
        Effect.timeout(process.limits.followUpTimeoutMs),
        Effect.mapError(
          (cause) =>
            new GitActionRejectedError({ reason: 'OUTCOME_UNKNOWN', cause }),
        ),
      );
      if (head !== preparation.preview.headOid && !messageOnly) {
        yield* lock.writeAll(yield* fs.readFile(indexFile));
        yield* lock.sync;
        yield* fs.rename(lockPath, indexPath);
        published = true;
      }
      return head;
    });
    return yield* Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* (): Effect.fn.Return<
        GitActionOutcome,
        ActionFailure,
        ActionPlatform
      > {
        const committed = yield* restore(
          run(
            [
              'commit',
              ...(intent.action === 'amend' ? ['--amend'] : []),
              ...(!merging ? ['--only'] : []),
              '--file=-',
              '--cleanup=verbatim',
              ...(!merging && !messageOnly
                ? [`--pathspec-from-file=${pathsFile}`, '--pathspec-file-nul']
                : []),
            ],
            intent.message,
          ),
        ).pipe(Effect.onInterrupt(() => reconcile.pipe(Effect.orDie)));
        const failure = processFailure(committed);
        if (failure?.state === 'rejected') return failure;
        const head = yield* reconcile;
        if (failure) return failure;
        if (head === preparation.preview.headOid)
          return {
            state: 'indeterminate',
            reason: 'OUTCOME_UNKNOWN',
            refreshRequired: true,
          };
        return published || messageOnly
          ? {
              state: 'succeeded',
              result: { headOid: head },
              refreshRequired: true,
            }
          : {
              state: 'indeterminate',
              reason: 'OUTCOME_UNKNOWN',
              refreshRequired: true,
            };
      }),
    );
  }).pipe(
    Effect.tapError((error) =>
      Effect.sync(() => {
        preserve =
          error instanceof GitActionRejectedError &&
          error.reason === 'PROCESS_GROUP_UNCONFIRMED';
      }),
    ),
    Effect.scoped,
    Effect.ensuring(
      Effect.gen(function* () {
        if (acquired && !published && !preserve)
          yield* fs.remove(lockPath, { force: true });
        if (temporary && !preserve)
          yield* fs.remove(temporary, { recursive: true, force: true });
      }).pipe(Effect.orDie),
    ),
  );
});

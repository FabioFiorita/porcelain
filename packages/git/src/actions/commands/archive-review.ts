import { createHash } from 'node:crypto';
import { Effect, FileSystem, Option, Path, Schema, Stream } from 'effect';
import { listWorktrees } from '../../discovery/index.ts';
import { gitRead } from '../../shared/commands/run-git.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';

class GitArchiveRefusedError extends Schema.TaggedError<GitArchiveRefusedError>()(
  'GitArchiveRefusedError',
  { message: Schema.String },
) {}

type Options = {
  deleteWorktree: boolean;
  deleteLocalBranch: boolean;
  deleteRemoteBranch: boolean;
};
type Plan = {
  worktreePath?: string | undefined;
  detachWorktreePath?: string | undefined;
  localBranch?: string | undefined;
  remoteBranch?: string | undefined;
  mainCheckout: boolean;
  dirty: boolean;
  unpushed: boolean;
  fingerprint: string;
};

export const archiveReview = Effect.fn('Git.archiveReview')(function* (
  input: {
    commonDirectory: string;
    repositoryIdentity?: string | undefined;
    worktreePath: string;
    branch: string;
    options: Options;
    confirmation?: { plan: Plan; discardChanges: boolean } | undefined;
  },
  limits: GitLimits,
) {
  const repository = yield* listWorktrees(input.commonDirectory, limits);
  if (
    input.repositoryIdentity !== undefined &&
    repository.repositoryIdentity !== input.repositoryIdentity
  )
    return yield* new GitArchiveRefusedError({
      message: 'The project repository changed. Nothing was deleted.',
    });
  const read = (args: readonly string[]) =>
    gitRead(input.commonDirectory, args, limits).pipe(
      Effect.map((bytes) => bytes.toString('utf8').trim()),
    );
  const write = (args: readonly string[]) =>
    gitRead(input.commonDirectory, args, limits, {
      timeoutMs: limits.followUpTimeoutMs,
    });
  const ref = `refs/heads/${input.branch}`;
  yield* read(['check-ref-format', ref]);
  const worktree = repository.worktrees.find(
    (row) => row.path === input.worktreePath,
  );
  if (worktree && worktree.branch !== ref)
    return yield* new GitArchiveRefusedError({
      message: 'The worktree branch changed. Nothing was deleted.',
    });
  const mainCheckout =
    worktree?.main === true ||
    repository.worktrees.some((row) => row.main && row.branch === ref);
  const head = yield* read(['rev-parse', '--verify', '--quiet', ref]).pipe(
    Effect.catchTag('GitCommandError', (error) =>
      error.exitCode === 1 ? Effect.succeed('') : Effect.fail(error),
    ),
  );
  const status = worktree?.available
    ? yield* gitRead(
        worktree.path,
        [
          'status',
          '--porcelain=v1',
          '-z',
          '--untracked-files=all',
          '--ignored=matching',
        ],
        limits,
      ).pipe(Effect.map((bytes) => bytes.toString('utf8')))
    : '';
  if (worktree && !worktree.available)
    return yield* new GitArchiveRefusedError({
      message: 'The worktree is unavailable. Reconnect it before archiving.',
    });
  const content = createHash('sha256');
  if (worktree?.available && status) {
    content.update(
      yield* gitRead(
        worktree.path,
        ['diff', '--binary', '--no-ext-diff', '--no-textconv', 'HEAD'],
        limits,
      ),
    );
    content.update(
      yield* gitRead(
        worktree.path,
        ['diff', '--cached', '--binary', '--no-ext-diff', '--no-textconv'],
        limits,
      ),
    );
    const files = yield* gitRead(
      worktree.path,
      ['ls-files', '--others', '-z'],
      limits,
    );
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    for (const file of files
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
      .sort()) {
      content.update(file).update('\0');
      const absolute = path.join(worktree.path, file);
      const link = yield* fs.readLink(absolute).pipe(Effect.option);
      if (Option.isSome(link)) {
        content.update(link.value);
        continue;
      }
      if ((yield* fs.stat(absolute)).type !== 'File')
        return yield* new GitArchiveRefusedError({
          message:
            'This worktree contains a special file that cannot be checked safely. Turn off worktree deletion.',
        });
      yield* Stream.runForEach(fs.stream(absolute), (chunk) =>
        Effect.sync(() => {
          content.update(chunk);
        }),
      );
    }
  }
  const contentFingerprint = content.digest('hex');
  const tracking = head
    ? yield* read([
        'for-each-ref',
        '--format=%(upstream:remotename)%00%(upstream:remoteref)',
        ref,
      ])
    : '';
  const [remoteName, remoteRef] = tracking.split('\0');
  if (
    !mainCheckout &&
    input.options.deleteRemoteBranch &&
    remoteRef &&
    (remoteRef !== ref ||
      repository.worktrees.some((row) => row.main && row.branch === remoteRef))
  )
    return yield* new GitArchiveRefusedError({
      message:
        'The configured upstream is another branch or the main checkout branch. Turn off remote branch deletion.',
    });
  let remoteUrl = '';
  let remoteOid = '';
  if (!mainCheckout && remoteName && remoteRef?.startsWith('refs/heads/')) {
    remoteUrl = yield* read(['remote', 'get-url', '--push', remoteName]);
    const remote = yield* read(['ls-remote', '--heads', remoteUrl, remoteRef]);
    remoteOid = remote.split(/\s+/)[0] ?? '';
  }
  const unpushed =
    !mainCheckout &&
    Boolean(head) &&
    (!remoteOid ||
      (yield* read(['rev-list', '--count', `${remoteOid}..${ref}`]).pipe(
        Effect.catchTag('GitCommandError', () => Effect.succeed('unknown')),
      )) !== '0');
  const otherCheckout = repository.worktrees.some(
    (row) => row.path !== input.worktreePath && row.branch === ref,
  );
  if (!mainCheckout && input.options.deleteLocalBranch && head && otherCheckout)
    return yield* new GitArchiveRefusedError({
      message:
        'The local branch is checked out in another worktree. Turn off local branch deletion.',
    });
  if (
    !mainCheckout &&
    input.options.deleteRemoteBranch &&
    head &&
    (!remoteName || !remoteRef)
  )
    return yield* new GitArchiveRefusedError({
      message:
        'This branch has no configured remote branch. Turn off remote branch deletion to archive it.',
    });
  const plan: Plan = {
    detachWorktreePath:
      !mainCheckout &&
      worktree &&
      input.options.deleteLocalBranch &&
      !input.options.deleteWorktree
        ? worktree.path
        : undefined,
    worktreePath:
      !mainCheckout && input.options.deleteWorktree
        ? (worktree?.path ?? undefined)
        : undefined,
    localBranch:
      !mainCheckout && input.options.deleteLocalBranch && head
        ? input.branch
        : undefined,
    remoteBranch:
      !mainCheckout && input.options.deleteRemoteBranch && remoteOid
        ? `${remoteName}/${remoteRef?.slice('refs/heads/'.length)}`
        : undefined,
    mainCheckout,
    dirty: Boolean(status),
    unpushed,
    fingerprint: createHash('sha256')
      .update(
        JSON.stringify({
          options: input.options,
          contentFingerprint,
          head,
          status,
          metadata: worktree?.metadataIdentity,
          remoteUrl,
          remoteRef,
          remoteOid,
        }),
      )
      .digest('hex'),
  };
  if (!input.confirmation) return plan;
  const confirmed = input.confirmation.plan;
  if (
    Object.keys(plan).some(
      (key) => Reflect.get(plan, key) !== Reflect.get(confirmed, key),
    )
  )
    return yield* new GitArchiveRefusedError({
      message:
        'The worktree, branches or settings changed. Reopen Archive and confirm the new deletion plan.',
    });
  if ((plan.dirty || plan.unpushed) && !input.confirmation.discardChanges)
    return yield* new GitArchiveRefusedError({
      message:
        'Explicitly confirm the uncommitted changes and unpushed commits before archiving.',
    });
  if (plan.remoteBranch)
    yield* write([
      'push',
      `--force-with-lease=${remoteRef}:${remoteOid}`,
      remoteUrl,
      `:${remoteRef}`,
    ]);
  if (plan.detachWorktreePath)
    yield* gitRead(
      plan.detachWorktreePath,
      ['switch', '--detach', head],
      limits,
    );
  if (plan.worktreePath)
    yield* write([
      'worktree',
      'remove',
      ...(plan.dirty ? ['--force'] : []),
      '--',
      plan.worktreePath,
    ]);
  if (plan.localBranch) yield* write(['update-ref', '-d', ref, head]);
  return plan;
});

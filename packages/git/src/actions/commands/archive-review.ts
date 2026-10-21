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
  remoteBranchNote?: string | undefined;
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
    mergedHead?: string | undefined;
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
      timeoutMs:
        args[0] === 'worktree' && args[1] === 'remove'
          ? Math.max(limits.followUpTimeoutMs, 120_000)
          : limits.followUpTimeoutMs,
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
  const status =
    worktree?.available && input.options.deleteWorktree && !mainCheckout
      ? yield* gitRead(
          worktree.path,
          ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
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
      ['ls-files', '--others', '--exclude-standard', '-z'],
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
  const tracking = yield* read([
    'for-each-ref',
    '--format=%(upstream:remotename)%00%(upstream:remoteref)',
    ref,
  ]);
  const [trackedRemote, trackedRef] = tracking.split('\0');
  const configuration = (key: string) =>
    read(['config', '--get', key]).pipe(
      Effect.catchTag('GitCommandError', (error) =>
        error.exitCode === 1 ? Effect.succeed('') : Effect.fail(error),
      ),
    );
  const remoteName =
    trackedRemote || (yield* configuration(`branch.${input.branch}.remote`));
  const remoteRef =
    trackedRef || (yield* configuration(`branch.${input.branch}.merge`));
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
  const confirmedHead = remoteOid || input.mergedHead;
  const unpushed =
    !mainCheckout &&
    Boolean(head) &&
    (confirmedHead
      ? (yield* read(['rev-list', '--count', `${confirmedHead}..${ref}`]).pipe(
          Effect.catchTag('GitCommandError', () => Effect.succeed('unknown')),
        )) !== '0'
      : (yield* read(['rev-list', '--count', ref, '--not', '--remotes'])) !==
        '0');
  const otherCheckout = repository.worktrees.some(
    (row) => row.path !== input.worktreePath && row.branch === ref,
  );
  if (!mainCheckout && input.options.deleteLocalBranch && head && otherCheckout)
    return yield* new GitArchiveRefusedError({
      message:
        'The local branch is checked out in another worktree. Turn off local branch deletion.',
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
    remoteBranchNote:
      !mainCheckout && input.options.deleteRemoteBranch
        ? !remoteName || !remoteRef
          ? 'Remote branch deletion skipped: this branch has no upstream.'
          : !remoteOid
            ? `${remoteName}/${remoteRef.slice('refs/heads/'.length)}: already deleted on remote.`
            : undefined
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
  const targets = [
    ...(plan.worktreePath ? [`worktree ${plan.worktreePath}`] : []),
    ...(plan.localBranch ? [`local branch ${plan.localBranch}`] : []),
    ...(plan.remoteBranch ? [`remote branch ${plan.remoteBranch}`] : []),
  ];
  const deleted: string[] = [];
  const remove = (target: string, args: readonly string[]) =>
    write(args).pipe(
      Effect.mapError(
        () =>
          new GitArchiveRefusedError({
            message: `Could not delete ${target}. Deleted: ${deleted.join(', ') || 'nothing'}. Not deleted: ${targets.filter((entry) => !deleted.includes(entry)).join(', ')}. Reopen Archive to review the remaining targets.`,
          }),
      ),
      Effect.tap(() =>
        Effect.sync(() => {
          deleted.push(target);
        }),
      ),
    );
  if (plan.detachWorktreePath)
    yield* gitRead(
      plan.detachWorktreePath,
      ['switch', '--detach', head],
      limits,
    ).pipe(
      Effect.mapError(
        () =>
          new GitArchiveRefusedError({
            message: `Could not detach worktree ${plan.detachWorktreePath}. Nothing was deleted.`,
          }),
      ),
    );
  if (plan.worktreePath)
    yield* remove(`worktree ${plan.worktreePath}`, [
      'worktree',
      'remove',
      ...(plan.dirty ? ['--force'] : []),
      '--',
      plan.worktreePath,
    ]);
  if (plan.localBranch)
    yield* remove(`local branch ${plan.localBranch}`, [
      'update-ref',
      '-d',
      ref,
      head,
    ]);
  if (plan.remoteBranch)
    yield* remove(`remote branch ${plan.remoteBranch}`, [
      'push',
      `--force-with-lease=${remoteRef}:${remoteOid}`,
      remoteUrl,
      `:${remoteRef}`,
    ]);
  return plan;
});

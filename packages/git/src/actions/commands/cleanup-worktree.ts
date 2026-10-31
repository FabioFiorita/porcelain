import type {
  WorktreeCleanupPlan,
  WorktreeCleanupRequest,
} from '@porcelain/kernel/models';
import { createHash } from 'node:crypto';
import { Effect, FileSystem, Option, Path, Schema, Stream } from 'effect';
import { listWorktrees } from '../../discovery/index.ts';
import { gitRead } from '../../shared/commands/run-git.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';

class GitCleanupRefusedError extends Schema.TaggedError<GitCleanupRefusedError>()(
  'GitCleanupRefusedError',
  { message: Schema.String },
) {}

type Plan = WorktreeCleanupPlan;
type Options = WorktreeCleanupRequest['options'];

export const cleanupWorktree = Effect.fn('Git.cleanupWorktree')(function* (
  input: {
    commonDirectory: string;
    repositoryIdentity?: string | undefined;
    worktreePath: string;
    branch?: string | undefined;
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
    return yield* new GitCleanupRefusedError({
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
  const ref = input.branch ? `refs/heads/${input.branch}` : undefined;
  if (ref) yield* read(['check-ref-format', ref]);
  if (
    !ref &&
    (input.options.deleteLocalBranch || input.options.deleteRemoteBranch)
  )
    return yield* new GitCleanupRefusedError({
      message:
        'This worktree is detached. Turn off local and remote branch deletion.',
    });
  const worktree = repository.worktrees.find(
    (row) => row.path === input.worktreePath,
  );
  if (worktree && (worktree.branch ?? undefined) !== ref)
    return yield* new GitCleanupRefusedError({
      message: 'The worktree branch changed. Nothing was deleted.',
    });
  const mainCheckout =
    worktree?.main === true ||
    repository.worktrees.some((row) => row.main && row.branch === ref);
  const head = ref
    ? yield* read(['rev-parse', '--verify', '--quiet', ref]).pipe(
        Effect.catchTag('GitCommandError', (error) =>
          error.exitCode === 1 ? Effect.succeed('') : Effect.fail(error),
        ),
      )
    : worktree?.available
      ? (yield* gitRead(
          worktree.path,
          ['rev-parse', '--verify', 'HEAD'],
          limits,
        ))
          .toString('utf8')
          .trim()
      : '';
  const status =
    worktree?.available && input.options.deleteWorktree && !mainCheckout
      ? yield* gitRead(
          worktree.path,
          ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
          limits,
        ).pipe(Effect.map((bytes) => bytes.toString('utf8')))
      : '';
  if (worktree && !worktree.available)
    return yield* new GitCleanupRefusedError({
      message: 'The worktree is unavailable. Reconnect it before deleting.',
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
        return yield* new GitCleanupRefusedError({
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
  const cleanup =
    input.options.deleteWorktree ||
    input.options.deleteLocalBranch ||
    input.options.deleteRemoteBranch;
  const tracking = ref
    ? yield* read([
        'for-each-ref',
        '--format=%(upstream:remotename)%00%(upstream:remoteref)',
        ref,
      ])
    : '';
  const [trackedRemote, trackedRef] = tracking.split('\0');
  const configuration = (key: string) =>
    read(['config', '--get', key]).pipe(
      Effect.catchTag('GitCommandError', (error) =>
        error.exitCode === 1 ? Effect.succeed('') : Effect.fail(error),
      ),
    );
  const remoteName =
    trackedRemote ||
    (ref ? yield* configuration(`branch.${input.branch}.remote`) : '');
  const remoteRef =
    trackedRef ||
    (ref ? yield* configuration(`branch.${input.branch}.merge`) : '');
  if (
    !mainCheckout &&
    input.options.deleteRemoteBranch &&
    remoteRef &&
    (remoteRef !== ref ||
      repository.worktrees.some((row) => row.main && row.branch === remoteRef))
  )
    return yield* new GitCleanupRefusedError({
      message:
        'The configured upstream is another branch or the main checkout branch. Turn off remote branch deletion.',
    });
  let remoteUrl = '';
  let remoteOid = '';
  const deletingBranches =
    !mainCheckout &&
    (input.options.deleteLocalBranch || input.options.deleteRemoteBranch);
  const protectDefault = (remote: string) =>
    deletingBranches && remote.split('\n').includes(`ref: ${ref}\tHEAD`)
      ? Effect.fail(
          new GitCleanupRefusedError({
            message:
              'The remote default branch is protected. Turn off local and remote branch deletion.',
          }),
        )
      : Effect.void;
  if (
    cleanup &&
    !mainCheckout &&
    remoteName &&
    remoteRef?.startsWith('refs/heads/')
  ) {
    remoteUrl = yield* read(['remote', 'get-url', '--push', remoteName]);
    const remote = yield* read([
      'ls-remote',
      '--symref',
      remoteUrl,
      'HEAD',
      remoteRef,
    ]);
    const remoteLines = remote.split('\n');
    yield* protectDefault(remote);
    remoteOid =
      remoteLines
        .find((line) => line.endsWith(`\t${remoteRef}`))
        ?.split('\t')[0] ?? '';
  }
  if (deletingBranches) {
    const remotes = (yield* read(['remote'])).split('\n').filter(Boolean);
    const destinations = yield* Effect.forEach(remotes, (name) =>
      read(['remote', 'get-url', '--push', '--all', name]).pipe(
        Effect.map((urls) => urls.split('\n').filter(Boolean)),
      ),
    );
    for (const url of new Set(destinations.flat())) {
      if (url === remoteUrl) continue;
      const remote = yield* read(['ls-remote', '--symref', url, 'HEAD']).pipe(
        Effect.catchTag('GitCommandError', () =>
          Effect.fail(
            new GitCleanupRefusedError({
              message:
                'The remote default branch could not be checked. Reconnect the remote or turn off local and remote branch deletion.',
            }),
          ),
        ),
      );
      yield* protectDefault(remote);
    }
  }
  const confirmedHead = remoteOid || input.mergedHead;
  const unpushed =
    cleanup &&
    !mainCheckout &&
    Boolean(head) &&
    (confirmedHead
      ? (yield* read(['rev-list', '--count', `${confirmedHead}..${head}`]).pipe(
          Effect.catchTag('GitCommandError', () => Effect.succeed('unknown')),
        )) !== '0'
      : (yield* read(['rev-list', '--count', head, '--not', '--remotes'])) !==
        '0');
  const otherCheckout = repository.worktrees.some(
    (row) => row.path !== input.worktreePath && row.branch === ref,
  );
  if (!mainCheckout && input.options.deleteLocalBranch && head && otherCheckout)
    return yield* new GitCleanupRefusedError({
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
    return yield* new GitCleanupRefusedError({
      message:
        'The worktree, branches or settings changed. Reopen the deletion confirmation and confirm the new deletion plan.',
    });
  if ((plan.dirty || plan.unpushed) && !input.confirmation.discardChanges)
    return yield* new GitCleanupRefusedError({
      message:
        'Explicitly confirm the uncommitted changes and unpushed commits before deleting.',
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
          new GitCleanupRefusedError({
            message: `Could not delete ${target}. Deleted: ${deleted.join(', ') || 'nothing'}. Not deleted: ${targets.filter((entry) => !deleted.includes(entry)).join(', ')}. Reopen the deletion confirmation to review the remaining targets.`,
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
          new GitCleanupRefusedError({
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
      ref ?? '',
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

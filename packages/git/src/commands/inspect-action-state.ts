import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { GitActionIntent } from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import { readOptionalActionOid } from '../helpers/read-optional-action-oid.ts';
import { rejectBusyCheckout } from '../helpers/reject-busy-checkout.ts';
import { validateActionState } from '../helpers/validate-action-state.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { checkStashCollisions } from './check-stash-collisions.ts';
import { inspectActionConfig } from './inspect-action-config.ts';
import { hashActionFiles } from './inspect-action-files.ts';
import { inspectActionRemote } from './inspect-action-remote.ts';
import { readActionCommand } from './read-action-command.ts';

export async function inspectActionState(
  checkout: string,
  process: GitProcessRunner,
  intent: GitActionIntent,
  signal: AbortSignal,
): Promise<GitActionSnapshot> {
  await rejectBusyCheckout(process, signal);
  const config = await inspectActionConfig(process, signal);
  const headOid = await readOptionalActionOid(process, 'HEAD', signal);
  const branchResult = await process.execute(
    ['symbolic-ref', '--quiet', 'HEAD'],
    signal,
  );
  const branchFailure = processFailure(branchResult);
  if (branchFailure?.state === 'indeterminate')
    throw new GitActionRejectedError(branchFailure.reason ?? 'GIT_REJECTED');
  const branch =
    branchResult.exitCode === 0
      ? branchResult.stdout.toString('utf8').trimEnd()
      : null;
  const indexEntries = await readActionCommand(
    process,
    ['ls-files', '--stage', '-z'],
    signal,
  );
  if (
    indexEntries
      .split('\0')
      .some(
        (entry) =>
          entry.startsWith('160000 ') ||
          /^[0-9]+ [0-9a-f]+ [123]\t/.test(entry),
      )
  )
    throw new GitActionRejectedError('CHECKOUT_BUSY');
  const indexPath = (
    await readActionCommand(
      process,
      ['rev-parse', '--path-format=absolute', '--git-path', 'index'],
      signal,
    )
  ).trimEnd();
  const index = await readFile(indexPath).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return Buffer.alloc(0);
    throw error;
  });
  const status = await readActionCommand(
    process,
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    signal,
  );
  const staged =
    (
      await readActionCommand(
        process,
        [
          'diff',
          '--cached',
          '--name-only',
          '--no-ext-diff',
          '--no-textconv',
          '-z',
        ],
        signal,
      )
    ).length > 0;
  const trackedChanges =
    (
      await readActionCommand(
        process,
        ['diff', '--name-only', '--no-ext-diff', '--no-textconv', '-z'],
        signal,
      )
    ).length > 0 || staged;
  const untracked = (
    await readActionCommand(
      process,
      ['ls-files', '--others', '--exclude-standard', '-z'],
      signal,
    )
  )
    .split('\0')
    .filter(Boolean);
  const files = await hashActionFiles(checkout, process, signal);
  const stashLog = await readActionCommand(
    process,
    ['stash', 'list', '--format=%H%x00%gd%x00%gs'],
    signal,
  );
  const remote =
    intent.action === 'fetch' || intent.action === 'push'
      ? await inspectActionRemote(process, intent, signal)
      : undefined;
  const trackingOid = remote
    ? await readOptionalActionOid(process, remote.trackingRef, signal)
    : null;
  validateActionState(
    intent,
    { headOid, branch, trackedChanges, untrackedCount: untracked.length },
    stashLog,
  );
  if ('stashOid' in intent)
    await checkStashCollisions(process, intent.stashOid, signal);
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        config,
        headOid,
        branch,
        status,
        files,
        stashLog,
        remote,
        trackingOid,
      }),
    )
    .update(index)
    .digest('hex');
  return {
    fingerprint,
    stashLog,
    ...(remote ? { remote } : {}),
    preview: {
      headOid,
      branch,
      staged,
      trackedChanges,
      untrackedCount: untracked.length,
      ...(remote ? { destination: remote.display, trackingOid } : {}),
      ...('stashOid' in intent ? { stashOid: intent.stashOid } : {}),
    },
  };
}

import type { ReadGitStatusResponse } from '@porcelain/contracts/changes';
import type { ActionInput } from './git-action.ts';
import {
  branchStatus,
  type GitActionStatus,
  type primaryGitAction,
} from './status.ts';

export type NetworkAction = 'fetch' | 'pull' | 'push';
type LookedBranch = ReadGitStatusResponse['branch'];

export function isNetworkAction(action: string): action is NetworkAction {
  return action === 'fetch' || action === 'pull' || action === 'push';
}

type BranchTarget =
  | { name?: string | null | undefined; upstream?: string | null | undefined }
  | null
  | undefined;

export function networkTarget<Looked extends { branch?: BranchTarget }>(
  looked: Looked | undefined,
  displayedBranch: BranchTarget,
  freshlyRead: boolean,
): { ready: true; looked: Looked } | { ready: false; reason: string } {
  if (!looked)
    return {
      ready: false,
      reason: 'The branch target is still loading. Try again.',
    };
  if (
    freshlyRead &&
    (looked.branch?.name !== displayedBranch?.name ||
      looked.branch?.upstream !== displayedBranch?.upstream)
  )
    return {
      ready: false,
      reason: 'The branch target changed. Review it and try again.',
    };
  return { ready: true, looked };
}

export function networkInput(
  action: NetworkAction,
  branch: LookedBranch,
  strategy: 'merge' | 'rebase',
): ActionInput {
  if (!branch?.name)
    throw new Error('Check out a branch before using the remote.');
  const name = branch.name.replace(/^refs\/heads\//, '');
  if (action === 'fetch' || action === 'pull') {
    if (!branch?.upstream || !branch.remoteName || !branch.sourceRef)
      throw new Error('Configure an upstream branch first.');
    const upstream = `${branch.remoteName}/${branch.sourceRef.replace(/^refs\/heads\//, '')}`;
    if (upstream !== branch.upstream)
      throw new Error(
        'The configured upstream changed. Review it and try again.',
      );
    if (action === 'fetch')
      return {
        action,
        remoteName: branch.remoteName,
        sourceRef: branch.sourceRef,
      };
    return {
      action,
      remoteName: branch.remoteName,
      sourceRef: branch.sourceRef,
      strategy,
    };
  }
  const ref = branch.sourceRef ?? `refs/heads/${name}`;
  const remoteName = branch.remoteName ?? 'origin';
  return {
    action,
    remoteName,
    destinationRef: ref,
    allowCreate: branch?.upstream == null,
  };
}

export const networkTitle = (action: NetworkAction) =>
  action === 'fetch' ? 'Fetch' : action === 'pull' ? 'Pull' : 'Push';

export const networkLabel = (action: NetworkAction) =>
  action === 'fetch' ? 'Fetching' : action === 'pull' ? 'Pulling' : 'Pushing';

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

export function primaryTooltip(
  primary: ReturnType<typeof primaryGitAction>,
  status: GitActionStatus,
) {
  if (primary.kind === 'hint') return primary.hint;
  if (primary.kind === 'commit')
    return `Commit ${plural(status.changes.length, 'changed file')}`;
  const branch = branchStatus(status);
  if (primary.kind === 'stash') {
    const latest = branch?.stashes?.[0]?.message;
    return latest ? `Apply the stash “${latest}”` : 'Apply the latest stash';
  }
  const upstream = branch?.upstream ?? 'the configured remote';
  if (primary.action === 'pull') return `Pull from ${upstream}`;
  return `Push ${plural(branch?.ahead ?? 0, 'commit')} to ${upstream}`;
}

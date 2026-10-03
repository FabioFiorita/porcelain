import type { GitAction } from './git-action';

type GitActionOption = {
  readonly id: GitAction;
  readonly label: string;
  readonly description: string;
};

export const gitActions = [
  {
    id: 'commit',
    label: 'Commit…',
    description: 'Commit selected files',
  },
  {
    id: 'amend',
    label: 'Amend last commit…',
    description: 'Replace the latest commit',
  },
  {
    id: 'push',
    label: 'Push',
    description: 'Send committed changes',
  },
  {
    id: 'pull',
    label: 'Pull',
    description: 'Bring in upstream changes',
  },
  {
    id: 'fetch',
    label: 'Fetch',
    description: 'Update a remote-tracking branch',
  },
  {
    id: 'stash-create',
    label: 'Stash changes',
    description: 'Set aside local changes',
  },
  {
    id: 'stash-apply',
    label: 'Apply stash',
    description: 'Restore a stash and keep it',
  },
  {
    id: 'stash-pop',
    label: 'Pop stash',
    description: 'Restore, then remove a stash',
  },
] as const satisfies readonly GitActionOption[];

export const gitActionGroups = [
  { id: 'commit', actions: [gitActions[0], gitActions[1]] },
  { id: 'sync', actions: [gitActions[2], gitActions[3], gitActions[4]] },
  { id: 'stash', actions: [gitActions[5], gitActions[7]] },
] as const;

export function gitActionLabel(action: GitAction) {
  return gitActions.find((entry) => entry.id === action)?.label;
}

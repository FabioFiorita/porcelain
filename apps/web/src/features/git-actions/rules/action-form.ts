import type { ActionInput, GitAction } from './git-action';

export type FormAction = Exclude<
  GitAction,
  'commit' | 'amend' | 'switch-branch' | 'create-branch' | 'discard'
>;

export function actionFormInput(
  action: FormAction,
  fields: {
    message: string;
    remoteName: string;
    ref: string;
    stashOid: string;
    option: boolean;
    strategy: 'merge' | 'rebase';
  },
): ActionInput {
  const { message, remoteName, ref, stashOid, option, strategy } = fields;
  switch (action) {
    case 'push':
      return { action, remoteName, destinationRef: ref, allowCreate: option };
    case 'pull':
      return { action, remoteName, sourceRef: ref, strategy };
    case 'fetch':
      return { action, remoteName, sourceRef: ref };
    case 'stash-create':
      return { action, message, includeUntracked: option };
    default:
      return { action, stashOid, restoreIndex: option };
  }
}

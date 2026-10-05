import type { ActionInput, GitAction } from './git-action.ts';

export type FormAction = Extract<
  GitAction,
  'stash-create' | 'stash-apply' | 'stash-pop'
>;

export function actionFormInput(
  action: FormAction,
  fields: { message: string; stashOid: string; option: boolean },
): ActionInput {
  const { message, stashOid, option } = fields;
  if (action === 'stash-create')
    return { action, message, includeUntracked: option };
  return { action, stashOid, restoreIndex: option };
}

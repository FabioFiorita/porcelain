import type { CommitDraft, GitScope } from './git-action';
import type { GitActionStatus } from './status';
export type Group = CommitDraft['groups'][number] & { id: string };
export type CommitMode = 'single' | 'amend' | 'groups';
export type CommitFormProps = {
  scope: GitScope;
  status: GitActionStatus;
  action?: 'commit' | 'amend';
  initialMessage?: string;
  lastCommitMessage?: string;
  replacedSubject?: string;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
};
export function commitFormDefaults(
  action: 'commit' | 'amend',
  initialMessage: string,
  lastCommitMessage: string,
): {
  mode: CommitMode;
  message: string;
  amendMessage: string;
  excluded: ReadonlySet<string>;
  added: ReadonlySet<string>;
  groups: Group[] | null;
} {
  return {
    mode: action === 'amend' ? 'amend' : 'single',
    message: action === 'commit' ? initialMessage : '',
    amendMessage: action === 'amend' ? initialMessage : lastCommitMessage,
    excluded: new Set(),
    added: new Set(),
    groups: null,
  };
}

import type { CommitDraft, GitScope } from './git-action';
import type { GitActionStatus } from './status';
export type Group = CommitDraft['groups'][number] & { id: string };
export type CommitMode = 'single' | 'amend' | 'groups';
export type CommitFormProps = {
  scope: GitScope;
  status: GitActionStatus;
  liveBranch: GitActionStatus['branch'];
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

export type DraftedFiles = CommitDraft['expectedFiles'];
export type Drafts = {
  message: DraftedFiles | null;
  groups: DraftedFiles | null;
};

export function draftIsStale(
  status: GitActionStatus,
  drafted: DraftedFiles,
  committed: ReadonlySet<string> = new Set(),
) {
  return drafted.some(
    (file) =>
      !committed.has(file.path) &&
      status.files?.find((looked) => looked.path === file.path)?.fingerprint !==
        file.fingerprint,
  );
}

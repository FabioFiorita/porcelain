export type GitActionIntent =
  | {
      action: 'pull';
      remoteName: string;
      sourceRef: string;
      strategy?: 'ff-only' | 'merge' | 'rebase' | undefined;
    }
  | { action: 'fetch'; remoteName: string; sourceRef: string }
  | {
      action: 'push';
      remoteName: string;
      destinationRef: string;
      allowCreate: boolean;
    }
  | { action: 'commit'; message: string; paths: string[] }
  | { action: 'amend'; message: string; paths: string[] }
  | { action: 'stash-create'; message: string; includeUntracked: boolean }
  | {
      action: 'stash-apply' | 'stash-pop';
      stashOid: string;
      restoreIndex: boolean;
    }
  | {
      action: 'discard';
      path: string;
      hunk?:
        | { scope: 'staged' | 'unstaged'; startLine: number; endLine: number }
        | undefined;
    }
  | { action: 'switch-branch'; branch: string }
  | { action: 'create-branch'; branch: string; switchTo: boolean };

export type GitActionKind = GitActionIntent['action'];

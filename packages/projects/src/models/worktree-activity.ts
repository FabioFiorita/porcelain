import type { ListedWorktree } from './listed-worktree.ts';

export type WorktreeActivity =
  | { readonly kind: 'clean' }
  | { readonly kind: 'dated'; readonly at: string }
  | { readonly kind: 'failed' };

export type WorktreeActivityTarget = Pick<
  ListedWorktree,
  'id' | 'projectId' | 'path' | 'metadataIdentity'
>;

export type WorktreeActivityObservation = WorktreeActivityTarget & {
  readonly activity: WorktreeActivity;
};

import { Schema } from 'effect';
import type { Viewer } from './viewer.ts';

export const reviewGitSettingsSchema = Schema.Struct({
  pullStrategy: Schema.Literals(['merge', 'rebase']),
  collapseSpecs: Schema.Boolean,
  archiveDeleteWorktree: Schema.Boolean,
  archiveDeleteLocalBranch: Schema.Boolean,
  archiveDeleteRemoteBranch: Schema.Boolean,
});
export type ReviewGitSettings = typeof reviewGitSettingsSchema.Type;

export type ConfiguredReviewGitSettings = {
  readonly kind: 'configured';
  readonly revision: number;
  readonly settings: ReviewGitSettings;
};

export type ReviewGitSettingsSnapshot =
  | { readonly kind: 'unconfigured' }
  | ConfiguredReviewGitSettings;

export type SaveReviewGitSettings =
  | { readonly kind: 'initialize'; readonly settings: ReviewGitSettings }
  | { readonly kind: 'change'; readonly change: Partial<ReviewGitSettings> };

export type SaveReviewGitSettingsInput = {
  viewer: Viewer;
  local: boolean;
  save: SaveReviewGitSettings;
};

import { Schema, Struct } from 'effect';
import type { Viewer } from './viewer.ts';

export const reviewGitSettingsSchema = Schema.Struct({
  pullStrategy: Schema.Literals(['merge', 'rebase']),
  collapseSpecs: Schema.Boolean,
  archiveDeleteWorktree: Schema.Boolean,
  archiveDeleteLocalBranch: Schema.Boolean,
  archiveDeleteRemoteBranch: Schema.Boolean,
});
export type ReviewGitSettings = typeof reviewGitSettingsSchema.Type;

export const reviewGitSettingsChangeSchema = reviewGitSettingsSchema
  .mapFields(Struct.map(Schema.optionalKey))
  .check(Schema.isMinProperties(1));
export type ReviewGitSettingsChange =
  typeof reviewGitSettingsChangeSchema.Type;

export const configuredReviewGitSettingsSchema = Schema.Struct({
  kind: Schema.Literal('configured'),
  revision: Schema.Int.check(Schema.isGreaterThan(0)),
  settings: reviewGitSettingsSchema,
});
export type ConfiguredReviewGitSettings =
  typeof configuredReviewGitSettingsSchema.Type;

export const reviewGitSettingsSnapshotSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('unconfigured') }),
  configuredReviewGitSettingsSchema,
]);
export type ReviewGitSettingsSnapshot =
  typeof reviewGitSettingsSnapshotSchema.Type;

export const saveReviewGitSettingsSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('initialize'),
    settings: reviewGitSettingsSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal('change'),
    change: reviewGitSettingsChangeSchema,
  }),
]);
export type SaveReviewGitSettings = typeof saveReviewGitSettingsSchema.Type;

export type SaveReviewGitSettingsInput = {
  viewer: Viewer;
  local: boolean;
  save: SaveReviewGitSettings;
};

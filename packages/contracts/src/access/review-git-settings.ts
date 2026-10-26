import {
  configuredReviewGitSettingsSchema,
  reviewGitSettingsSnapshotSchema,
  saveReviewGitSettingsSchema,
} from '@porcelain/access/models';
import type { Principal } from './principal.ts';

export const readReviewGitSettingsResponseSchema =
  reviewGitSettingsSnapshotSchema;
export const saveReviewGitSettingsRequestSchema = saveReviewGitSettingsSchema;
export const saveReviewGitSettingsResponseSchema =
  configuredReviewGitSettingsSchema;

export type ReadReviewGitSettingsResponse =
  typeof readReviewGitSettingsResponseSchema.Type;
export type SaveReviewGitSettingsRequest =
  typeof saveReviewGitSettingsRequestSchema.Type;
export type SaveReviewGitSettingsInput = {
  viewer: Principal;
  local: boolean;
  save: SaveReviewGitSettingsRequest;
};
export type SaveReviewGitSettingsResponse =
  typeof saveReviewGitSettingsResponseSchema.Type;

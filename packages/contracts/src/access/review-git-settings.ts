import { Schema, Struct } from 'effect';
import { reviewGitSettingsSchema } from '@porcelain/access/models';
import type { Principal } from './principal.ts';

const revisionSchema = Schema.Int.check(Schema.isGreaterThan(0)).check(
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
const configuredSchema = Schema.Struct({
  kind: Schema.Literal('configured'),
  revision: revisionSchema,
  settings: reviewGitSettingsSchema,
});

export { reviewGitSettingsSchema };
export const readReviewGitSettingsResponseSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('unconfigured') }),
  configuredSchema,
]);
export const saveReviewGitSettingsRequestSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('initialize'),
    settings: reviewGitSettingsSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal('change'),
    change: reviewGitSettingsSchema
      .mapFields(Struct.map(Schema.optionalKey))
      .check(Schema.isMinProperties(1)),
  }),
]);
export const saveReviewGitSettingsResponseSchema = configuredSchema;

export type ReviewGitSettings = typeof reviewGitSettingsSchema.Type;
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

import { Schema } from 'effect';
import { pushKindSchema, pushPlatformSchema } from '@porcelain/access/models';
import { PUSH_TOKEN_LENGTH } from '../shared/limits.ts';
import type { Principal } from './principal.ts';

export const setPushRegistrationRequestSchema = Schema.Struct({
  token: Schema.String.check(Schema.isMinLength(1)).check(
    Schema.isMaxLength(PUSH_TOKEN_LENGTH),
  ),
  platform: pushPlatformSchema,
  kinds: Schema.Array(pushKindSchema).check(Schema.isMaxLength(2)),
});
export const setPushRegistrationResponseSchema = Schema.Struct({
  kinds: Schema.Array(pushKindSchema),
});
export const clearPushRegistrationResponseSchema = Schema.Undefined;

export type PushKind = typeof pushKindSchema.Type;
export type SetPushRegistrationRequest =
  typeof setPushRegistrationRequestSchema.Type;
export type SetPushRegistrationInput = SetPushRegistrationRequest & {
  viewer: Principal;
};
export type SetPushRegistrationResponse =
  typeof setPushRegistrationResponseSchema.Type;
export type ClearPushRegistrationInput = { viewer: Principal };

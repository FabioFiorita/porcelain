import { Schema } from 'effect';
import type { Viewer } from './viewer.ts';

export const pushKindSchema = Schema.Never;
type PushKind = typeof pushKindSchema.Type;

export const pushPlatformSchema = Schema.Literals(['ios', 'android']);
type PushPlatform = typeof pushPlatformSchema.Type;

export type PushRegistration = {
  deviceId: string;
  token: string;
  platform: PushPlatform;
  kinds: readonly PushKind[];
};

export type PushRegistrationKey = { deviceId: string };

export type SetPushRegistrationInput = {
  viewer: Viewer;
  token: string;
  platform: PushPlatform;
  kinds: readonly PushKind[];
};

export type SetPushRegistrationResult =
  | { kind: 'registered'; registration: PushRegistration }
  | { kind: 'cleared' };

export type ClearPushRegistrationInput = { viewer: Viewer };

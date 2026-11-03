import { Schema } from 'effect';
import type { Viewer } from './viewer.ts';

export const pushKindSchema = Schema.Literals(['review-ready', 'agent-reply']);
export type PushKind = typeof pushKindSchema.Type;

export const pushPlatformSchema = Schema.Literals(['ios', 'android']);
type PushPlatform = typeof pushPlatformSchema.Type;

export type PushRegistration = {
  deviceId: string;
  token: string;
  platform: PushPlatform;
  kinds: readonly PushKind[];
};

export type PushRegistrationKey = { deviceId: string };

export type PushTokenKey = { deviceId: string; token: string };

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

export type PushEvent =
  | {
      kind: 'review-ready';
      project: string;
      title: string;
      link: string | undefined;
    }
  | {
      kind: 'agent-reply';
      project: string;
      reply: string;
      link: string | undefined;
    };

export type PushContent = {
  title: string;
  body: string;
  data: { kind: PushKind; url?: string };
};

export type PushMessage = PushContent & { deviceId: string; to: string };

export type PushOutcome = 'accepted' | 'unregistered' | 'rejected' | 'unsent';

export type PushDelivery = {
  accepted: number;
  rejected: number;
  unsent: number;
  unregistered: readonly PushTokenKey[];
};

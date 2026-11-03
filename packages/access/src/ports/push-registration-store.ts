import type { Effect } from 'effect';
import { Context } from 'effect';
import type {
  PushRegistration,
  PushRegistrationKey,
} from '../models/push-notifications.ts';

export interface PushRegistrationStore {
  list(): Effect.Effect<readonly PushRegistration[]>;
  save(registration: PushRegistration): Effect.Effect<void>;
  remove(key: PushRegistrationKey): Effect.Effect<void>;
}

export const PushRegistrationStore = Context.Service<
  '@porcelain/access/PushRegistrationStore',
  PushRegistrationStore
>('@porcelain/access/PushRegistrationStore');

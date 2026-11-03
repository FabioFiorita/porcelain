import type { Effect } from 'effect';
import { Context } from 'effect';
import type { PushMessage, PushOutcome } from '../models/push-notifications.ts';

export interface PushSender {
  send(messages: readonly PushMessage[]): Effect.Effect<readonly PushOutcome[]>;
}

export const PushSender = Context.Service<
  '@porcelain/access/PushSender',
  PushSender
>('@porcelain/access/PushSender');

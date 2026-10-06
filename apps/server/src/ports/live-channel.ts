import type { LiveNotice } from '@porcelain/contracts/access';

export type LiveChannel = {
  send(notice: LiveNotice): Effect.Effect<void>;
  ping(): Effect.Effect<void>;
  terminate(): Effect.Effect<void>;
};
import type { Effect } from 'effect';

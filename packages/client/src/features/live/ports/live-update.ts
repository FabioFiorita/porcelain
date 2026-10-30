import type { AtomRef } from 'effect/reactivity';
import type { Effect, Scope } from 'effect';
import type {
  LiveNotice,
  liveSubscriptionSchema,
} from '@porcelain/contracts/access';

export type LiveSubscription = typeof liveSubscriptionSchema.Type;

export type LiveSessionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unauthorized';

export type LiveUpdatePort = {
  readonly state: AtomRef.ReadonlyRef<LiveSessionState>;
  connect(options: {
    onNotice: (notice: LiveNotice) => void;
    onReconnect: () => void;
    onUnauthorized: () => void;
  }): Effect.Effect<
    { subscribe(value: LiveSubscription): void },
    never,
    Scope.Scope
  >;
};

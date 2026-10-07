import type { Effect, Scope } from 'effect';
import type {
  LiveNotice,
  liveSubscriptionSchema,
} from '@porcelain/contracts/access';

export type LiveSubscription = typeof liveSubscriptionSchema.Type;

export type LiveUpdatePort = {
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

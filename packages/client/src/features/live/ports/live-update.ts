import type {
  LiveNotice,
  liveSubscriptionSchema,
} from '@porcelain/contracts/access';

export type LiveSubscription = typeof liveSubscriptionSchema.Type;

export type LiveUpdatePort = {
  connect(options: {
    signal: AbortSignal;
    onNotice: (notice: LiveNotice) => void;
    onReconnect: () => void;
    onUnauthorized: () => void;
  }): { subscribe(value: LiveSubscription): void };
};

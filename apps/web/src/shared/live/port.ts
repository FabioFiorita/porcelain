import type {
  LiveNotice,
  liveSubscriptionSchema,
} from '@porcelain/contracts/access';

export type LiveSubscription = ReturnType<typeof liveSubscriptionSchema.parse>;

export type LiveUpdatePort = {
  connect(options: {
    signal: AbortSignal;
    onNotice: (notice: LiveNotice) => void;
    onReconnect: () => void;
  }): { subscribe(value: LiveSubscription): void };
};

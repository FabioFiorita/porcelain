import type {
  LiveNotice,
  LiveSubscription,
} from '@porcelain/contracts/live-updates';

export type LiveUpdatePort = {
  connect(options: {
    signal: AbortSignal;
    onNotice(notice: LiveNotice): void;
    onReconnect(): void;
  }): { subscribe(value: LiveSubscription): void };
};

import type { LiveNotice } from '@porcelain/contracts/access';

export type LiveChannel = {
  send(notice: LiveNotice): void;
  ping(): void;
  terminate(): void;
};

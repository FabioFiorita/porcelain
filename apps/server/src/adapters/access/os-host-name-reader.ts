import { Effect, Layer } from 'effect';
import { hostname } from 'node:os';
import { HostNameReader } from '@porcelain/access/ports';

export const osHostNameReaderLayer = Layer.effect(
  HostNameReader,
  Effect.sync(() => {
    return {
      hostName(): string {
        return hostname();
      },
    };
  }),
);

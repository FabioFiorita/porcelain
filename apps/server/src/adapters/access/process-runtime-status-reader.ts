import { Effect, Layer } from 'effect';
import type { OwnerStatus } from '@porcelain/kernel/models';
import { RuntimeStatusReader } from '@porcelain/access/ports';

export const processRuntimeStatusReaderLayer = (status: () => OwnerStatus) =>
  Layer.effect(
    RuntimeStatusReader,
    Effect.sync(() => {
      return {
        current(): OwnerStatus {
          return status();
        },
      };
    }),
  );

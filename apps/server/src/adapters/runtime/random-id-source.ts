import { Effect, Layer } from 'effect';
import { randomUUID } from 'node:crypto';
import { IdSource } from '@porcelain/kernel/ports';

export const randomIdSourceLayer = Layer.effect(
  IdSource,
  Effect.sync(() => {
    return {
      next(): string {
        return randomUUID();
      },
    };
  }),
);

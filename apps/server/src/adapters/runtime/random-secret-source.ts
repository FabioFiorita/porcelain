import { Effect, Layer } from 'effect';
import { randomBytes } from 'node:crypto';
import type { Base64UrlSecret } from '@porcelain/kernel/models';
import { SecretSource } from '@porcelain/kernel/ports';

type RandomSecretSourceOptions = { secretBytes: number };

export const randomSecretSourceLayer = (options: RandomSecretSourceOptions) =>
  Layer.effect(
    SecretSource,
    Effect.sync(() => {
      return {
        next(): Base64UrlSecret {
          return randomBytes(options.secretBytes).toString('base64url');
        },
      };
    }),
  );

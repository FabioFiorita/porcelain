import { Effect, Layer } from 'effect';
import { createHmac } from 'node:crypto';
import { SignatureSource } from '@porcelain/reviews/ports';

export const hmacSignatureSourceLayer = Layer.effect(
  SignatureSource,
  Effect.sync(() => {
    return {
      sign(input: { secret: string; message: string }): string {
        return createHmac('sha256', input.secret)
          .update(input.message)
          .digest('base64url');
      },
    };
  }),
);

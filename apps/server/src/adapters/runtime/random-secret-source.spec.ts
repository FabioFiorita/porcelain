import { SecretSource } from '@porcelain/kernel/ports';
import { describe, expect, it } from '@effect/vitest';
import { credential, parseCredential } from '@porcelain/access/rules';
import { Effect, Redacted } from 'effect';
import { randomSecretSourceLayer } from './random-secret-source.ts';

const id = '00000000-0000-4000-8000-000000000001';
const options = { secretBytes: 32 };

describe('RandomSecretSource', () => {
  it.effect('gives a secret that a credential carries and parses back', () =>
    Effect.gen(function* () {
      const secret = (yield* SecretSource).next();
      expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const token = credential('pcd', id, secret).token;
      expect(Redacted.value(token)).toBe(`pcd_${id}_${secret}`);
      const parsed = parseCredential('pcd', Redacted.value(token));
      expect(parsed?.id).toBe(id);
      expect(parsed && Redacted.value(parsed.secret)).toBe(secret);
    }).pipe(Effect.provide(randomSecretSourceLayer(options))),
  );

  it.effect('gives a different secret every time', () =>
    Effect.gen(function* () {
      const source = yield* SecretSource;
      expect(source.next()).not.toBe(source.next());
    }).pipe(Effect.provide(randomSecretSourceLayer(options))),
  );
});

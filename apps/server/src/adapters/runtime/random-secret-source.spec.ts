import { describe, expect, it } from 'vitest';
import { credential, parseCredential } from '@porcelain/access/rules';
import { Redacted } from 'effect';
import { RandomSecretSource } from './random-secret-source.ts';

const id = '00000000-0000-4000-8000-000000000001';
const options = { secretBytes: 32 };

describe('RandomSecretSource', () => {
  it('gives a secret that a credential carries and parses back', () => {
    const secret = new RandomSecretSource(options).next();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const token = credential('pcd', id, secret).token;
    expect(Redacted.value(token)).toBe(`pcd_${id}_${secret}`);
    const parsed = parseCredential('pcd', Redacted.value(token));
    expect(parsed?.id).toBe(id);
    expect(parsed && Redacted.value(parsed.secret)).toBe(secret);
  });

  it('gives a different secret every time', () => {
    const source = new RandomSecretSource(options);
    expect(source.next()).not.toBe(source.next());
  });
});

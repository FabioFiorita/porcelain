import { describe, expect, it } from 'vitest';
import { credential, parseCredential } from '@porcelain/access/rules';
import { RandomSecretSource } from './random-secret-source.ts';

const id = '00000000-0000-4000-8000-000000000001';

describe('RandomSecretSource', () => {
  it('gives a secret that a credential carries and parses back', () => {
    const secret = new RandomSecretSource().next();
    expect(parseCredential('pcd', credential('pcd', id, secret).token)).toEqual(
      { id, secret },
    );
  });

  it('gives a different secret every time', () => {
    const source = new RandomSecretSource();
    expect(source.next()).not.toBe(source.next());
  });
});

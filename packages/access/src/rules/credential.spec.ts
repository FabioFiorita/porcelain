import { describe, expect, it } from 'vitest';
import {
  hashSecret,
  mintCredential,
  parseCredential,
  secretMatches,
} from './credential.ts';

const id = '00000000-0000-4000-8000-000000000001';

describe('mintCredential', () => {
  it('mints a token that parses back to its id and secret', () => {
    const credential = mintCredential('pcd', id);
    expect(credential.token).toBe(`pcd_${id}_${credential.secret}`);
    expect(parseCredential('pcd', credential.token)).toEqual({
      id,
      secret: credential.secret,
    });
  });

  it('mints a different secret every time', () => {
    expect(mintCredential('pcp', id).secret).not.toBe(
      mintCredential('pcp', id).secret,
    );
  });
});

describe('parseCredential', () => {
  const { token } = mintCredential('pcp', id);

  it('refuses a token of the other kind', () => {
    expect(parseCredential('pcd', token)).toBeUndefined();
  });

  it('refuses a token with a malformed id or a truncated secret', () => {
    expect(
      parseCredential('pcp', token.replace(id, 'not-a-uuid')),
    ).toBeUndefined();
    expect(parseCredential('pcp', token.slice(0, -1))).toBeUndefined();
    expect(parseCredential('pcp', `${token}x`)).toBeUndefined();
    expect(parseCredential('pcp', ` ${token}`)).toBeUndefined();
  });
});

describe('secretMatches', () => {
  it('matches only the secret whose hash was stored', () => {
    const { secret } = mintCredential('pcd', id);
    const stored = hashSecret(secret);
    expect(secretMatches(stored, secret)).toBe(true);
    expect(secretMatches(stored, mintCredential('pcd', id).secret)).toBe(false);
  });

  it('does not match against a stored hash of the wrong length', () => {
    expect(secretMatches('abcd', 'secret')).toBe(false);
  });
});

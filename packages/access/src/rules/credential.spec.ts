import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@porcelain/kernel/rules';
import { credential, parseCredential, secretMatches } from './credential.ts';

const id = '00000000-0000-4000-8000-000000000001';
const secret = 'a'.repeat(43);
const otherSecret = 'b'.repeat(43);

describe('credential', () => {
  it('writes a token that parses back to its id and secret', () => {
    const issued = credential('pcd', id, secret);
    expect(issued.token).toBe(`pcd_${id}_${secret}`);
    expect(parseCredential('pcd', issued.token)).toEqual({ id, secret });
  });
});

describe('parseCredential', () => {
  const { token } = credential('pcp', id, secret);

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
    const stored = sha256Hex(secret);
    expect(secretMatches(stored, secret)).toBe(true);
    expect(secretMatches(stored, otherSecret)).toBe(false);
  });

  it('does not match against a stored hash of the wrong length', () => {
    expect(secretMatches(sha256Hex(secret).slice(0, -2), secret)).toBe(false);
    expect(secretMatches('', secret)).toBe(false);
  });
});

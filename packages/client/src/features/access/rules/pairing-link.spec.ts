import { describe, expect, it } from 'vitest';
import { parsePairingLink, remoteLink } from './pairing-link.ts';

describe('remoteLink', () => {
  it('reads a complete pairing link and decodes its code', () => {
    expect(
      remoteLink(' https://example.com:4738/pair#c=one%20time&e=installation '),
    ).toEqual({
      address: 'https://example.com:4738',
      code: 'one time',
      environmentId: 'installation',
    });
  });

  it.each([
    'not a link',
    'ftp://example.com/pair#c=code&e=installation',
    'https://example.com/#c=code&e=installation',
    'https://example.com/pair#c=code',
    'https://example.com/pair#e=installation',
    'https://example.com/pair#c=&e=installation',
  ])('refuses an unusable pairing link %j', (value) => {
    expect(remoteLink(value)).toBeUndefined();
  });
});

describe('parsePairingLink', () => {
  it('reads a pairing code and installation id from a fragment', () => {
    expect(parsePairingLink('#c=one%20time&e=installation')).toEqual({
      code: 'one time',
      environmentId: 'installation',
    });
  });

  it('refuses a fragment missing either required value', () => {
    expect(parsePairingLink('')).toBeNull();
    expect(parsePairingLink('#c=code')).toBeNull();
    expect(parsePairingLink('#e=installation')).toBeNull();
    expect(parsePairingLink('#c=&e=installation')).toBeNull();
  });
});

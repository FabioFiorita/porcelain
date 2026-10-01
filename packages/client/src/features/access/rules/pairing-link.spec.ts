import { describe, expect, it } from 'vitest';
import { parsePairingLink } from './pairing-link.ts';

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

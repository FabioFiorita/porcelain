import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256-hex.ts';

describe('sha256Hex', () => {
  it('answers the lowercase hexadecimal SHA-256 digest of the UTF-8 text', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

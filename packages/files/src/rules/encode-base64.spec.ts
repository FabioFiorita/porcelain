import { describe, expect, it } from 'vitest';
import { encodeBase64 } from './encode-base64.ts';

describe('encodeBase64', () => {
  it('encodes nothing as an empty string', () => {
    expect(encodeBase64(new Uint8Array())).toBe('');
  });

  it('encodes every byte value', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
    expect(encodeBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('encodes content longer than one chunk without seams', () => {
    const bytes = Uint8Array.from(
      { length: 0x8000 * 2 + 7 },
      (_, index) => (index * 31) % 256,
    );
    expect(encodeBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

import { describe, expect, it } from 'vitest';
import { encodeBase64 } from './encode-base64.ts';

function bytesOf(text: string) {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

describe('encodeBase64', () => {
  it('encodes nothing as an empty string', () => {
    expect(encodeBase64(new Uint8Array())).toBe('');
  });

  it('encodes the RFC 4648 test vectors with their padding', () => {
    expect(
      ['f', 'fo', 'foo', 'foob', 'fooba', 'foobar'].map((text) =>
        encodeBase64(bytesOf(text)),
      ),
    ).toEqual(['Zg==', 'Zm8=', 'Zm9v', 'Zm9vYg==', 'Zm9vYmE=', 'Zm9vYmFy']);
  });

  it('encodes bytes above 127 as raw bytes rather than as text', () => {
    expect(encodeBase64(new Uint8Array([0x00, 0xff, 0xfe, 0x80]))).toBe(
      'AP/+gA==',
    );
  });

  it('keeps every byte in order across content larger than a chunk', () => {
    const bytes = Uint8Array.from(
      { length: 0x8000 * 2 + 7 },
      (_, index) => (index * 31) % 256,
    );
    expect(bytesOf(atob(encodeBase64(bytes)))).toEqual(bytes);
  });
});

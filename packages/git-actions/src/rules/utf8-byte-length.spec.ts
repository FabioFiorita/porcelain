import { describe, expect, it } from 'vitest';
import { utf8ByteLength } from './utf8-byte-length.ts';

describe('utf8ByteLength', () => {
  it('counts one byte for ASCII text', () => {
    expect(utf8ByteLength('Fix README')).toBe(10);
  });

  it('counts two, three and four bytes for wider characters', () => {
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
  });

  it('counts a lone surrogate as the three-byte replacement character', () => {
    expect(utf8ByteLength('\ud800')).toBe(3);
  });

  it('counts nothing for empty text', () => {
    expect(utf8ByteLength('')).toBe(0);
  });
});

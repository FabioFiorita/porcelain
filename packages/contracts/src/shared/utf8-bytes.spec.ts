import { describe, expect, it } from 'vitest';
import { utf8ByteLength } from './utf8-bytes.ts';

describe('utf8ByteLength', () => {
  it('counts one byte for each ASCII character', () => {
    expect(utf8ByteLength('Fix README')).toBe(10);
  });

  it('counts two, three and four bytes for wider characters', () => {
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
  });

  it('moves to the next width exactly at each UTF-8 boundary', () => {
    expect(utf8ByteLength('\u007f')).toBe(1);
    expect(utf8ByteLength('\u0080')).toBe(2);
    expect(utf8ByteLength('߿')).toBe(2);
    expect(utf8ByteLength('ࠀ')).toBe(3);
    expect(utf8ByteLength('￿')).toBe(3);
    expect(utf8ByteLength('\u{10000}')).toBe(4);
  });

  it('counts a character outside the basic plane once, not as two halves', () => {
    expect(utf8ByteLength('a😀b')).toBe(6);
  });

  it('counts nothing for empty text', () => {
    expect(utf8ByteLength('')).toBe(0);
  });
});

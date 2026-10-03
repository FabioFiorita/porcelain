import { expect, it } from 'vitest';
import { utf8ByteLength } from './utf8-byte-length.ts';

it('counts literal percent escapes as text', () => {
  expect(utf8ByteLength('a%20b')).toBe(5);
});

it('counts wide Unicode characters by encoded bytes', () => {
  expect(utf8ByteLength('é€😀')).toBe(9);
});

it('counts a lone surrogate as a replacement character', () => {
  expect(utf8ByteLength('\ud800')).toBe(3);
});

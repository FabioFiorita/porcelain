import { expect, it } from 'vitest';
import { counted, plural } from './counted.ts';

it.each([
  [0, '0 files'],
  [1, '1 file'],
  [2, '2 files'],
])('counts %i with the noun in agreement: %s', (count, text) => {
  expect(counted(count, 'file')).toBe(text);
});

it.each([
  [1, '1 file has'],
  [3, '3 files have'],
])('takes an irregular plural for %i: %s', (count, text) => {
  expect(counted(count, 'file has', 'files have')).toBe(text);
});

it.each([
  [0, 'them'],
  [1, 'it'],
  [2, 'them'],
])('chooses the word alone for %i: %s', (count, word) => {
  expect(plural(count, 'it', 'them')).toBe(word);
});

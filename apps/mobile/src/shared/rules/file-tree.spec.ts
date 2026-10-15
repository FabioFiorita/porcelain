import { expect, test } from 'vitest';
import { isNativeImagePath } from './file-tree';

test('SVG files use editable source while bitmap images keep native previews', () => {
  expect(isNativeImagePath('assets/logo.SVG')).toBe(false);
  expect(isNativeImagePath('assets/photo.PNG')).toBe(true);
  expect(isNativeImagePath('assets/photo.jpg')).toBe(true);
  expect(isNativeImagePath('src/main.ts')).toBe(false);
});

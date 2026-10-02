import { describe, expect, it } from 'vitest';
import { validLabel, validPlatform } from './device-details.ts';

const LABEL_LENGTH = 80;
const PLATFORM_LENGTH = 120;

describe('validLabel', () => {
  it('keeps a label without its surrounding whitespace', () => {
    expect(validLabel('  Work laptop ', LABEL_LENGTH)).toBe('Work laptop');
  });

  it('accepts eighty characters and refuses eighty-one', () => {
    expect(validLabel('a'.repeat(80), LABEL_LENGTH)).toBe('a'.repeat(80));
    expect(validLabel('a'.repeat(81), LABEL_LENGTH)).toBeUndefined();
  });

  it('refuses a blank label', () => {
    expect(validLabel('   ', LABEL_LENGTH)).toBeUndefined();
  });

  it.each([
    { name: 'a line feed', label: 'Phone\n2' },
    { name: 'a NUL', label: 'Phone\u0000' },
    { name: 'a DEL', label: 'Phone\u007f' },
    { name: 'a C1 next line', label: 'Ph\u0085one' },
    { name: 'the last C0 control', label: 'Ph\u001fone' },
    { name: 'the last C1 control', label: 'Ph\u009fone' },
  ])('refuses a label holding $name', ({ label }) => {
    expect(validLabel(label, LABEL_LENGTH)).toBeUndefined();
  });

  it('keeps printable characters just past the control ranges', () => {
    expect(validLabel('Ph\u00a0one', LABEL_LENGTH)).toBe('Ph\u00a0one');
    expect(validLabel('Ph ~one', LABEL_LENGTH)).toBe('Ph ~one');
  });
});

describe('validPlatform', () => {
  it('accepts one hundred and twenty characters and refuses one more', () => {
    expect(validPlatform('p'.repeat(120), PLATFORM_LENGTH)).toBe(
      'p'.repeat(120),
    );
    expect(validPlatform('p'.repeat(121), PLATFORM_LENGTH)).toBeUndefined();
  });
});

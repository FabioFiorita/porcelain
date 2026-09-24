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

  it('refuses control characters, including C1 controls', () => {
    for (const label of [
      'Phone\n2',
      'Phone\u0000',
      'Phone\u007f',
      'Ph\u0085one',
      'Ph\u001fone',
      'Ph\u009fone',
    ])
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

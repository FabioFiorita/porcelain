import { describe, expect, it } from 'vitest';
import { validLabel, validPlatform } from './device-details.ts';

describe('validLabel', () => {
  it('keeps a label without its surrounding whitespace', () => {
    expect(validLabel('  Work laptop ')).toBe('Work laptop');
  });

  it('accepts eighty characters and refuses eighty-one', () => {
    expect(validLabel('a'.repeat(80))).toBe('a'.repeat(80));
    expect(validLabel('a'.repeat(81))).toBeUndefined();
  });

  it('refuses a blank label', () => {
    expect(validLabel('   ')).toBeUndefined();
  });

  it('refuses control characters, including C1 controls', () => {
    for (const label of [
      'Phone\n2',
      'Phone\u0000',
      'Phone\u007f',
      'Ph\u0085one',
    ])
      expect(validLabel(label)).toBeUndefined();
  });
});

describe('validPlatform', () => {
  it('accepts one hundred and twenty characters and refuses one more', () => {
    expect(validPlatform('p'.repeat(120))).toBe('p'.repeat(120));
    expect(validPlatform('p'.repeat(121))).toBeUndefined();
  });
});

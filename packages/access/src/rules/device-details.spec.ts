import { describe, expect, it } from 'vitest';
import { InvalidDeviceDetailsError } from '@porcelain/access/errors';
import { checkedLabel, checkedPlatform } from './device-details.ts';

describe('checkedLabel', () => {
  it('keeps a label without its surrounding whitespace', () => {
    expect(checkedLabel('  Work laptop ')).toBe('Work laptop');
  });

  it('accepts eighty characters and refuses eighty-one', () => {
    expect(checkedLabel('a'.repeat(80))).toBe('a'.repeat(80));
    expect(() => checkedLabel('a'.repeat(81))).toThrow(
      InvalidDeviceDetailsError,
    );
  });

  it('refuses a blank label', () => {
    expect(() => checkedLabel('   ')).toThrow(InvalidDeviceDetailsError);
  });

  it('refuses control characters, including C1 controls', () => {
    for (const label of [
      'Phone\n2',
      'Phone\u0000',
      'Phone\u007f',
      'Ph\u0085one',
    ])
      expect(() => checkedLabel(label)).toThrow(InvalidDeviceDetailsError);
  });
});

describe('checkedPlatform', () => {
  it('accepts one hundred and twenty characters and refuses one more', () => {
    expect(checkedPlatform('p'.repeat(120))).toBe('p'.repeat(120));
    expect(() => checkedPlatform('p'.repeat(121))).toThrow(
      InvalidDeviceDetailsError,
    );
  });
});

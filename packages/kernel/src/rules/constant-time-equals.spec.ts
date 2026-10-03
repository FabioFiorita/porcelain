import { describe, expect, it } from 'vitest';
import { constantTimeEquals } from './constant-time-equals.ts';

describe('constantTimeEquals', () => {
  it('matches a value equal to the expected one', () => {
    expect(constantTimeEquals('A'.repeat(43), 'A'.repeat(43))).toBe(true);
    expect(constantTimeEquals('', '')).toBe(true);
  });

  it('refuses a truncated, extended or altered value', () => {
    const expected = `${'A'.repeat(42)}B`;
    expect(constantTimeEquals(expected, expected.slice(1))).toBe(false);
    expect(constantTimeEquals(expected, `${expected}A`)).toBe(false);
    expect(constantTimeEquals(expected, 'A'.repeat(43))).toBe(false);
    expect(constantTimeEquals(expected, '')).toBe(false);
  });
});

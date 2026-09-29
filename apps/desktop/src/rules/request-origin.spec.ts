import { describe, expect, it } from 'vitest';
import { desktopRequestOrigin } from './request-origin.ts';

describe('desktopRequestOrigin', () => {
  it('accepts a request from the desktop document', () => {
    expect(desktopRequestOrigin('porcelain://app')).toBe(true);
  });
  it('accepts browser navigation without an Origin header', () => {
    expect(desktopRequestOrigin(null)).toBe(true);
  });
  it.each([
    'null',
    'https://app',
    'porcelain://elsewhere',
    'porcelain://app.evil',
    '',
  ])('refuses an opaque or foreign request origin: %s', (origin) => {
    expect(desktopRequestOrigin(origin)).toBe(false);
  });
});

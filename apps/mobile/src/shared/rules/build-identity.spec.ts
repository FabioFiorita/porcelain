import { describe, expect, it } from 'vitest';
import { buildIdentity } from './build-identity.ts';

describe('buildIdentity', () => {
  it('defaults to a development identity separate from the store app', () => {
    expect(buildIdentity(undefined)).toEqual({
      name: 'Porcelain Dev',
      bundleIdentifier: 'com.fabiofiorita.porcelain.dev',
      scheme: 'porcelain.dev',
    });
  });
  it('gives preview its own installation and deep links', () => {
    expect(buildIdentity('preview')).toEqual({
      name: 'Porcelain Preview',
      bundleIdentifier: 'com.fabiofiorita.porcelain.preview',
      scheme: 'porcelain.preview',
    });
  });
  it('keeps the existing store identity for production', () => {
    expect(buildIdentity('production')).toEqual({
      name: 'Porcelain',
      bundleIdentifier: 'com.fabiofiorita.porcelain',
      scheme: 'porcelain',
    });
  });
  it('refuses an unknown variant instead of choosing a release identity', () => {
    expect(() => buildIdentity('prod')).toThrow('Unknown mobile build variant');
  });
});

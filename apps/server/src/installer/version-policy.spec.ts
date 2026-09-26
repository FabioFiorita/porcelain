import { describe, expect, it } from 'vitest';
import { compareVersions, isDowngrade } from './version-policy.ts';

describe('version policy', () => {
  it('orders releases by major, minor and patch', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('ranks a prerelease below its release and numeric parts numerically', () => {
    expect(compareVersions('1.0.0-beta.2', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0-beta.10', '1.0.0-beta.9')).toBe(1);
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
  });

  it('ignores build metadata', () => {
    expect(compareVersions('1.0.0+build.7', '1.0.0')).toBe(0);
  });

  it('refuses a version it cannot read', () => {
    expect(() => compareVersions('1.0', '1.0.0')).toThrow(
      'Invalid package version: 1.0',
    );
  });

  it('treats only an older candidate as a downgrade', () => {
    expect(isDowngrade('1.4.0', '1.5.0')).toBe(true);
    expect(isDowngrade('1.5.0', '1.5.0')).toBe(false);
    expect(isDowngrade('1.6.0-rc.1', '1.5.0')).toBe(false);
  });
});

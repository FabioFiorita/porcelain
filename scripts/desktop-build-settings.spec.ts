import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { describe, expect, it } from 'vitest';
import {
  desktopBuildMode,
  desktopBuildSettings,
} from './desktop-build-settings.ts';

const identity = 'Developer ID Application: Verification (TEAM)';
const entitlements = '/checkout/scripts/assets/entitlements.mac.plist';
const releaseEnvironment = {
  PORCELAIN_MAC_SIGNING_IDENTITY: identity,
  PORCELAIN_MAC_KEYCHAIN: '/test/login.keychain-db',
  APPLE_ID: 'verification@example.test',
  APPLE_APP_SPECIFIC_PASSWORD: 'test-only-notary-password',
  APPLE_TEAM_ID: 'TEAM',
};

describe('desktopBuildMode', () => {
  it('refuses a command that requests release and signed verification together', () => {
    expect(() =>
      desktopBuildMode(['--release', '--signed-verification']),
    ).toThrow('Choose either --release or --signed-verification');
  });
});

describe('desktopBuildSettings', () => {
  it('signs local verification with production security and no notarization credentials', () => {
    const settings = desktopBuildSettings(
      'signed-verification',
      {
        PORCELAIN_MAC_SIGNING_IDENTITY: identity,
        PORCELAIN_MAC_KEYCHAIN: '/test/login.keychain-db',
      },
      entitlements,
    );
    expect(settings.packaging.osxSign).toMatchObject({
      identity,
      keychain: '/test/login.keychain-db',
    });
    expect(settings.packaging.osxSign.optionsForFile()).toEqual({
      hardenedRuntime: true,
      entitlements: '/checkout/scripts/assets/entitlements.mac.plist',
    });
    expect(settings.packaging.asar).toEqual({
      unpack: '**/{*.node,macos-trash}',
    });
    expect(settings.fuses).toEqual({
      version: FuseVersion.V1,
      strictlyRequireAllFuses: true,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      [FuseV1Options.WasmTrapHandlers]: true,
    });
    expect(settings.packaging.osxNotarize).toBeUndefined();
    expect(settings.release).toBeUndefined();
  });

  it('does not submit local verification to Apple even when release credentials are present', () => {
    const settings = desktopBuildSettings(
      'signed-verification',
      releaseEnvironment,
      entitlements,
    );
    expect(settings.packaging.osxSign.identity).toBe(
      'Developer ID Application: Verification (TEAM)',
    );
    expect(settings.packaging.osxSign.optionsForFile()).toEqual({
      hardenedRuntime: true,
      entitlements,
    });
    expect(settings.packaging.osxNotarize).toBeUndefined();
    expect(settings.release).toBeUndefined();
  });

  it.each([
    { name: 'missing', environment: {} },
    { name: 'blank', environment: { PORCELAIN_MAC_SIGNING_IDENTITY: '   ' } },
    { name: 'ad-hoc', environment: { PORCELAIN_MAC_SIGNING_IDENTITY: '-' } },
  ])(
    'refuses $name signing identity for local signed verification',
    ({ environment }) => {
      expect(() =>
        desktopBuildSettings('signed-verification', environment, entitlements),
      ).toThrow(
        'A signed verification build requires a real PORCELAIN_MAC_SIGNING_IDENTITY; ad-hoc signing is not supported',
      );
    },
  );

  it('keeps hardened notarized release signing and all submission inputs', () => {
    const settings = desktopBuildSettings(
      'release',
      releaseEnvironment,
      entitlements,
    );
    expect(settings.packaging.osxSign).toMatchObject({
      identity,
      keychain: '/test/login.keychain-db',
    });
    expect(settings.packaging.osxSign.optionsForFile()).toEqual({
      hardenedRuntime: true,
      entitlements,
    });
    expect(settings.packaging.osxNotarize).toEqual({
      appleId: 'verification@example.test',
      appleIdPassword: 'test-only-notary-password',
      teamId: 'TEAM',
    });
    expect(settings.release).toEqual({
      identity: 'Developer ID Application: Verification (TEAM)',
      keychain: '/test/login.keychain-db',
      appleId: 'verification@example.test',
      appleIdPassword: 'test-only-notary-password',
      teamId: 'TEAM',
    });
  });

  it('continues requiring Apple submission credentials for release', () => {
    expect(() =>
      desktopBuildSettings(
        'release',
        { PORCELAIN_MAC_SIGNING_IDENTITY: identity },
        entitlements,
      ),
    ).toThrow(
      'A release build signs and notarizes the app; set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID',
    );
  });

  it('keeps existing development identity signing without enabling release behavior', () => {
    const settings = desktopBuildSettings(
      'development',
      releaseEnvironment,
      entitlements,
    );
    expect(settings.packaging.osxSign).toMatchObject({
      identity: 'Developer ID Application: Verification (TEAM)',
    });
    expect(settings.packaging.osxSign.optionsForFile()).toEqual({
      hardenedRuntime: false,
    });
    expect(settings.packaging.osxNotarize).toBeUndefined();
    expect(settings.release).toBeUndefined();
  });
});

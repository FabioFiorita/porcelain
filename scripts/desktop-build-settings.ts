import { FuseV1Options, FuseVersion, type FuseV1Config } from '@electron/fuses';
import { parseArgs } from 'node:util';

export type DesktopBuildMode =
  | 'development'
  | 'signed-verification'
  | 'release';
export type DesktopRelease = {
  identity: string;
  keychain: string | undefined;
  appleId: string;
  appleIdPassword: string;
  teamId: string;
};

const lockedFuses = {
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
} satisfies FuseV1Config;

export function desktopBuildMode(args: readonly string[]): DesktopBuildMode {
  const { values } = parseArgs({
    args: [...args],
    options: {
      release: { type: 'boolean' },
      'signed-verification': { type: 'boolean' },
    },
  });
  const release = values.release;
  const verification = values['signed-verification'];
  if (release && verification)
    throw new Error('Choose either --release or --signed-verification');
  if (release) return 'release';
  return verification ? 'signed-verification' : 'development';
}

function releaseCredentials(
  environment: Readonly<Record<string, string | undefined>>,
): DesktopRelease {
  const required = [
    'PORCELAIN_MAC_SIGNING_IDENTITY',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
  ];
  const missing = required.filter((name) => !environment[name]?.trim());
  if (missing.length > 0)
    throw new Error(
      `A release build signs and notarizes the app; set ${missing.join(', ')}`,
    );
  const value = (name: string) => environment[name]?.trim() ?? '';
  return {
    identity: value('PORCELAIN_MAC_SIGNING_IDENTITY'),
    keychain: value('PORCELAIN_MAC_KEYCHAIN') || undefined,
    appleId: value('APPLE_ID'),
    appleIdPassword: value('APPLE_APP_SPECIFIC_PASSWORD'),
    teamId: value('APPLE_TEAM_ID'),
  };
}

function verificationCredentials(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const identity = environment.PORCELAIN_MAC_SIGNING_IDENTITY?.trim();
  if (!identity || identity === '-')
    throw new Error(
      'A signed verification build requires a real PORCELAIN_MAC_SIGNING_IDENTITY; ad-hoc signing is not supported',
    );
  return {
    identity,
    keychain: environment.PORCELAIN_MAC_KEYCHAIN?.trim() || undefined,
  };
}

export function desktopBuildSettings(
  mode: DesktopBuildMode,
  environment: Readonly<Record<string, string | undefined>>,
  entitlements: string,
) {
  const identity = environment.PORCELAIN_MAC_SIGNING_IDENTITY?.trim();
  const release =
    mode === 'release' ? releaseCredentials(environment) : undefined;
  const signed =
    mode === 'signed-verification'
      ? verificationCredentials(environment)
      : release;
  const signing = signed
    ? {
        identity: signed.identity,
        ...(signed.keychain === undefined ? {} : { keychain: signed.keychain }),
        optionsForFile: () => ({ hardenedRuntime: true, entitlements }),
      }
    : identity
      ? { identity, optionsForFile: () => ({ hardenedRuntime: false }) }
      : {
          identity: '-',
          identityValidation: false,
          optionsForFile: () => ({ hardenedRuntime: false }),
        };
  return {
    packaging: {
      osxSign: signing,
      asar: { unpack: '**/{*.node,macos-trash}' },
      ...(release === undefined
        ? {}
        : {
            osxNotarize: {
              appleId: release.appleId,
              appleIdPassword: release.appleIdPassword,
              teamId: release.teamId,
            },
          }),
    },
    release,
    fuses: lockedFuses,
  };
}

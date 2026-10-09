import { mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  flipFuses,
  FuseV1Options,
  FuseVersion,
  type FuseV1Config,
} from '@electron/fuses';
import { packager } from '@electron/packager';
import { Schema } from 'effect';
import {
  desktopCommand,
  root,
  stageDesktop,
} from '../apps/desktop/spec/kit/stage.ts';

const output = join(root, 'dist/desktop');
const stage = join(output, 'stage');
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

const signingIdentity = process.env.PORCELAIN_MAC_SIGNING_IDENTITY?.trim();
const releaseVariables = [
  'PORCELAIN_MAC_SIGNING_IDENTITY',
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_TEAM_ID',
] as const;

type Release = {
  identity: string;
  keychain: string | undefined;
  appleId: string;
  appleIdPassword: string;
  teamId: string;
};

function releaseCredentials(): Release {
  const missing = releaseVariables.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0)
    throw new Error(
      `A release build signs and notarizes the app; set ${missing.join(', ')}`,
    );
  const value = (name: (typeof releaseVariables)[number]) =>
    process.env[name]?.trim() ?? '';
  return {
    identity: value('PORCELAIN_MAC_SIGNING_IDENTITY'),
    keychain: process.env.PORCELAIN_MAC_KEYCHAIN?.trim() || undefined,
    appleId: value('APPLE_ID'),
    appleIdPassword: value('APPLE_APP_SPECIFIC_PASSWORD'),
    teamId: value('APPLE_TEAM_ID'),
  };
}

async function releaseVersion(): Promise<string> {
  return Schema.decodeUnknownSync(Schema.Struct({ version: Schema.String }))(
    JSON.parse(await readFile(join(root, 'package.json'), 'utf8')),
  ).version;
}

async function notarize(path: string, release: Release) {
  await desktopCommand('/usr/bin/xcrun', [
    'notarytool',
    'submit',
    path,
    '--apple-id',
    release.appleId,
    '--password',
    release.appleIdPassword,
    '--team-id',
    release.teamId,
    '--wait',
  ]);
  await desktopCommand('/usr/bin/xcrun', ['stapler', 'staple', path]);
}

async function diskImage(app: string, release: Release): Promise<string> {
  const volume = join(output, 'volume');
  await rm(volume, { recursive: true, force: true });
  await mkdir(volume, { recursive: true });
  await desktopCommand('/usr/bin/ditto', [app, join(volume, 'Porcelain.app')]);
  await symlink('/Applications', join(volume, 'Applications'));
  const image = join(
    output,
    `Porcelain-${await releaseVersion()}-${process.arch}.dmg`,
  );
  await desktopCommand('/usr/bin/hdiutil', [
    'create',
    '-volname',
    'Porcelain',
    '-srcfolder',
    volume,
    '-ov',
    '-format',
    'UDZO',
    image,
  ]);
  await desktopCommand('/usr/bin/codesign', [
    '--sign',
    release.identity,
    ...(release.keychain === undefined ? [] : ['--keychain', release.keychain]),
    '--timestamp',
    image,
  ]);
  await notarize(image, release);
  await rm(volume, { recursive: true, force: true });
  return image;
}

export async function buildDesktop(
  options: { release?: boolean } = {},
): Promise<{ app: string; image: string | undefined }> {
  if (process.platform !== 'darwin')
    throw new Error('Build the local Mac app on macOS');
  if (process.arch !== 'arm64' && process.arch !== 'x64')
    throw new Error('The Mac app requires arm64 or x64');
  const release = options.release ? releaseCredentials() : undefined;
  await rm(stage, { recursive: true, force: true });
  const { electronVersion } = await stageDesktop({
    directory: stage,
    productName: 'Porcelain',
    web: true,
  });
  const packaged = await packager({
    dir: stage,
    name: 'Porcelain',
    executableName: 'Porcelain',
    icon: join(root, 'scripts/assets/porcelain.icns'),
    platform: 'darwin',
    arch: process.arch,
    electronVersion,
    appBundleId: 'com.fabiofiorita.porcelain',
    appCategoryType: 'public.app-category.developer-tools',
    asar: { unpack: '**/{*.node,macos-trash}' },
    prune: false,
    out: output,
    overwrite: true,
    afterCopy: [
      async ({ buildPath }) => {
        await flipFuses(resolve(buildPath, '../../..'), lockedFuses);
      },
    ],
    osxSign: release
      ? {
          identity: release.identity,
          ...(release.keychain === undefined
            ? {}
            : { keychain: release.keychain }),
          optionsForFile: () => ({
            hardenedRuntime: true,
            entitlements: join(root, 'scripts/assets/entitlements.mac.plist'),
          }),
        }
      : signingIdentity
        ? {
            identity: signingIdentity,
            optionsForFile: () => ({ hardenedRuntime: false }),
          }
        : {
            identity: '-',
            identityValidation: false,
            optionsForFile: () => ({ hardenedRuntime: false }),
          },
    ...(release === undefined
      ? {}
      : {
          osxNotarize: {
            appleId: release.appleId,
            appleIdPassword: release.appleIdPassword,
            teamId: release.teamId,
          },
        }),
    extendInfo: {
      NSLocalNetworkUsageDescription:
        'Porcelain can share your projects with devices you pair on your local network.',
    },
  });
  const directory = packaged[0];
  if (directory === undefined)
    throw new Error('Electron packaging produced no Mac app');
  const app = join(directory, 'Porcelain.app');
  await desktopCommand('/usr/bin/codesign', [
    '--verify',
    '--deep',
    '--strict',
    app,
  ]);
  if (release === undefined) return { app, image: undefined };
  await desktopCommand('/usr/bin/xcrun', ['stapler', 'staple', app]);
  return { app, image: await diskImage(app, release) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const built = await buildDesktop({
      release: process.argv.includes('--release'),
    });
    process.stdout.write(
      `Built ${built.app}\n${built.image === undefined ? '' : `Disk image ${built.image}\n`}`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Mac app build failed'}\n`,
    );
    process.exitCode = 1;
  }
}

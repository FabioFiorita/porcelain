import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  flipFuses,
  FuseV1Options,
  FuseVersion,
  type FuseV1Config,
} from '@electron/fuses';
import { packager } from '@electron/packager';
import { desktopCommand, root, stageDesktop } from './desktop-stage.ts';

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

export async function buildDesktop(): Promise<string> {
  if (process.platform !== 'darwin')
    throw new Error('Build the local Mac app on macOS');
  if (process.arch !== 'arm64' && process.arch !== 'x64')
    throw new Error('The Mac app requires arm64 or x64');
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
    osxSign: signingIdentity
      ? {
          identity: signingIdentity,
          optionsForFile: () => ({ hardenedRuntime: false }),
        }
      : {
          identity: '-',
          identityValidation: false,
          optionsForFile: () => ({ hardenedRuntime: false }),
        },
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
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`Built ${await buildDesktop()}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Mac app build failed'}\n`,
    );
    process.exitCode = 1;
  }
}

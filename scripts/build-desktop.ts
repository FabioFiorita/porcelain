import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flipFuses } from '@electron/fuses';
import { packager } from '@electron/packager';
import { NodeFileSystem } from '@effect/platform-node';
import { Effect, Schema } from 'effect';
import {
  desktopCommand,
  root,
  stageDesktop,
} from '../apps/desktop/spec/kit/stage.ts';
import { writeUpdateManifest } from '../apps/desktop/src/adapters/update-manifest.ts';
import {
  desktopBuildMode,
  desktopBuildSettings,
  type DesktopBuildMode,
  type DesktopRelease,
} from './desktop-build-settings.ts';

const output = join(root, 'dist/desktop');
const stage = join(output, 'stage');
async function releaseVersion(): Promise<string> {
  return Schema.decodeUnknownSync(Schema.Struct({ version: Schema.String }))(
    JSON.parse(await readFile(join(root, 'package.json'), 'utf8')),
  ).version;
}

const updateFeed = [
  'provider: github',
  'owner: FabioFiorita',
  'repo: porcelain',
  'updaterCacheDirName: porcelain-updater',
  '',
].join('\n');

async function updateArchive(app: string): Promise<{
  zip: string;
  manifest: string;
}> {
  const version = await releaseVersion();
  const zip = join(output, `Porcelain-${version}-${process.arch}-mac.zip`);
  await rm(zip, { force: true });
  await desktopCommand('/usr/bin/ditto', [
    '-c',
    '-k',
    '--sequesterRsrc',
    '--keepParent',
    app,
    zip,
  ]);
  const manifest = await Effect.runPromise(
    writeUpdateManifest(zip, version).pipe(
      Effect.provide(NodeFileSystem.layer),
    ),
  );
  return { zip, manifest };
}

async function notarize(path: string, release: DesktopRelease) {
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

async function diskImage(
  app: string,
  release: DesktopRelease,
): Promise<string> {
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

type Built = {
  app: string;
  release: { image: string; zip: string; manifest: string } | undefined;
};

export async function buildDesktop(
  options: { mode?: DesktopBuildMode } = {},
): Promise<Built> {
  if (process.platform !== 'darwin')
    throw new Error('Build the local Mac app on macOS');
  if (process.arch !== 'arm64' && process.arch !== 'x64')
    throw new Error('The Mac app requires arm64 or x64');
  const settings = desktopBuildSettings(
    options.mode ?? 'development',
    process.env,
    join(root, 'scripts/assets/entitlements.mac.plist'),
  );
  const release = settings.release;
  await rm(stage, { recursive: true, force: true });
  const feed = join(output, 'app-update.yml');
  await rm(feed, { force: true });
  if (release !== undefined) {
    await mkdir(output, { recursive: true });
    await writeFile(feed, updateFeed);
  }
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
    ...settings.packaging,
    prune: false,
    out: output,
    overwrite: true,
    ...(release === undefined ? {} : { extraResource: [feed] }),
    afterCopy: [
      async ({ buildPath }) => {
        await flipFuses(resolve(buildPath, '../../..'), settings.fuses);
      },
    ],
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
  if (release === undefined) return { app, release: undefined };
  await desktopCommand('/usr/bin/xcrun', ['stapler', 'staple', app]);
  const update = await updateArchive(app);
  return {
    app,
    release: { image: await diskImage(app, release), ...update },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const built = await buildDesktop({
      mode: desktopBuildMode(process.argv.slice(2)),
    });
    process.stdout.write(
      `Built ${built.app}\n${built.release === undefined ? '' : `Disk image ${built.release.image}\nUpdate ${built.release.zip}\nUpdate manifest ${built.release.manifest}\n`}`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Mac app build failed'}\n`,
    );
    process.exitCode = 1;
  }
}

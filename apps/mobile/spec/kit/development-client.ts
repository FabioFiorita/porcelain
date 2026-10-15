import { spawn } from 'node:child_process';
import {
  constants,
  createWriteStream,
  existsSync,
  readFileSync,
} from 'node:fs';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFingerprintAsync } from 'expo/fingerprint';
import { buildIdentity } from '../../src/shared/rules/build-identity.ts';

export const mobileRoot = resolve(import.meta.dirname, '../..');
export const repositoryRoot = resolve(mobileRoot, '../..');
export const identity = buildIdentity('development');

const workspace = join(mobileRoot, 'ios', 'PorcelainDev.xcworkspace');
const derivedData = join(mobileRoot, 'ios', 'build');
const appPath = join(
  derivedData,
  'Build/Products/Debug-iphonesimulator/PorcelainDev.app',
);
const fingerprintFile = join(derivedData, 'native-fingerprint');
export type MobilePlatform = 'ios' | 'android';
const androidBuild = join(mobileRoot, 'android/app/build');
const apkPath = join(androidBuild, 'outputs/apk/debug/app-debug.apk');
function buildPaths(platform: MobilePlatform) {
  return platform === 'ios'
    ? { app: appPath, marker: fingerprintFile }
    : { app: apkPath, marker: join(androidBuild, 'native-fingerprint') };
}
const sharedClients = '/tmp/porcelain-development-clients';
const developerMenuFlags =
  '__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1';
const androidSourcesOutsideTheIosClient = '**/android/**/*';
export const buildCommand = '.agents/skills/mobile-verify/scripts/cli build';

function requireDevelopmentVariant(): void {
  if (
    process.env.APP_VARIANT !== undefined &&
    process.env.APP_VARIANT !== 'development'
  )
    throw new Error(
      'Mobile verification only builds Porcelain Dev. Unset APP_VARIANT or set it to development.',
    );
}

export async function nativeFingerprint(
  projectRoot = mobileRoot,
  platform: MobilePlatform = 'ios',
): Promise<string> {
  requireDevelopmentVariant();
  const fingerprint = await createFingerprintAsync(projectRoot, {
    platforms: [platform],
    preset: 'strict',
    ignorePaths: [
      platform === 'ios' ? androidSourcesOutsideTheIosClient : '**/ios/**/*',
    ],
    concurrentIoLimit: 2,
    silent: true,
  });
  if (
    !fingerprint.sources.some(
      (source) =>
        source.type === 'contents' &&
        source.id === 'expoConfig' &&
        source.hash !== null,
    )
  )
    throw new Error(
      'Expo Fingerprint could not read the native app configuration; refusing to use a development client without a complete fingerprint.',
    );
  return fingerprint.hash;
}

export function sharedClientPath(
  fingerprint: string,
  platform: MobilePlatform = 'ios',
): string {
  return join(
    sharedClients,
    fingerprint,
    platform === 'ios' ? 'PorcelainDev.app' : 'PorcelainDev.apk',
  );
}

export function builtFingerprint(
  platform: MobilePlatform = 'ios',
): string | undefined {
  const { app, marker } = buildPaths(platform);
  return existsSync(app) && existsSync(marker)
    ? readFileSync(marker, 'utf8').trim()
    : undefined;
}

export async function developmentClient(
  fingerprint?: string,
  platform: MobilePlatform = 'ios',
): Promise<string | undefined> {
  fingerprint ??= await nativeFingerprint(mobileRoot, platform);
  if (builtFingerprint(platform) === fingerprint)
    return buildPaths(platform).app;
  const shared = sharedClientPath(fingerprint, platform);
  return existsSync(shared) ? shared : undefined;
}

export async function buildProblem(
  platform: MobilePlatform = 'ios',
): Promise<string | undefined> {
  if ((await developmentClient(undefined, platform)) !== undefined)
    return undefined;
  const command = `${buildCommand}${platform === 'android' ? ' --device android' : ''}`;
  return `No development client matches the ${platform} native inputs. JavaScript changes refresh through Metro; native modules, configuration or source need a rebuild with ${command}.`;
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  log: string,
): Promise<void> {
  return new Promise((done, fail) => {
    const output = createWriteStream(log, { flags: 'a' });
    output.write(`\n$ ${command} ${args.join(' ')}\n`);
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        APP_VARIANT: 'development',
        CI: '1',
        EXPO_NO_TELEMETRY: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(output, { end: false });
    child.stderr.pipe(output, { end: false });
    child.once('error', fail);
    child.once('close', (code) => {
      output.end();
      if (code === 0) done();
      else fail(new Error(`${command} ${args[0] ?? ''} failed; read ${log}`));
    });
  });
}

export async function buildDevelopmentClient(
  log: string,
  platform: MobilePlatform = 'ios',
): Promise<void> {
  requireDevelopmentVariant();
  await run(
    join(mobileRoot, 'node_modules/.bin/expo'),
    [
      'prebuild',
      '--platform',
      platform,
      ...(platform === 'android' ? ['--no-install'] : []),
    ],
    mobileRoot,
    log,
  );
  const gradle = join(mobileRoot, 'android/gradlew');
  const gradleArgs = [
    '--no-daemon',
    '--max-workers=2',
    '-Pkotlin.compiler.execution.strategy=in-process',
    '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m',
    '-PreactNativeArchitectures=x86_64,arm64-v8a',
  ];
  if (platform === 'android')
    await run(
      gradle,
      ['help', ...gradleArgs],
      join(mobileRoot, 'android'),
      log,
    );
  const fingerprint = await nativeFingerprint(mobileRoot, platform);
  if (platform === 'android') {
    await run(
      gradle,
      ['app:assembleDebug', ...gradleArgs],
      join(mobileRoot, 'android'),
      log,
    );
  } else
    await run(
      'xcodebuild',
      [
        '-workspace',
        workspace,
        '-scheme',
        'PorcelainDev',
        '-configuration',
        'Debug',
        '-sdk',
        'iphonesimulator',
        '-destination',
        'generic/platform=iOS Simulator',
        '-derivedDataPath',
        derivedData,
        `ARCHS=${process.arch === 'arm64' ? 'arm64' : 'x86_64'}`,
        'ONLY_ACTIVE_ARCH=YES',
        'build',
      ],
      mobileRoot,
      log,
    );
  const after = await nativeFingerprint(mobileRoot, platform);
  if (after !== fingerprint)
    throw new Error(
      `Native inputs changed while the ${platform} development client was building (${fingerprint} -> ${after}); run ${buildCommand} --device ${platform === 'android' ? 'android' : 'iphone'} again before using it.`,
    );
  const { app, marker } = buildPaths(platform);
  await writeFile(marker, `${fingerprint}\n`);
  const shared = sharedClientPath(fingerprint, platform);
  await mkdir(resolve(shared, '..'), { recursive: true });
  await cp(app, shared, {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
  });
}

export function developmentLink(metro: string): string {
  return `${identity.scheme}://expo-development-client/?url=${encodeURIComponent(metro)}&${developerMenuFlags}`;
}

export function screenLink(screen: string): string {
  const path = screen.replace(/^\/+/, '');
  return `${identity.scheme}://${path}?${developerMenuFlags}`;
}

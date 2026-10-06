import { spawn } from 'node:child_process';
import {
  constants,
  createWriteStream,
  existsSync,
  readFileSync,
} from 'node:fs';
import { cp, writeFile } from 'node:fs/promises';
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
const sharedClients = '/tmp/porcelain-development-clients';
const developerMenuFlags =
  '__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1';
export const buildCommand = '.agents/skills/mobile-verify/scripts/cli build';

export async function nativeFingerprint(
  projectRoot = mobileRoot,
): Promise<string> {
  const fingerprint = await createFingerprintAsync(projectRoot, {
    platforms: ['ios'],
    preset: 'strict',
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

export function sharedClientPath(fingerprint: string): string {
  return join(sharedClients, fingerprint, 'PorcelainDev.app');
}

export function builtFingerprint(): string | undefined {
  return existsSync(appPath) && existsSync(fingerprintFile)
    ? readFileSync(fingerprintFile, 'utf8').trim()
    : undefined;
}

export async function developmentClient(): Promise<string | undefined> {
  const fingerprint = await nativeFingerprint();
  if (builtFingerprint() === fingerprint) return appPath;
  const shared = sharedClientPath(fingerprint);
  return existsSync(shared) ? shared : undefined;
}

export async function buildProblem(): Promise<string | undefined> {
  if ((await developmentClient()) !== undefined) return undefined;
  if (builtFingerprint() === undefined)
    return `The development client is not built in this checkout (${appPath}), and no build on this machine left a copy for this native code at ${sharedClientPath(await nativeFingerprint())}. Build it with ${buildCommand}: Expo prebuild, then xcodebuild for the iOS simulator.`;
  return `Expo Fingerprint found changed native modules, configuration or native source since the development client was built; JavaScript changes refresh through Metro, but this change needs a native rebuild: ${buildCommand}.`;
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
      env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
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

export async function buildDevelopmentClient(log: string): Promise<void> {
  await run(
    join(mobileRoot, 'node_modules/.bin/expo'),
    ['prebuild', '--platform', 'ios'],
    mobileRoot,
    log,
  );
  const fingerprint = await nativeFingerprint();
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
  if ((await nativeFingerprint()) !== fingerprint)
    throw new Error(
      `Native inputs changed while the development client was building; run ${buildCommand} again before using it.`,
    );
  await writeFile(fingerprintFile, `${fingerprint}\n`);
  await cp(appPath, sharedClientPath(fingerprint), {
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

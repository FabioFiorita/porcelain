import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  constants,
  createWriteStream,
  existsSync,
  readFileSync,
} from 'node:fs';
import { cp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
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
const nativeInputs = [
  'apps/mobile/app.config.ts',
  'apps/mobile/src/shared/rules/build-identity.ts',
];
const manifestSchema = z.object({
  dependencies: z.record(z.string(), z.string()),
});
const developerMenuFlags =
  '__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1';
export const buildCommand = '.agents/skills/mobile-verify/scripts/cli build';

export function nativeFingerprint(): string {
  const hash = createHash('sha256');
  const { dependencies } = manifestSchema.parse(
    JSON.parse(readFileSync(join(mobileRoot, 'package.json'), 'utf8')),
  );
  hash.update(`dependencies\0${JSON.stringify(dependencies)}\0`);
  for (const file of nativeInputs)
    hash.update(
      `${file}\0${readFileSync(join(repositoryRoot, file), 'utf8')}\0`,
    );
  return hash.digest('hex');
}

export function sharedClientPath(fingerprint: string): string {
  return join(sharedClients, fingerprint, 'PorcelainDev.app');
}

export function builtFingerprint(): string | undefined {
  return existsSync(appPath) && existsSync(fingerprintFile)
    ? readFileSync(fingerprintFile, 'utf8').trim()
    : undefined;
}

export function developmentClient(): string | undefined {
  const fingerprint = nativeFingerprint();
  if (builtFingerprint() === fingerprint) return appPath;
  const shared = sharedClientPath(fingerprint);
  return existsSync(shared) ? shared : undefined;
}

export function buildProblem(): string | undefined {
  if (developmentClient() !== undefined) return undefined;
  if (builtFingerprint() === undefined)
    return `The development client is not built in this checkout (${appPath}), and no build on this machine left a copy for this native code at ${sharedClientPath(nativeFingerprint())}. Build it with ${buildCommand}: Expo prebuild, then xcodebuild for the iOS simulator.`;
  return `Native code changed since the development client was built (the app dependencies in apps/mobile/package.json, ${nativeInputs.join(', ')}); a JavaScript change refreshes through Metro, but this one needs a native rebuild: ${buildCommand}.`;
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
  const fingerprint = nativeFingerprint();
  await run(
    join(mobileRoot, 'node_modules/.bin/expo'),
    ['prebuild', '--clean', '--platform', 'ios'],
    mobileRoot,
    log,
  );
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
  await writeFile(fingerprintFile, `${fingerprint}\n`);
  await rm(sharedClients, { recursive: true, force: true });
  await cp(appPath, sharedClientPath(fingerprint), {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
  });
}

export function developmentLink(metro: string): string {
  return `${identity.scheme}://expo-development-client/?url=${encodeURIComponent(metro)}&${developerMenuFlags}`;
}

export function developmentLaunchUrl(metro: string): string {
  return `${metro}?${developerMenuFlags}`;
}

export function screenLink(screen: string): string {
  const path = screen.replace(/^\/+/, '');
  return `${identity.scheme}://${path}?${developerMenuFlags}`;
}

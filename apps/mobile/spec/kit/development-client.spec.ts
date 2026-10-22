import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  androidDevelopmentAbi,
  buildDevelopmentClient,
  developmentClient,
  nativeFingerprint,
  sharedClientPath,
} from './development-client.ts';

let variant: string | undefined;
let fixture: Awaited<ReturnType<typeof project>>;
const caches: string[] = [];

async function project() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-native-build-'));
  caches.push(root);
  const apk = join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
  const marker = join(root, 'android/app/build/native-fingerprint');
  await mkdir(dirname(apk), { recursive: true });
  await mkdir(join(root, 'node_modules/.bin'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: `native-${randomUUID()}`, version: '1.0.0' }),
  );
  await writeFile(
    join(root, 'app.json'),
    JSON.stringify({
      expo: {
        name: 'Native fixture',
        slug: 'native-fixture',
        android: { package: 'com.example.nativefixture' },
      },
    }),
  );
  return { root, apk, marker };
}

beforeEach(async () => {
  variant = process.env.APP_VARIANT;
  Reflect.deleteProperty(process.env, 'APP_VARIANT');
  fixture = await project();
});
afterEach(async () => {
  if (variant === undefined) Reflect.deleteProperty(process.env, 'APP_VARIANT');
  else process.env.APP_VARIANT = variant;
  for (const cache of caches.splice(0))
    await rm(cache, { recursive: true, force: true });
});

it.each(['preview', 'production'])(
  'refuses to cache a development client under %s native inputs',
  async (value) => {
    process.env.APP_VARIANT = value;
    await expect(nativeFingerprint(fixture.root, 'android')).rejects.toThrow(
      'Mobile verification only builds Porcelain Dev. Unset APP_VARIANT or set it to development.',
    );
  },
);

it.each([
  ['x64', 'x86_64'],
  ['arm64', 'arm64-v8a'],
])('builds only the emulator ABI for a %s host', (host, expected) => {
  expect(androidDevelopmentAbi(host)).toBe(expected);
});

it.each(['ia32', 'arm', 'riscv64', ''])(
  'refuses unsupported host architecture %j',
  async (host) => {
    expect(() => androidDevelopmentAbi(host)).toThrow(
      'Android development builds need an x64 or arm64 host',
    );
    await expect(
      nativeFingerprint(fixture.root, 'android', host),
    ).rejects.toThrow('unsupported');
  },
);

it.each([
  ['android', 'x64', /^[a-f0-9]+-x86_64$/],
  ['android', 'arm64', /^[a-f0-9]+-arm64-v8a$/],
  ['ios', 'arm64', /^[a-f0-9]+$/],
] as const)(
  'keys %s native inputs on %s with the target ABI',
  async (platform, host, expected) => {
    expect(await nativeFingerprint(fixture.root, platform, host)).toMatch(
      expected,
    );
  },
);

it.each([undefined, 'development'])(
  'accepts the development variant %j',
  async (value) => {
    if (value !== undefined) process.env.APP_VARIANT = value;
    expect(await nativeFingerprint(fixture.root, 'android', 'x64')).toMatch(
      /^[a-f0-9]+-x86_64$/,
    );
  },
);

it.each([
  ['x64', 'x64', true],
  ['arm64', 'arm64', true],
  ['x64', 'arm64', false],
  ['arm64', 'x64', false],
] as const)(
  'reuses a cached %s APK for a %s build: %s',
  async (builtHost, requestedHost, reuse) => {
    const built = await nativeFingerprint(fixture.root, 'android', builtHost);
    const requested = await nativeFingerprint(
      fixture.root,
      'android',
      requestedHost,
    );
    const apk = sharedClientPath(built, 'android');
    caches.push(dirname(apk));
    await mkdir(dirname(apk), { recursive: true });
    await writeFile(apk, 'built APK');
    expect(await developmentClient(requested, 'android', fixture.root)).toBe(
      reuse ? apk : undefined,
    );
  },
);

it.each(['x64', 'arm64'])(
  'refuses an old universal APK cache for %s',
  async (host) => {
    const fingerprint = await nativeFingerprint(fixture.root, 'android', host);
    const apk = sharedClientPath(
      fingerprint.replace(/-(x86_64|arm64-v8a)$/, ''),
      'android',
    );
    caches.push(dirname(apk));
    await mkdir(dirname(apk), { recursive: true });
    await writeFile(apk, 'universal APK');
    expect(
      await developmentClient(fingerprint, 'android', fixture.root),
    ).toBeUndefined();
  },
);

it('requires a build when no APK exists for the fingerprint', async () => {
  expect(
    await developmentClient(
      `missing-${randomUUID()}-x86_64`,
      'android',
      fixture.root,
    ),
  ).toBeUndefined();
});

it.each([
  ['old-universal', 'current-x86_64'],
  ['current-arm64-v8a', 'current-x86_64'],
  ['current-x86_64', 'current-arm64-v8a'],
])(
  'refuses a local APK marked %s when %s is needed',
  async (built, requested) => {
    await writeFile(fixture.apk, 'APK');
    await writeFile(fixture.marker, built);
    expect(
      await developmentClient(requested, 'android', fixture.root),
    ).toBeUndefined();
  },
);

it.each([
  [false, false, false],
  [true, false, false],
  [false, true, false],
  [true, true, true],
])(
  'reuses a local APK with app=%s and matching marker=%s: %s',
  async (app, marker, reuse) => {
    const fingerprint = `local-${randomUUID()}-x86_64`;
    if (app) await writeFile(fixture.apk, 'APK');
    if (marker) await writeFile(fixture.marker, fingerprint);
    expect(await developmentClient(fingerprint, 'android', fixture.root)).toBe(
      reuse ? fixture.apk : undefined,
    );
  },
);

it.each([
  ['prebuild', 'exit', 'exit 7'],
  ['help', 'exit', 'exit 7'],
  ['app:assembleDebug', 'exit', 'exit 7'],
  ['app:assembleDebug', 'kill', 'SIGKILL'],
  ['changed-inputs', 'success', 'Native inputs changed'],
  ['none', 'success', undefined],
] as const)(
  'publishes only a complete build: failure at %s (%s)',
  async (failureAt, mode, error) => {
    const log = join(fixture.root, 'build.log');
    const calls = join(fixture.root, 'calls.jsonl');
    const script = `#!${process.execPath}
import { appendFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
if (args[0] === 'app:assembleDebug') {
  writeFileSync(${JSON.stringify(fixture.apk)}, 'new APK');
  if (${JSON.stringify(failureAt)} === 'changed-inputs') writeFileSync(${JSON.stringify(join(fixture.root, 'app.json'))}, JSON.stringify({ expo: { name: 'Changed native app', slug: 'changed', android: { package: 'com.example.changed' } } }));
}
if (args[0] === ${JSON.stringify(failureAt)}) {
  if (${JSON.stringify(mode)} === 'kill') process.kill(process.pid, 'SIGKILL');
  else process.exit(7);
}
`;
    await writeFile(join(fixture.root, 'node_modules/.bin/expo'), script, {
      mode: 0o700,
    });
    await writeFile(join(fixture.root, 'android/gradlew'), script, {
      mode: 0o700,
    });
    const fingerprint = await nativeFingerprint(fixture.root, 'android');
    const shared = sharedClientPath(fingerprint, 'android');
    caches.push(dirname(shared));
    await writeFile(fixture.apk, 'old APK');
    await writeFile(fixture.marker, fingerprint);
    if (error === undefined) {
      await buildDevelopmentClient(log, 'android', fixture.root);
      expect(await readFile(fixture.marker, 'utf8')).toBe(`${fingerprint}\n`);
      expect(await readFile(shared, 'utf8')).toBe('new APK');
      expect(await readFile(calls, 'utf8')).toContain(
        `-PreactNativeArchitectures=${androidDevelopmentAbi()}`,
      );
    } else {
      await expect(
        buildDevelopmentClient(log, 'android', fixture.root),
      ).rejects.toThrow(error);
      expect(existsSync(fixture.marker)).toBe(false);
      expect(existsSync(shared)).toBe(false);
      expect(await readFile(log, 'utf8')).toContain('$ ');
    }
  },
);

import { afterEach, beforeEach, expect, it } from 'vitest';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mobileRoot, nativeFingerprint } from './development-client.ts';

const require = createRequire(join(mobileRoot, 'package.json'));
let root: string;

async function file(path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-fingerprint-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function project(name: string) {
  const projectRoot = join(root, name);
  await file(
    join(projectRoot, 'package.json'),
    JSON.stringify({
      name: 'native-fixture',
      version: '1.0.0',
      dependencies: { 'fixture-native': '1.0.0' },
    }),
  );
  await file(
    join(projectRoot, 'app.json'),
    JSON.stringify({
      expo: { name: 'Native fixture', slug: 'native-fixture' },
    }),
  );
  const module = join(projectRoot, 'node_modules/fixture-native');
  await file(
    join(module, 'package.json'),
    JSON.stringify({ name: 'fixture-native', version: '1.0.0' }),
  );
  await file(
    join(module, 'expo-module.config.json'),
    JSON.stringify({
      platforms: ['android', 'apple'],
      android: { modules: ['com.example.NativeModule'] },
      apple: { modules: ['NativeModule'] },
    }),
  );
  await file(join(module, 'android/build.gradle'), 'plugins {}');
  await file(join(module, 'android/src/NativeModule.kt'), 'class NativeModule');
  await file(join(module, 'ios/NativeModule.swift'), 'class NativeModule {}');
  await file(join(module, 'NativeModule.podspec'), 'Pod::Spec.new {}');
  await symlink(
    dirname(require.resolve('expo/package.json')),
    join(projectRoot, 'node_modules/expo'),
  );
  await cp(
    join(mobileRoot, '.fingerprintignore'),
    join(projectRoot, '.fingerprintignore'),
  );
  return projectRoot;
}

it.each(['android', 'ios'] as const)(
  'keeps %s clean and built copies compatible',
  async (platform) => {
    const clean = await project('clean');
    const built = join(root, 'built');
    await cp(clean, built, { recursive: true, verbatimSymlinks: true });
    const expected = await nativeFingerprint(clean, platform);
    expect(await nativeFingerprint(built, platform)).toBe(expected);
    for (const [path, contents] of [
      ['android/app/build.gradle', 'plugins {}'],
      ['android/app/src/main/AndroidManifest.xml', '<manifest />'],
      ['android/app/build/outputs/apk/debug/app-debug.apk', 'APK'],
      ['ios/NativeFixture.xcodeproj/project.pbxproj', 'generated project'],
      ['ios/Podfile', 'generated Podfile'],
      ['ios/build/Build/Products/Debug/NativeFixture.app', 'app'],
      [
        'node_modules/fixture-native/android/build/intermediates/classes.jar',
        'classes',
      ],
      ['node_modules/fixture-native/android/.gradle/cache.bin', 'cache'],
      ['node_modules/fixture-native/android/.cxx/Debug/build.ninja', 'ninja'],
      [
        'node_modules/fixture-native/ios/build/Products/NativeModule.a',
        'archive',
      ],
    ] as const)
      await file(join(built, path), contents);
    expect(await nativeFingerprint(built, platform)).toBe(expected);
  },
);

it.each([
  ['android', 'android/src/NativeModule.kt', 'class ChangedNativeModule'],
  ['ios', 'ios/NativeModule.swift', 'class ChangedNativeModule {}'],
] as const)(
  'invalidates %s clients after a native module edit',
  async (platform, path, contents) => {
    const projectRoot = await project('native');
    const before = await nativeFingerprint(projectRoot, platform);
    await file(
      join(projectRoot, 'node_modules/fixture-native', path),
      contents,
    );
    expect(await nativeFingerprint(projectRoot, platform)).not.toBe(before);
  },
);

it.each(['android', 'ios'] as const)(
  'invalidates %s clients after a fonts plugin change',
  async (platform) => {
    const projectRoot = await project('fonts');
    await symlink(
      dirname(require.resolve('expo-font/package.json')),
      join(projectRoot, 'node_modules/expo-font'),
    );
    const config = (fonts: string[]) =>
      JSON.stringify({
        expo: {
          name: 'Native fixture',
          slug: 'native-fixture',
          plugins: [['expo-font', { fonts }]],
        },
      });
    await file(join(projectRoot, 'app.json'), config([]));
    const before = await nativeFingerprint(projectRoot, platform);
    await file(join(projectRoot, 'app.json'), config(['assets/Native.ttf']));
    expect(await nativeFingerprint(projectRoot, platform)).not.toBe(before);
  },
);

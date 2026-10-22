import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { androidBuildMemoryShortage, memoryShortage } from './cli.ts';

function meminfo(availableKiB: number): string {
  return `MemTotal:       27262976 kB\nMemFree:          524288 kB\nMemAvailable:   ${availableKiB} kB\nSwapTotal:       8388608 kB\n`;
}

it('refuses a start when less than 4 GiB of memory is available', () => {
  expect(memoryShortage(meminfo(3 * 1024 ** 2))).toBe(
    'only 3.0 GiB of memory is available and a disposable instance needs 4 GiB free, because starting instances under memory pressure has crashed this machine; stop an instance you own or wait for other runs to finish',
  );
});

it('allows a start with 4 GiB or more available', () => {
  expect(memoryShortage(meminfo(4 * 1024 ** 2))).toBeUndefined();
  expect(memoryShortage(meminfo(18 * 1024 ** 2))).toBeUndefined();
});

it('does not refuse where available memory cannot be read', () => {
  expect(memoryShortage(undefined)).toBeUndefined();
  expect(memoryShortage('MemTotal: 1024 kB\n')).toBeUndefined();
});

it.each([
  [0, false],
  [7, false],
  [8 - 1 / 1024 ** 2, false],
  [8, true],
  [12, true],
  [26, true],
])(
  'allows the Android build with %s GiB available: %s',
  (available, allowed) => {
    const problem = androidBuildMemoryShortage(meminfo(available * 1024 ** 2));
    if (allowed) expect(problem).toBeUndefined();
    else
      expect(problem).toBe(
        `Only ${available.toFixed(1)} GiB of memory is available; the Android development build needs 8 GiB free for Gradle and bounded native compilers plus headroom. Builds under memory pressure have been killed by the kernel; stop a process you own or wait for other runs to finish.`,
      );
  },
);

it.each([
  undefined,
  '',
  'MemTotal: 1024 kB\n',
  'MemAvailable: invalid kB\n',
  'MemAvailable: -1 kB\n',
])('refuses an Android build with unreadable available memory %j', (input) => {
  expect(androidBuildMemoryShortage(input)).toBe(
    'Cannot read MemAvailable from /proc/meminfo; refusing the Android development build because its available-memory budget cannot be checked.',
  );
});

it('checks Linux Android build memory before native tools and retains other hosts tool checks', () => {
  const preload = `
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const read = fs.readFileSync;
fs.readFileSync = (path, ...args) => path === '/proc/meminfo' ? 'MemAvailable: 0 kB\\n' : read(path, ...args);
syncBuiltinESMExports();
`;
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      `data:text/javascript,${encodeURIComponent(preload)}`,
      fileURLToPath(
        new URL('../mobile-verify/scripts/cli.ts', import.meta.url),
      ),
      'build',
      '--device',
      'android',
    ],
    {
      encoding: 'utf8',
      timeout: 15_000,
      env: { ...process.env, PATH: dirname(process.execPath) },
    },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    process.platform === 'linux'
      ? 'Only 0.0 GiB of memory is available; the Android development build needs 8 GiB free'
      : 'Android SDK platform-tools are missing',
  );
  if (process.platform === 'linux')
    expect(result.stderr).not.toContain(
      'Android SDK platform-tools are missing',
    );
});

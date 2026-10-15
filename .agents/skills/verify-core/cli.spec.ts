import { expect, it } from 'vitest';
import { memoryShortage } from './cli.ts';

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

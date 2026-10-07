import { expect } from 'vitest';
import { cliHelpAndErrors, stopCliProcess } from '../kit/cli-process.ts';
import { test } from '../kit/server-test.ts';

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  test(`the native CLI drains the application and scoped cleanup before ${signal} exits`, async () => {
    expect(await stopCliProcess(signal)).toEqual({
      signal,
      health: 200,
      signaled: true,
      exit: { code: 130, signal: null },
      marker: 'drained',
      locked: false,
      socket: false,
      stopped: true,
      stderr: '',
    });
  });

test('CLI help and invalid arguments keep their output and exit results', async () => {
  const observed = await cliHelpAndErrors();
  expect({
    help: observed.help,
    invalidFlag: observed.invalidFlag,
    invalidPort: observed.invalidPort,
  }).toEqual({ help: 0, invalidFlag: 1, invalidPort: 1 });
  expect(observed.output).toContain('Porcelain');
  expect(observed.errors).toContain('Invalid');
});

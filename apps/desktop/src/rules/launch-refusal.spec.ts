import { describe, expect, it } from 'vitest';
import { launchRefusal } from './launch-refusal.ts';

const plain = {
  packaged: true,
  arguments: ['--data-directory', '/tmp/profile'],
  environment: { HOME: '/Users/owner' },
};

describe('launchRefusal', () => {
  it('starts the installed app launched without debugging switches or Node variables', () => {
    expect(launchRefusal(plain)).toBeUndefined();
  });

  it.each([
    '--inspect',
    '--inspect=0',
    '--inspect-brk=9229',
    '--inspect-port=0',
    '--inspect-wait',
    '--remote-debugging-port=0',
    '--remote-debugging-pipe',
    '--remote-debugging-address=0.0.0.0',
    '-remote-debugging-port=9222',
    '--REMOTE-DEBUGGING-PORT=9222',
    '--debug',
    '--debug-brk=5858',
  ])('refuses the installed app launched with %s', (debugging) => {
    expect(
      launchRefusal({ ...plain, arguments: [...plain.arguments, debugging] }),
    ).toMatch(/^Porcelain refuses to start with the debugging switch /);
  });

  it('names the switch without its value', () => {
    expect(
      launchRefusal({ ...plain, arguments: ['--remote-debugging-port=9222'] }),
    ).toBe(
      'Porcelain refuses to start with the debugging switch --remote-debugging-port: the app keeps credentials a debugger could read.',
    );
  });

  it('refuses a debugging switch placed after an argument terminator', () => {
    expect(
      launchRefusal({ ...plain, arguments: ['--', '--inspect=0'] }),
    ).toMatch(/^Porcelain refuses to start/);
  });

  it.each([
    ['ELECTRON_RUN_AS_NODE', '1'],
    ['NODE_OPTIONS', '--inspect=0'],
    ['NODE_OPTIONS', '--require /tmp/payload.js'],
  ])('refuses the installed app launched with %s=%s', (name, value) => {
    expect(launchRefusal({ ...plain, environment: { [name]: value } })).toBe(
      `Porcelain refuses to start with ${name} set: the app never runs as Node or takes Node options.`,
    );
  });

  it('treats empty Node variables as unset', () => {
    expect(
      launchRefusal({
        ...plain,
        environment: { ELECTRON_RUN_AS_NODE: '', NODE_OPTIONS: ' ' },
      }),
    ).toBeUndefined();
  });

  it.each([
    '/Users/owner/inspector',
    '--project-home=/Users/owner/debug',
    '--inspector',
    '--debugger',
    'remote-debugging-port=1',
  ])(
    'starts with an argument that only resembles a debugging switch: %s',
    (argument) => {
      expect(
        launchRefusal({ ...plain, arguments: [argument] }),
      ).toBeUndefined();
    },
  );

  it('lets the unpackaged app start with the debugging switches Playwright drives it through', () => {
    expect(
      launchRefusal({
        packaged: false,
        arguments: ['--inspect=0', '--remote-debugging-port=0'],
        environment: { NODE_OPTIONS: '--inspect' },
      }),
    ).toBeUndefined();
  });
});

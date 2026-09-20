import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parseCliArguments, ServeConfigurationError } from './arguments.ts';

it('parses the installed command and keeps all state paths absolute', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-cli-arguments-'));
  try {
    expect(
      parseCliArguments(
        [
          'serve',
          '--lan',
          '--port=4321',
          '--data-directory',
          join(root, 'state'),
          '--token-file',
          join(root, 'credentials', 'token'),
        ],
        {},
        root,
        join(root, 'web'),
      ),
    ).toEqual({
      command: 'serve',
      settings: {
        dataDirectory: join(root, 'state'),
        projectHome: root,
        tokenFile: join(root, 'credentials', 'token'),
        host: '0.0.0.0',
        port: 4321,
        webRoot: join(root, 'web'),
        allowedHosts: [],
      },
    });
    expect(parseCliArguments(['--help'], {}, root, join(root, 'web'))).toEqual({
      command: 'help',
    });
    expect(
      parseCliArguments(
        ['serve'],
        { PORCELAIN_PORT: '4123' },
        root,
        join(root, 'web'),
      ),
    ).toMatchObject({ settings: { host: '127.0.0.1', port: 4123 } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('resolves status against the data directory without needing a token', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-cli-status-'));
  try {
    expect(parseCliArguments(['status'], {}, root)).toEqual({
      command: 'status',
      settings: { dataDirectory: join(root, '.porcelain') },
    });
    expect(
      parseCliArguments(
        ['status', '--data-directory', join(root, 'state')],
        {},
        root,
      ),
    ).toEqual({
      command: 'status',
      settings: { dataDirectory: join(root, 'state') },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('collects only host names given explicitly on the command line', () => {
  const home = '/fixture/home';
  expect(
    parseCliArguments(
      ['serve', '--host', 'porcelain.tail1234.ts.net'],
      {},
      home,
    ),
  ).toMatchObject({
    settings: { allowedHosts: ['porcelain.tail1234.ts.net'] },
  });
  // A wildcard bind address is not a name a browser can send in `Host`.
  expect(parseCliArguments(['serve', '--lan'], {}, home)).toMatchObject({
    settings: { allowedHosts: [] },
  });
  expect(
    parseCliArguments(
      [
        'serve',
        '--lan',
        '--allow-host',
        'desk.local',
        '--allow-host=porcelain.tail1234.ts.net',
      ],
      {},
      home,
    ),
  ).toMatchObject({
    settings: {
      host: '0.0.0.0',
      allowedHosts: ['desk.local', 'porcelain.tail1234.ts.net'],
    },
  });
});

it('rejects conflicting or unknown installed command arguments', () => {
  const home = '/fixture/home';
  expect(() =>
    parseCliArguments(['serve', '--lan', '--host', '127.0.0.1'], {}, home),
  ).toThrow(ServeConfigurationError);
  expect(() => parseCliArguments(['serve', '--unknown'], {}, home)).toThrow(
    'Unknown option',
  );
  expect(() => parseCliArguments(['inspect'], {}, home)).toThrow(
    'Unknown command',
  );
  expect(() =>
    parseCliArguments(['serve', '--allow-host', 'not a host'], {}, home),
  ).toThrow('--allow-host');
});

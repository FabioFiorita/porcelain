import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parseServeSettings, ServeConfigurationError } from './arguments.ts';

it('parses the installed command and keeps all state paths absolute', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-cli-arguments-'));
  try {
    expect(
      parseServeSettings(
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
      dataDirectory: join(root, 'state'),
      tokenFile: join(root, 'credentials', 'token'),
      host: '0.0.0.0',
      port: 4321,
      webRoot: join(root, 'web'),
    });
    expect(parseServeSettings(['--help'], {}, root, join(root, 'web'))).toEqual(
      {
        help: true,
      },
    );
    expect(
      parseServeSettings(
        ['serve'],
        { PORCELAIN_PORT: '4123' },
        root,
        join(root, 'web'),
      ),
    ).toMatchObject({ host: '127.0.0.1', port: 4123 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects conflicting or unknown installed command arguments', () => {
  expect(() =>
    parseServeSettings(['serve', '--lan', '--host', '127.0.0.1']),
  ).toThrow(ServeConfigurationError);
  expect(() => parseServeSettings(['serve', '--unknown'])).toThrow(
    'Unknown option',
  );
  expect(() => parseServeSettings(['inspect'])).toThrow('Unknown command');
});

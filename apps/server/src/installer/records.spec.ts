import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readServiceConfiguration } from './records.ts';

let folder: string;
let path: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'porcelain-service-configuration-'));
  path = join(folder, 'configuration.json');
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('readServiceConfiguration', () => {
  it('reads the data directory and port the service was installed with', async () => {
    writeFileSync(
      path,
      JSON.stringify({ dataDirectory: '/home/u/.porcelain', port: 4738 }),
    );
    expect(await readServiceConfiguration(path)).toEqual({
      dataDirectory: '/home/u/.porcelain',
      port: 4738,
    });
  });

  it('reads a configuration saved when the service listened on a network host, leaving the host behind so the service listens on this computer only', async () => {
    writeFileSync(
      path,
      JSON.stringify({
        dataDirectory: '/home/u/.porcelain',
        host: '192.168.15.64',
        port: 4738,
        allowedHosts: ['192.168.15.64'],
      }),
    );
    expect(await readServiceConfiguration(path)).toEqual({
      dataDirectory: '/home/u/.porcelain',
      port: 4738,
    });
  });

  it('refuses a configuration without a port', async () => {
    writeFileSync(
      path,
      JSON.stringify({ dataDirectory: '/home/u/.porcelain' }),
    );
    await expect(readServiceConfiguration(path)).rejects.toThrow(
      'The saved service configuration is invalid.',
    );
  });
});

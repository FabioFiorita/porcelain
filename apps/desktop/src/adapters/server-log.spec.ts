import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServerLog } from './server-log.ts';

describe('ServerLog', () => {
  let directory = '';
  beforeEach(async () => {
    directory = join(
      await mkdtemp(join(tmpdir(), 'porcelain-server-log-')),
      'logs',
    );
  });
  afterEach(async () => {
    await rm(join(directory, '..'), { recursive: true, force: true });
  });

  it('keeps what the server writes, in order, in a log folder it creates', async () => {
    const log = new ServerLog(directory, 64);
    log.append(Buffer.from('listening\n'));
    log.append(Buffer.from('ready\n'));
    await log.flush();
    expect(await readFile(join(directory, 'server.log'), 'utf8')).toBe(
      'listening\nready\n',
    );
  });

  it('moves a full log aside and starts a new one, so the folder never holds more than twice the limit', async () => {
    const log = new ServerLog(directory, 10);
    log.append(Buffer.from('aaaaaaaa\n'));
    log.append(Buffer.from('bbbbbbbb\n'));
    log.append(Buffer.from('cccccccc\n'));
    await log.flush();
    expect(await readdir(directory)).toEqual(['server.log', 'server.log.1']);
    expect([
      await readFile(join(directory, 'server.log.1'), 'utf8'),
      await readFile(join(directory, 'server.log'), 'utf8'),
    ]).toEqual(['bbbbbbbb\n', 'cccccccc\n']);
  });

  it('keeps only the end of a single write larger than the limit', async () => {
    const log = new ServerLog(directory, 4);
    log.append(Buffer.from('0123456789'));
    await log.flush();
    expect(await readFile(join(directory, 'server.log'), 'utf8')).toBe('6789');
  });

  it('continues the log a previous launch left and counts it toward the limit', async () => {
    const earlier = new ServerLog(directory, 10);
    earlier.append(Buffer.from('before\n'));
    await earlier.flush();
    const log = new ServerLog(directory, 10);
    log.append(Buffer.from('after\n'));
    await log.flush();
    expect([
      await readFile(join(directory, 'server.log.1'), 'utf8'),
      await readFile(join(directory, 'server.log'), 'utf8'),
    ]).toEqual(['before\n', 'after\n']);
  });

  it('keeps writing after one write fails', async () => {
    await writeFile(directory, 'a file where the log folder belongs');
    const log = new ServerLog(directory, 64);
    log.append(Buffer.from('lost\n'));
    await log.flush();
    await rm(directory);
    log.append(Buffer.from('kept\n'));
    await log.flush();
    expect(await readFile(join(directory, 'server.log'), 'utf8')).toBe(
      'kept\n',
    );
  });
});

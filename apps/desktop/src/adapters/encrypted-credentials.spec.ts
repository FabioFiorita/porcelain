import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EncryptedCredentials } from './encrypted-credentials.ts';

describe('EncryptedCredentials', () => {
  let profile = '';
  const encryptedValues = new Map<string, string>();
  const encryption = {
    available: () => Promise.resolve(true),
    encrypt: (value: string) => {
      const encrypted = Buffer.from(`encrypted:${encryptedValues.size}`);
      encryptedValues.set(encrypted.toString('hex'), value);
      return Promise.resolve(encrypted);
    },
    decrypt: (value: Buffer) => {
      const decrypted = encryptedValues.get(value.toString('hex'));
      return decrypted === undefined
        ? Promise.reject(new Error('Invalid ciphertext'))
        : Promise.resolve(decrypted);
    },
  };
  beforeEach(async () => {
    profile = await mkdtemp(join(tmpdir(), 'porcelain-encrypted-credentials-'));
  });
  afterEach(async () => {
    await rm(profile, { recursive: true, force: true });
  });

  it('returns null before any credential value is stored', async () => {
    const credentials = new EncryptedCredentials(profile, encryption);
    expect(await credentials.read()).toBeNull();
  });
  it('stores one opaque string encrypted and restores it through a new instance', async () => {
    const value = '[{"name":"Mac 💻","credential":"test-only-bearer"}]';
    await new EncryptedCredentials(profile, encryption).write(value);
    expect(await new EncryptedCredentials(profile, encryption).read()).toBe(
      value,
    );
    expect(
      (await readFile(join(profile, 'credentials.enc'))).includes(
        Buffer.from('test-only-bearer'),
      ),
    ).toBe(false);
    expect((await stat(join(profile, 'credentials.enc'))).mode & 0o777).toBe(
      0o600,
    );
    expect(await readdir(profile)).toEqual(['credentials.enc']);
  });
  it('keeps an empty string distinct from no stored value', async () => {
    const credentials = new EncryptedCredentials(profile, encryption);
    await credentials.write('');
    expect(await credentials.read()).toBe('');
  });
  it('rejects unavailable encryption without creating a file', async () => {
    const credentials = new EncryptedCredentials(profile, {
      ...encryption,
      available: () => Promise.resolve(false),
    });
    await expect(credentials.write('test-only-secret')).rejects.toThrow(
      'unavailable',
    );
    expect(await readdir(profile)).toEqual([]);
  });
  it('preserves the previous ciphertext when encryption fails and accepts a later write', async () => {
    let failing = false;
    const credentials = new EncryptedCredentials(profile, {
      ...encryption,
      encrypt: (value) =>
        failing
          ? Promise.reject(new Error('Encryption failed'))
          : encryption.encrypt(value),
    });
    await credentials.write('first');
    const first = await readFile(join(profile, 'credentials.enc'));
    failing = true;
    await expect(credentials.write('second')).rejects.toThrow(
      'Encryption failed',
    );
    expect(await readFile(join(profile, 'credentials.enc'))).toEqual(first);
    failing = false;
    await credentials.write('third');
    expect(await credentials.read()).toBe('third');
  });
  it('serializes writes, reads and clear in the order they are requested', async () => {
    const credentials = new EncryptedCredentials(profile, encryption);
    const first = credentials.write('first');
    const second = credentials.write('second');
    const read = credentials.read();
    const clear = credentials.clear();
    await Promise.all([first, second, clear]);
    expect(await read).toBe('second');
    expect(await credentials.read()).toBeNull();
    expect(await readdir(profile)).toEqual([]);
  });
  it('rejects unreadable ciphertext without silently discarding it', async () => {
    await writeFile(join(profile, 'credentials.enc'), 'damaged');
    await expect(
      new EncryptedCredentials(profile, encryption).read(),
    ).rejects.toThrow();
    expect(await readFile(join(profile, 'credentials.enc'), 'utf8')).toBe(
      'damaged',
    );
  });
  it('clears saved credentials even when encryption is unavailable', async () => {
    await new EncryptedCredentials(profile, encryption).write(
      'test-only-secret',
    );
    const credentials = new EncryptedCredentials(profile, {
      ...encryption,
      available: () => Promise.resolve(false),
    });
    await expect(credentials.read()).rejects.toThrow('unavailable');
    await credentials.clear();
    await credentials.clear();
    expect(await credentials.read()).toBeNull();
  });
});

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
  const staleKeys = new Set<string>();
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
        : Promise.resolve({
            value: decrypted,
            reEncrypt: staleKeys.has(value.toString('hex')),
          });
    },
  };
  beforeEach(async () => {
    profile = await mkdtemp(join(tmpdir(), 'porcelain-encrypted-credentials-'));
  });
  afterEach(async () => {
    await rm(profile, { recursive: true, force: true });
  });

  const saved = (value: string) => ({ status: 'saved', value });

  it('reports nothing saved before any credential value is stored', async () => {
    const credentials = new EncryptedCredentials(profile, encryption);
    expect(await credentials.read()).toEqual({ status: 'empty' });
  });
  it('stores one opaque string encrypted and restores it through a new instance', async () => {
    const value = '[{"name":"Mac 💻","credential":"test-only-bearer"}]';
    await new EncryptedCredentials(profile, encryption).write(value);
    expect(await new EncryptedCredentials(profile, encryption).read()).toEqual(
      saved(value),
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
    expect(await credentials.read()).toEqual(saved(''));
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
    expect(await credentials.read()).toEqual(saved('third'));
  });
  it('serializes writes, reads and clear in the order they are requested', async () => {
    const credentials = new EncryptedCredentials(profile, encryption);
    const first = credentials.write('first');
    const second = credentials.write('second');
    const read = credentials.read();
    const clear = credentials.clear();
    await Promise.all([first, second, clear]);
    expect(await read).toEqual(saved('second'));
    expect(await credentials.read()).toEqual({ status: 'empty' });
    expect(await readdir(profile)).toEqual([]);
  });
  it('reports ciphertext it cannot decrypt as unreadable, saying why, and keeps it', async () => {
    await writeFile(join(profile, 'credentials.enc'), 'damaged');
    expect(await new EncryptedCredentials(profile, encryption).read()).toEqual({
      status: 'unreadable',
      message: 'The saved credentials could not be read: Invalid ciphertext',
    });
    expect(await readFile(join(profile, 'credentials.enc'), 'utf8')).toBe(
      'damaged',
    );
  });
  it('refuses to write over credentials it cannot read, as when the Keychain is denied', async () => {
    await writeFile(join(profile, 'credentials.enc'), 'damaged');
    const credentials = new EncryptedCredentials(profile, encryption);
    await expect(credentials.write('[]')).rejects.toThrow(
      'could not be read, so they are kept unchanged',
    );
    expect(await readFile(join(profile, 'credentials.enc'), 'utf8')).toBe(
      'damaged',
    );
  });
  it('accepts a write again once the unreadable credentials are cleared', async () => {
    await writeFile(join(profile, 'credentials.enc'), 'damaged');
    const credentials = new EncryptedCredentials(profile, encryption);
    await credentials.clear();
    await credentials.write('fresh');
    expect(await credentials.read()).toEqual(saved('fresh'));
  });
  it('replaces the ciphertext with a fresh one when decryption asks for it', async () => {
    const credentials = new EncryptedCredentials(profile, encryption);
    await credentials.write('stale key');
    const stale = await readFile(join(profile, 'credentials.enc'));
    staleKeys.add(stale.toString('hex'));
    expect(await credentials.read()).toEqual(saved('stale key'));
    const fresh = await readFile(join(profile, 'credentials.enc'));
    expect(fresh.equals(stale)).toBe(false);
    expect(await credentials.read()).toEqual(saved('stale key'));
  });
  it('still returns the value when its re-encryption fails, keeping the old ciphertext', async () => {
    await new EncryptedCredentials(profile, encryption).write('stale key');
    const stale = await readFile(join(profile, 'credentials.enc'));
    staleKeys.add(stale.toString('hex'));
    const credentials = new EncryptedCredentials(profile, {
      ...encryption,
      encrypt: () => Promise.reject(new Error('Encryption failed')),
    });
    expect(await credentials.read()).toEqual(saved('stale key'));
    expect(await readFile(join(profile, 'credentials.enc'))).toEqual(stale);
  });
  it('clears saved credentials even when encryption is unavailable', async () => {
    await new EncryptedCredentials(profile, encryption).write(
      'test-only-secret',
    );
    const credentials = new EncryptedCredentials(profile, {
      ...encryption,
      available: () => Promise.resolve(false),
    });
    expect(await credentials.read()).toEqual({
      status: 'unreadable',
      message: 'Encrypted credential storage is unavailable',
    });
    await credentials.clear();
    await credentials.clear();
    expect(await credentials.read()).toEqual({ status: 'empty' });
  });
});

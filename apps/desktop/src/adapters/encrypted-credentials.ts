import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DesktopCredentials } from '@porcelain/contracts/desktop';

type Encryption = {
  available: () => Promise<boolean>;
  encrypt: (value: string) => Promise<Buffer>;
  decrypt: (value: Buffer) => Promise<{ value: string; reEncrypt: boolean }>;
};

function failure(error: unknown): string {
  return `The saved credentials could not be read: ${error instanceof Error ? error.message : 'unknown failure'}`;
}

export class EncryptedCredentials {
  private readonly profile: string;
  private readonly encryption: Encryption;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(profile: string, encryption: Encryption) {
    this.profile = profile;
    this.encryption = encryption;
  }

  read(): Promise<DesktopCredentials> {
    return this.run(async () => {
      const saved = await this.saved();
      if (saved.status !== 'saved') return saved;
      if (saved.reEncrypt) await this.store(saved.value).catch(() => undefined);
      return { status: 'saved', value: saved.value };
    });
  }

  write(value: string): Promise<void> {
    return this.run(async () => {
      if (!(await this.encryption.available()))
        throw new Error('Encrypted credential storage is unavailable');
      if ((await this.saved()).status === 'unreadable')
        throw new Error(
          'The saved credentials could not be read, so they are kept unchanged',
        );
      await this.store(value);
    });
  }

  clear(): Promise<void> {
    return this.run(() =>
      rm(join(this.profile, 'credentials.enc'), { force: true }),
    );
  }

  private async saved(): Promise<
    | Exclude<DesktopCredentials, { status: 'saved' }>
    | { status: 'saved'; value: string; reEncrypt: boolean }
  > {
    let encrypted: Buffer;
    try {
      encrypted = await readFile(join(this.profile, 'credentials.enc'));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return { status: 'empty' };
      return { status: 'unreadable', message: failure(error) };
    }
    if (!(await this.encryption.available()))
      return {
        status: 'unreadable',
        message: 'Encrypted credential storage is unavailable',
      };
    try {
      const decrypted = await this.encryption.decrypt(encrypted);
      return {
        status: 'saved',
        value: decrypted.value,
        reEncrypt: decrypted.reEncrypt,
      };
    } catch (error) {
      return { status: 'unreadable', message: failure(error) };
    }
  }

  private async store(value: string): Promise<void> {
    const encrypted = await this.encryption.encrypt(value);
    await mkdir(this.profile, { recursive: true, mode: 0o700 });
    const destination = join(this.profile, 'credentials.enc');
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, encrypted, { flag: 'wx', mode: 0o600 });
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

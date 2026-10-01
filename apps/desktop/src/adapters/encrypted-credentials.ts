import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Encryption = {
  available: () => Promise<boolean>;
  encrypt: (value: string) => Promise<Buffer>;
  decrypt: (value: Buffer) => Promise<{ value: string; reEncrypt: boolean }>;
};

export class EncryptedCredentials {
  private readonly profile: string;
  private readonly encryption: Encryption;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(profile: string, encryption: Encryption) {
    this.profile = profile;
    this.encryption = encryption;
  }

  read(): Promise<string | null> {
    return this.run(async () => {
      let encrypted: Buffer;
      try {
        encrypted = await readFile(join(this.profile, 'credentials.enc'));
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          return null;
        throw error;
      }
      if (!(await this.encryption.available()))
        throw new Error('Encrypted credential storage is unavailable');
      const decrypted = await this.encryption.decrypt(encrypted);
      if (decrypted.reEncrypt)
        await this.store(decrypted.value).catch(() => undefined);
      return decrypted.value;
    });
  }

  write(value: string): Promise<void> {
    return this.run(async () => {
      if (!(await this.encryption.available()))
        throw new Error('Encrypted credential storage is unavailable');
      await this.store(value);
    });
  }

  clear(): Promise<void> {
    return this.run(() =>
      rm(join(this.profile, 'credentials.enc'), { force: true }),
    );
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

import { randomBytes } from 'node:crypto';
import type { SecretSource } from '@porcelain/access/ports';

export type RandomSecretSourceOptions = { secretBytes: number };

export class RandomSecretSource implements SecretSource {
  private readonly options: RandomSecretSourceOptions;

  constructor(options: RandomSecretSourceOptions) {
    this.options = options;
  }

  next(): string {
    return randomBytes(this.options.secretBytes).toString('base64url');
  }
}

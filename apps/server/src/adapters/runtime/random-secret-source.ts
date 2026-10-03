import { randomBytes } from 'node:crypto';
import type { Base64UrlSecret } from '@porcelain/kernel/models';
import type { SecretSource } from '@porcelain/kernel/ports';

type RandomSecretSourceOptions = { secretBytes: number };

export class RandomSecretSource implements SecretSource {
  private readonly options: RandomSecretSourceOptions;

  constructor(options: RandomSecretSourceOptions) {
    this.options = options;
  }

  next(): Base64UrlSecret {
    return randomBytes(this.options.secretBytes).toString('base64url');
  }
}

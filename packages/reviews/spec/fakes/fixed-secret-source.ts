import type { SecretSource } from '../../src/ports/secret-source.ts';

export class FixedSecretSource implements SecretSource {
  next(): string {
    return 'secret';
  }
}

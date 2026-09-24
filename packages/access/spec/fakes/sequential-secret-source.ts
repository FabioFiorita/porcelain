import type { SecretSource } from '../../src/ports/secret-source.ts';

export class SequentialSecretSource implements SecretSource {
  private issued = 0;

  next(): string {
    this.issued += 1;
    return String(this.issued).padStart(43, 's');
  }
}

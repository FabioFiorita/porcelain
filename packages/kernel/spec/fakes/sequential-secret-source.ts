import type { Base64UrlSecret } from '../../src/models/secret.ts';
import type { SecretSource } from '../../src/ports/secret-source.ts';

const sequentialSecrets = Array.from({ length: 1000 }, (_, index) =>
  String(index + 1).padStart(43, 's'),
);

export class SequentialSecretSource implements SecretSource {
  private readonly secrets: Iterator<Base64UrlSecret, undefined>;

  constructor(secrets: readonly Base64UrlSecret[] = sequentialSecrets) {
    this.secrets = secrets.values();
  }

  next(): Base64UrlSecret {
    return this.secrets.next().value ?? '';
  }
}

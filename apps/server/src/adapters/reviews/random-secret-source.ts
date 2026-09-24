import { randomBytes } from 'node:crypto';
import type { SecretSource } from '@porcelain/reviews/ports';

const SECRET_BYTES = 32;

export class RandomSecretSource implements SecretSource {
  next(): string {
    return randomBytes(SECRET_BYTES).toString('hex');
  }
}

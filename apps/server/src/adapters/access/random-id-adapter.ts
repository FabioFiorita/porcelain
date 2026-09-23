import { randomUUID } from 'node:crypto';
import type { IdSource } from '@porcelain/access/ports';

export class RandomIdAdapter implements IdSource {
  next(): string {
    return randomUUID();
  }
}

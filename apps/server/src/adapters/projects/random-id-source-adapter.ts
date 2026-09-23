import { randomUUID } from 'node:crypto';
import type { IdSource } from '@porcelain/projects/ports';

export class RandomIdSourceAdapter implements IdSource {
  next(): string {
    return randomUUID();
  }
}

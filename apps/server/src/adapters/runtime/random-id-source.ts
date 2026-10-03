import { randomUUID } from 'node:crypto';
import type { IdSource } from '@porcelain/kernel/ports';

export class RandomIdSource implements IdSource {
  next(): string {
    return randomUUID();
  }
}

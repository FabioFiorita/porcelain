import type { IdSource } from '../../src/ports/id-source.ts';

const sequentialIds = Array.from(
  { length: 1000 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);

export class SequentialIdSource implements IdSource {
  private readonly ids: Iterator<string, undefined>;

  constructor(ids: readonly string[] = sequentialIds) {
    this.ids = ids.values();
  }

  next(): string {
    return this.ids.next().value ?? '';
  }
}

import { assembleChanges } from '../models/assemble-changes.ts';
import { logicalPath } from '../models/fingerprint-change.ts';
import type { ChangeInspectionReader } from '../ports/change-inspection-reader.ts';

export class ReadChangeFingerprintsService {
  private readonly reader: ChangeInspectionReader;

  constructor(reader: ChangeInspectionReader) {
    this.reader = reader;
  }

  async execute(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<Map<string, string>> {
    signal?.throwIfAborted();
    const { status: observed } = await this.reader.readStatus(signal);
    const wanted = new Set(paths);
    const selected = observed.changes.filter((change) =>
      wanted.has(logicalPath(change)),
    );
    const { sides } = await this.reader.observeSides(selected, signal);
    const changes = assembleChanges(selected, sides);
    await this.reader.confirmReachable(worktreeId, signal);
    return new Map(
      changes.flatMap(({ path, fingerprint }) =>
        fingerprint ? [[path, fingerprint] as const] : [],
      ),
    );
  }
}

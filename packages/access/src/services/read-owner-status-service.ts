import type {
  ReadOwnerStatusInput,
  RuntimeStatus,
} from '../models/runtime-status.ts';
import type { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';

export class ReadOwnerStatusService {
  private readonly runtimeStatusReader: RuntimeStatusReader;

  constructor(runtimeStatusReader: RuntimeStatusReader) {
    this.runtimeStatusReader = runtimeStatusReader;
  }

  execute(input: ReadOwnerStatusInput): RuntimeStatus {
    void input;
    return this.runtimeStatusReader.current();
  }
}

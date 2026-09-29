import type { TailnetReport } from '../../src/models/remote-access.ts';
import type { TailnetStatusReader } from '../../src/ports/tailnet-status-reader.ts';

export class FixedTailnetStatusReader implements TailnetStatusReader {
  private readonly report: TailnetReport;

  constructor(report: TailnetReport) {
    this.report = report;
  }

  async read(): Promise<TailnetReport> {
    return this.report;
  }
}

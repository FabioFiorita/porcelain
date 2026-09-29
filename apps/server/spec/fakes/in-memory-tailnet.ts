import type {
  TailnetReport,
  TailnetServeOutcome,
  TailnetServeTarget,
  TailnetServing,
} from '@porcelain/access/models';
import type {
  TailnetServeRunner,
  TailnetStatusReader,
} from '@porcelain/access/ports';

export class InMemoryTailnet
  implements TailnetStatusReader, TailnetServeRunner
{
  private readonly dnsName: string;
  private serving: TailnetServing = { kind: 'nothing' };

  constructor(dnsName: string) {
    this.dnsName = dnsName;
  }

  async read(): Promise<TailnetReport> {
    return {
      kind: 'status',
      running: true,
      https: true,
      dnsName: this.dnsName,
      serving: this.serving,
    };
  }

  async serve(input: TailnetServeTarget): Promise<TailnetServeOutcome> {
    this.serving = { kind: 'proxy', target: input.target };
    return { kind: 'done' };
  }

  async stop(): Promise<TailnetServeOutcome> {
    this.serving = { kind: 'nothing' };
    return { kind: 'done' };
  }
}

import type {
  TailnetReport,
  TailnetServeOutcome,
  TailnetServeTarget,
  TailnetServing,
} from '../../src/models/remote-access.ts';
import type { TailnetServeRunner } from '../../src/ports/tailnet-serve-runner.ts';
import type { TailnetStatusReader } from '../../src/ports/tailnet-status-reader.ts';

type Node = { running: boolean; https: boolean; dnsName: string };

export class InMemoryTailnet
  implements TailnetStatusReader, TailnetServeRunner
{
  private node: Node;
  private serving: TailnetServing;

  constructor(dnsName: string, serving: TailnetServing = { kind: 'nothing' }) {
    this.node = { running: true, https: true, dnsName };
    this.serving = serving;
  }

  async read(): Promise<TailnetReport> {
    return { kind: 'status', ...this.node, serving: this.serving };
  }

  async serve(input: TailnetServeTarget): Promise<TailnetServeOutcome> {
    this.serving = { kind: 'proxy', target: input.target };
    return { kind: 'done' };
  }

  async stop(): Promise<TailnetServeOutcome> {
    this.serving = { kind: 'nothing' };
    return { kind: 'done' };
  }

  change(node: Partial<Node>): void {
    this.node = { ...this.node, ...node };
  }
}

import type {
  TailnetServeOutcome,
  TailnetServeTarget,
} from '../models/remote-access.ts';

export interface TailnetServeRunner {
  serve(
    input: TailnetServeTarget,
    signal?: AbortSignal,
  ): Promise<TailnetServeOutcome>;
  stop(
    input: TailnetServeTarget,
    signal?: AbortSignal,
  ): Promise<TailnetServeOutcome>;
}

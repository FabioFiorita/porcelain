import { Context, type Effect } from 'effect';
import type { WalkthroughModel } from '../models/walkthrough.ts';
export interface WalkthroughModelReader {
  readonly read: () => Effect.Effect<readonly WalkthroughModel[]>;
}
export const WalkthroughModelReader = Context.Service<
  '@porcelain/walkthroughs/WalkthroughModelReader',
  WalkthroughModelReader
>('@porcelain/walkthroughs/WalkthroughModelReader');

import { Context } from 'effect';
import type { QueueWalkthroughUseCase } from '../use-cases/walkthroughs/queue-walkthrough.ts';
export interface QueueWalkthroughUseCasePort extends Context.Service.Shape<
  typeof QueueWalkthroughUseCase
> {}
export const QueueWalkthroughUseCasePort = Context.Service<
  '@porcelain/server/QueueWalkthroughUseCasePort',
  QueueWalkthroughUseCasePort
>('@porcelain/server/QueueWalkthroughUseCasePort');

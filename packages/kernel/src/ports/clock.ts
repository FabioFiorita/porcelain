import { Context } from 'effect';
export interface Clock {
  now(): string;
}

export const Clock = Context.Service<'@porcelain/kernel/Clock', Clock>(
  '@porcelain/kernel/Clock',
);

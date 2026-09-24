import type { OperationContext } from './operation-context.ts';

export type JobWork = {
  execute(context: OperationContext): Promise<void>;
};

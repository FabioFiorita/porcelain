import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'use-cases/access/read-health.ts extends a new runtime/operation.ts base class that holds execute(); the use case declares none',
  gate: 'lint',
  rule: 'porcelain(operation-class-shape)',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/runtime/operation.ts',
      content: `import type { OperationContext } from './operation-context.ts';

export abstract class Operation<Result> {
  protected abstract run(context: OperationContext): Promise<Result>;

  execute(context: OperationContext): Promise<Result> {
    return this.run(context);
  }
}
`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: "import type { ReadHealthResponse } from '@porcelain/contracts/access';",
      new: `import type { ReadHealthResponse } from '@porcelain/contracts/access';
import { Operation } from '../../runtime/operation.ts';`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: 'export class ReadHealthUseCase {',
      new: 'export class ReadHealthUseCase extends Operation<ReadHealthResponse> {',
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: '    this.readEnvironment = readEnvironment;',
      new: `    super();
    this.readEnvironment = readEnvironment;`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: '  execute(context: OperationContext): Promise<ReadHealthResponse> {',
      new: '  protected run(context: OperationContext): Promise<ReadHealthResponse> {',
    },
  ],
} satisfies Probe;

import type { Probe } from '../probe.ts';

export default {
  decision: 'N0',
  plants:
    'new apps/server/src/controllers/read-uptime-controller.ts exporting class ReadUptimeController with execute()',
  gate: 'arch',
  rule: 'unclassified-source',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/controllers/read-uptime-controller.ts',
      content: `import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';

export class ReadUptimeController {
  private readonly readEnvironment: ReadEnvironmentService;

  constructor(readEnvironment: ReadEnvironmentService) {
    this.readEnvironment = readEnvironment;
  }

  execute(): ReadHealthResponse {
    const { environmentId } = this.readEnvironment.execute();
    return { status: 'ok', environmentId };
  }
}
`,
    },
  ],
} satisfies Probe;

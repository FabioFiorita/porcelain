import type { Probe } from '../probe.ts';

export default {
  decision: 'C2',
  plants:
    "packages/reviews/src/ports/review-status-reader.ts: a port shaped like the changes domain's status service, execute(input, signal)",
  gate: 'lint',
  rule: 'porcelain(cross-domain-through-use-cases)',
  edits: [
    {
      kind: 'create',
      path: 'packages/reviews/src/ports/review-status-reader.ts',
      content: `import type { WorktreeKey } from '@porcelain/kernel/models';
import type { ReviewEvidence } from '../models/review-evidence.ts';

export interface ReviewStatusReader {
  execute(input: WorktreeKey, signal?: AbortSignal): Promise<ReviewEvidence>;
}
`,
    },
  ],
} satisfies Probe;

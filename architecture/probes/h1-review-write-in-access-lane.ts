import type { Probe } from '../probe.ts';

export default {
  decision: 'H1',
  plants: 'a review use case writes comment-seen state in the access lane',
  gate: 'arch',
  rule: 'lane-per-table:',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/use-cases/reviews/probe-mark-seen.ts',
      content: `import type { Effect } from 'effect';
import type { MarkCommentsSeenService } from '@porcelain/reviews/services';
import type { MarkCommentsSeenRequest, MarkCommentsSeenResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { Lanes } from '../../runtime/lanes.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
export class ProbeMarkSeenUseCase {
  private readonly markCommentsSeen: MarkCommentsSeenService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  constructor(markCommentsSeen: MarkCommentsSeenService, lanes: Lanes, laneKeys: LaneKeys) {
    this.markCommentsSeen = markCommentsSeen;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }
  execute(input: WorktreeParams & MarkCommentsSeenRequest): Effect.Effect<MarkCommentsSeenResponse> {
    return this.lanes.run(this.laneKeys.access(), 'write', () => this.markCommentsSeen.execute(input));
  }
}
`,
    },
  ],
} satisfies Probe;

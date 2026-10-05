import { Effect, Layer } from 'effect';
import { CommitPlanner } from '@porcelain/agents/commit-planning';
import { CommitModelReader } from '@porcelain/git-actions/ports';

export const processCommitModelReaderLayer = Layer.effect(
  CommitModelReader,
  Effect.gen(function* () {
    const planner = yield* CommitPlanner;
    return { list: planner.models };
  }),
);

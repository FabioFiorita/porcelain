import { Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import type { WalkthroughRun } from '../rules/walkthrough.ts';

export type WalkthroughDraftPlacement = 'call' | 'step';

export type WalkthroughDraft = {
  text: string;
  failure: { runId: string; message: string } | undefined;
  sending: boolean;
};

const drafts = Atom.family((_key: string) =>
  Atom.make<WalkthroughDraft>({
    text: '',
    failure: undefined,
    sending: false,
  }).pipe(Atom.keepAlive),
);

export function walkthroughDraft(
  {
    connection,
    scope,
  }: {
    connection: Pick<WorktreeSelection['connection'], 'environmentId'>;
    scope: WorktreeSelection['scope'];
  },
  run: Pick<WalkthroughRun, 'id' | 'branch'>,
  title: string,
  placement: WalkthroughDraftPlacement,
) {
  return drafts(
    JSON.stringify([
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      run.branch === undefined ? ['run', run.id] : ['branch', run.branch],
      title,
      placement,
    ]),
  );
}

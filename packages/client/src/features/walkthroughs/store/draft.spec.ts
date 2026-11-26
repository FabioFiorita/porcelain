import { AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vite-plus/test';
import { walkthroughDraft } from './draft.ts';

const scope = { projectId: 'project', worktreeId: 'worktree' };
const selection = { connection: { environmentId: 'computer' }, scope };
const run = { id: 'first-run', branch: 'feature' };
const draft = {
  text: 'Where are retries scheduled?',
  failure: { runId: 'first-run', message: 'The question could not be sent.' },
  sending: false,
};

it('finds the same draft and send error through a fresh selection', () => {
  const registry = AtomRegistry.make();
  try {
    registry.set(walkthroughDraft(selection, run, 'Retries'), draft);
    expect(
      registry.get(
        walkthroughDraft(
          { connection: { environmentId: 'computer' }, scope: { ...scope } },
          run,
          'Retries',
        ),
      ),
    ).toEqual(draft);
  } finally {
    registry.dispose();
  }
});

it.each([
  [
    'another computer',
    { ...selection, connection: { environmentId: 'other-computer' } },
    run,
    'Retries',
  ],
  [
    'another project',
    { ...selection, scope: { ...scope, projectId: 'other-project' } },
    run,
    'Retries',
  ],
  [
    'another worktree',
    { ...selection, scope: { ...scope, worktreeId: 'other-worktree' } },
    run,
    'Retries',
  ],
  ['another branch', selection, { ...run, branch: 'main' }, 'Retries'],
  ['another step', selection, run, 'Timeouts'],
] as const)(
  'keeps the draft and send error separate from %s',
  (_, owner, displayedRun, title) => {
    const registry = AtomRegistry.make();
    try {
      registry.set(walkthroughDraft(selection, run, 'Retries'), draft);
      expect(
        registry.get(walkthroughDraft(owner, displayedRun, title)),
      ).toEqual({ text: '', failure: undefined, sending: false });
    } finally {
      registry.dispose();
    }
  },
);

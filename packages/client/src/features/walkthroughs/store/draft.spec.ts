import { AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vite-plus/test';
import { walkthroughDraft } from './draft.ts';

const scope = { projectId: 'project', worktreeId: 'worktree' };
const selection = { connection: { environmentId: 'computer' }, scope };
const draft = {
  text: 'Where are retries scheduled?',
  failure: 'The question could not be sent.',
  sending: false,
};

it('finds the same draft and send error through a fresh selection', () => {
  const registry = AtomRegistry.make();
  try {
    registry.set(walkthroughDraft(selection, 'Retries', 'step'), draft);
    expect(
      registry.get(
        walkthroughDraft(
          { connection: { environmentId: 'computer' }, scope: { ...scope } },
          'Retries',
          'step',
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
    'Retries',
    'step',
  ],
  [
    'another project',
    { ...selection, scope: { ...scope, projectId: 'other-project' } },
    'Retries',
    'step',
  ],
  [
    'another worktree',
    { ...selection, scope: { ...scope, worktreeId: 'other-worktree' } },
    'Retries',
    'step',
  ],
  ['another step', selection, 'Timeouts', 'step'],
  ['the call card', selection, 'Retries', 'call'],
] as const)(
  'keeps the draft and send error separate from %s',
  (_, owner, title, placement) => {
    const registry = AtomRegistry.make();
    try {
      registry.set(walkthroughDraft(selection, 'Retries', 'step'), draft);
      expect(registry.get(walkthroughDraft(owner, title, placement))).toEqual({
        text: '',
        failure: undefined,
        sending: false,
      });
    } finally {
      registry.dispose();
    }
  },
);

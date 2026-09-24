import { describe, expect, it } from 'vitest';
import { CommitPlanner } from './commit-planner.ts';

type Provider = ConstructorParameters<typeof CommitPlanner>[0][number];

class ScriptedProvider implements Provider {
  readonly name: string;
  private readonly replies: ReadonlyMap<string, unknown>;

  constructor(name: string, replies: Record<string, unknown>) {
    this.name = name;
    this.replies = new Map(Object.entries(replies));
  }

  async models() {
    return [{ id: `${this.name}:small`, label: `${this.name} small` }];
  }

  async answer(model: string) {
    return this.replies.get(model);
  }
}

const request = {
  mode: 'message' as const,
  model: 'claude:sonnet',
  paths: ['README.md'],
  evidence: '{"patch":"diff"}',
};
const plan = { groups: [{ message: 'Fix', paths: ['README.md'] }] };

describe('CommitPlanner', () => {
  it('asks the named provider for the named model and returns its plan', async () => {
    const codex = new ScriptedProvider('codex', { sonnet: 'not json' });
    const claude = new ScriptedProvider('claude', {
      'claude:sonnet': 'not json',
      sonnet: plan,
    });
    const groups = await new CommitPlanner([codex, claude]).plan(request);
    expect(groups).toEqual(plan.groups);
  });

  it.each([
    'sonnet',
    'other:model',
    'claude:default',
    'claude:sonnet:extra',
    'claude:',
    'claude:-sonnet',
  ])('refuses the model %j, which it cannot route to', async (model) => {
    const planner = new CommitPlanner([
      new ScriptedProvider('claude', { sonnet: plan }),
    ]);
    await expect(planner.plan({ ...request, model })).rejects.toMatchObject({
      name: 'UnsupportedCommitModelError',
    });
  });

  it.each([
    { name: 'an unreadable answer', reply: 'not json' },
    { name: 'no answer at all', reply: undefined },
  ])('reports $name as a failed plan', async ({ reply }) => {
    await expect(
      new CommitPlanner([
        new ScriptedProvider('claude', { sonnet: reply }),
      ]).plan(request),
    ).rejects.toMatchObject({ name: 'CommitPlanFailedError' });
  });

  it('lists the models of every provider in order', async () => {
    const models = await new CommitPlanner([
      new ScriptedProvider('codex', {}),
      new ScriptedProvider('claude', {}),
    ]).models();
    expect(models.map((model) => model.id)).toEqual([
      'codex:small',
      'claude:small',
    ]);
  });
});

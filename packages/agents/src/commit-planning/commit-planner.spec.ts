import { describe, expect, it } from 'vitest';
import { CommitPlanner } from './commit-planner.ts';

type Provider = ConstructorParameters<typeof CommitPlanner>[0][number];

class AnsweringProvider implements Provider {
  readonly name: string;
  readonly questions: { model: string; prompt: string }[] = [];
  private readonly reply: unknown;

  constructor(name: string, reply: unknown) {
    this.name = name;
    this.reply = reply;
  }

  async models() {
    return [{ id: `${this.name}:small`, label: `${this.name} small` }];
  }

  async answer(model: string, prompt: string) {
    this.questions.push({ model, prompt });
    if (this.reply instanceof Error) throw this.reply;
    return this.reply;
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
    const codex = new AnsweringProvider('codex', plan);
    const claude = new AnsweringProvider('claude', plan);
    const groups = await new CommitPlanner([codex, claude]).plan(request);
    expect(groups).toEqual(plan.groups);
    expect(codex.questions).toEqual([]);
    expect(claude.questions.map((question) => question.model)).toEqual([
      'sonnet',
    ]);
    expect(claude.questions[0]?.prompt).toContain('{"patch":"diff"}');
    expect(claude.questions[0]?.prompt).toContain(
      'exactly one concise commit message',
    );
  });

  it('refuses a model it cannot route to', async () => {
    const planner = new CommitPlanner([new AnsweringProvider('claude', plan)]);
    for (const model of [
      'sonnet',
      'other:model',
      'claude:default',
      'claude:sonnet:extra',
      'claude:',
      'claude:-sonnet',
    ])
      await expect(planner.plan({ ...request, model })).rejects.toMatchObject({
        name: 'UnsupportedCommitModelError',
      });
  });

  it('reports an unreadable answer or an unexpected failure as a failed plan', async () => {
    for (const reply of ['not json', new SyntaxError('Unexpected token')])
      await expect(
        new CommitPlanner([new AnsweringProvider('claude', reply)]).plan(
          request,
        ),
      ).rejects.toMatchObject({ name: 'CommitPlanFailedError' });
  });

  it('lists the models of every provider in order', async () => {
    const models = await new CommitPlanner([
      new AnsweringProvider('codex', plan),
      new AnsweringProvider('claude', plan),
    ]).models();
    expect(models.map((model) => model.id)).toEqual([
      'codex:small',
      'claude:small',
    ]);
  });
});

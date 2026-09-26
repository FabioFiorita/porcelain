import type { CommitModel } from '@/features/review/model/git-action';

export function groupedCommitModels(models: readonly CommitModel[]) {
  const groups = new Map<string, CommitModel[]>();
  for (const model of models) {
    const provider = model.id.split(':')[0] || model.id;
    const entries = groups.get(provider) ?? [];
    entries.push(model);
    groups.set(provider, entries);
  }
  return [...groups.entries()];
}

export function resolveCommitModel(
  models: CommitModel[] | undefined,
  preferred: string,
): string | undefined {
  const explicit = models?.filter((model) => !model.id.endsWith(':default'));
  return (
    explicit?.find((model) => model.id === preferred)?.id ??
    explicit?.find((model) => /^codex:(?:.*-)?luna(?:-|$)/.test(model.id))
      ?.id ??
    explicit?.find((model) => model.id === 'claude:sonnet')?.id ??
    explicit?.find((model) => model.id === 'claude:haiku')?.id
  );
}

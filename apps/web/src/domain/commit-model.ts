import type { CommitModel } from './git-action';

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

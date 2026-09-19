import type { CommitModel } from '../contracts/git-actions';

export type { CommitModel };

/**
 * The model a draft uses when the reviewer has not picked one, or picked one the
 * server no longer offers. Fast and cheap enough for a message, good enough to read a diff.
 */
export const DEFAULT_COMMIT_MODEL = 'claude:sonnet';

const PROVIDERS: Record<string, string> = { claude: 'Claude', codex: 'Codex' };

/** Models grouped by provider (the part of the id before `:`), in server order. */
export function groupedCommitModels(
  models: readonly CommitModel[],
): { provider: string; models: CommitModel[] }[] {
  const groups = new Map<string, CommitModel[]>();
  for (const model of models) {
    const key = model.id.split(':')[0] || model.id;
    groups.set(key, [...(groups.get(key) ?? []), model]);
  }
  return [...groups.entries()].map(([key, entries]) => ({
    provider: PROVIDERS[key] ?? key,
    models: entries,
  }));
}

/** The preferred model when the server offers it, else the default, else the first; null when there are none. */
export function resolveCommitModel(
  models: readonly CommitModel[],
  preferred: string,
): string | null {
  return (
    models.find((model) => model.id === preferred)?.id ??
    models.find((model) => model.id === DEFAULT_COMMIT_MODEL)?.id ??
    models[0]?.id ??
    null
  );
}

export const commitModelLabel = (models: readonly CommitModel[], id: string) =>
  models.find((model) => model.id === id)?.label ?? id;

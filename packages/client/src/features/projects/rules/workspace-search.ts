import type { WorkspaceChoice } from './workspace-choices.ts';

export function searchWorkspaces(
  choices: readonly WorkspaceChoice[],
  query: string,
): readonly WorkspaceChoice[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return choices
    .map((choice) => ({
      ...choice,
      worktrees: choice.worktrees
        .filter(({ label, worktree }) => {
          const text = [
            choice.project.name,
            choice.environmentName,
            label,
            worktree.path,
          ]
            .join(' ')
            .toLowerCase();
          return terms.every((term) => text.includes(term));
        })
        .sort(
          (a, b) =>
            Number(b.selected) - Number(a.selected) ||
            Number(b.worktree.main) - Number(a.worktree.main) ||
            a.label.localeCompare(b.label) ||
            a.worktree.path.localeCompare(b.worktree.path),
        ),
    }))
    .filter(
      (choice) =>
        terms.length === 0 ||
        choice.worktrees.length > 0 ||
        terms.every((term) =>
          `${choice.project.name} ${choice.environmentName}`
            .toLowerCase()
            .includes(term),
        ),
    )
    .sort(
      (a, b) =>
        a.project.name.localeCompare(b.project.name) ||
        a.environmentName.localeCompare(b.environmentName),
    );
}

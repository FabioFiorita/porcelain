export const worktreeSections = [
  { id: 'walkthrough', label: 'Walkthrough' },
  { id: 'changes', label: 'Changes' },
  { id: 'files', label: 'Files' },
  { id: 'history', label: 'History' },
] as const;

export type WorktreeSection = (typeof worktreeSections)[number]['id'];

export type WorktreeGuide = { walkthrough: boolean; pending: boolean };

export function openingWorktreeSection(
  guide: WorktreeGuide,
): WorktreeSection | undefined {
  if (guide.pending) return undefined;
  return guide.walkthrough ? 'walkthrough' : 'changes';
}

export function shownWorktreeSection({
  chosen,
  opening,
}: {
  chosen: WorktreeSection | undefined;
  opening: WorktreeSection;
}): WorktreeSection {
  return chosen ?? opening;
}

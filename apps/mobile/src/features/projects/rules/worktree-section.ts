const worktreeSections = [
  { id: 'walkthrough', label: 'Walkthrough' },
  { id: 'changes', label: 'Changes' },
  { id: 'files', label: 'Files' },
  { id: 'history', label: 'History' },
] as const;

export type WorktreeSection = (typeof worktreeSections)[number]['id'];

export type WorktreeGuide = { walkthrough: boolean; pending: boolean };

export function worktreeSectionChoices(guide: WorktreeGuide) {
  return guide.walkthrough
    ? worktreeSections.filter((section) => section.id !== 'changes')
    : [worktreeSections[1], worktreeSections[0], ...worktreeSections.slice(2)];
}

export function changesInTopBar(guide: WorktreeGuide) {
  return !worktreeSectionChoices(guide).some(
    (section) => section.id === 'changes',
  );
}

export function shownWorktreeSection({
  chosen,
  opening,
  guide,
}: {
  chosen: WorktreeSection | undefined;
  opening: WorktreeSection;
  guide: WorktreeGuide;
}): WorktreeSection {
  const shown = new Set(
    worktreeSectionChoices(guide).map((section) => section.id),
  );
  if (chosen !== undefined && shown.has(chosen)) return chosen;
  if (shown.has(opening)) return opening;
  return guide.walkthrough ? 'walkthrough' : 'changes';
}

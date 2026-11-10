import type { NavigatorEntry } from '@porcelain/client/projects/rules';

export const worktreeSections = [
  { id: 'walkthrough', label: 'Walkthrough' },
  { id: 'changes', label: 'Changes' },
  { id: 'files', label: 'Files' },
  { id: 'history', label: 'History' },
] as const;

export type WorktreeSection = (typeof worktreeSections)[number]['id'];

export function openingWorktreeSection({
  review,
  changes,
}: Pick<NavigatorEntry, 'review' | 'changes'>): Exclude<
  WorktreeSection,
  'walkthrough'
> {
  const clean = changes.state === 'available' && changes.count === 0;
  return review.state === 'none' && clean ? 'files' : 'changes';
}

export function worktreeSectionNamed(name: string | undefined) {
  return (
    worktreeSections.find((section) => section.id === name)?.id ?? 'changes'
  );
}

export type WorktreeGuide = { walkthrough: boolean; pending: boolean };

export function worktreeSectionChoices(guide: WorktreeGuide) {
  const replaced = guide.walkthrough ? 'changes' : 'walkthrough';
  return worktreeSections.filter((section) => section.id !== replaced);
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

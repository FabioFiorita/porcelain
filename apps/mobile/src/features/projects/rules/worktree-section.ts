import type { NavigatorEntry } from '@porcelain/client/projects/rules';

export const worktreeSections = [
  { id: 'changes', label: 'Changes' },
  { id: 'files', label: 'Files' },
  { id: 'history', label: 'History' },
] as const;

export type WorktreeSection = (typeof worktreeSections)[number]['id'];

export function openingWorktreeSection({
  review,
  changes,
}: Pick<NavigatorEntry, 'review' | 'changes'>): WorktreeSection {
  const clean = changes.state === 'available' && changes.count === 0;
  return review.state === 'none' && clean ? 'files' : 'changes';
}

export function worktreeSectionNamed(name: string | undefined) {
  return (
    worktreeSections.find((section) => section.id === name)?.id ?? 'changes'
  );
}

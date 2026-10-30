import type { LineCounts } from '../adapters/code-entries';

export function ChangeCounts({ counts }: { counts: LineCounts }) {
  return (
    <span className="shrink-0 font-mono text-xs leading-4 font-medium tabular-nums">
      <span className="text-del-fg">−{counts.deletions}</span>{' '}
      <span className="text-add-fg">+{counts.additions}</span>
    </span>
  );
}

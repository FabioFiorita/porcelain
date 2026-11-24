export function worktreeListNoticeComputer<
  C extends { environmentId: string },
>({
  layout,
  selected,
  computers,
}: {
  layout: 'stack' | 'beside';
  selected: string | undefined;
  computers: readonly C[];
}): C | undefined {
  if (layout === 'beside' && selected !== undefined) return undefined;
  return (
    computers.find((computer) => computer.environmentId === selected) ??
    computers[0]
  );
}

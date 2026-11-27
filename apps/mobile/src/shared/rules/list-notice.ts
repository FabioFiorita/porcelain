export function worktreeListNoticeComputer<
  C extends { environmentId: string },
>({
  selected,
  computers,
}: {
  selected: string | undefined;
  computers: readonly C[];
}): C | undefined {
  return (
    computers.find((computer) => computer.environmentId === selected) ??
    computers[0]
  );
}

export function FileSectionHeader({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <h3 className="flex h-7 shrink-0 items-center gap-1 px-6 text-2xs font-medium text-muted-foreground">
      <span className="flex-1">{label}</span>
      {count === undefined ? null : (
        <span className="tabular-nums">{count}</span>
      )}
    </h3>
  );
}

import { FileIcon } from '@react-symbols/icons/utils';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
export function ReviewRow({
  label,
  detail,
  selected,
  onSelect,
  icon,
  badge,
}: {
  label: string;
  detail?: string | undefined;
  selected: boolean;
  onSelect: () => void;
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Button
      variant={selected ? 'secondary' : 'ghost'}
      className="workspace-choice h-auto min-h-10 w-full justify-start gap-2 rounded-lg px-2 py-1.5"
      aria-pressed={selected}
      title={detail ? `${label}\n${detail}` : label}
      onClick={onSelect}
    >
      {icon ?? (
        <FileIcon
          fileName={label}
          autoAssign
          aria-hidden="true"
          focusable="false"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className="w-full truncate text-left">{label}</span>
        {detail && (
          <span className="w-full truncate text-left text-xs text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
      {badge}
    </Button>
  );
}

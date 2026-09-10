import { FileIcon } from 'lucide-react';
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
      className="h-auto min-h-10 w-full justify-start gap-2 px-3 py-2"
      aria-pressed={selected}
      title={detail ? `${label}\n${detail}` : label}
      onClick={onSelect}
    >
      {icon ?? <FileIcon />}
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
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

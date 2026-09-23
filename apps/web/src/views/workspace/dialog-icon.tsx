import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DialogIcon({
  icon: Icon,
  tone = 'default',
}: {
  icon: LucideIcon;
  tone?: 'default' | 'destructive';
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl',
        tone === 'destructive'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-muted text-foreground',
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

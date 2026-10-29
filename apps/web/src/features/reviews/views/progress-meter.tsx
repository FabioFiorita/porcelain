import { cn } from '@/shared/lib/utils';

export function ProgressMeter({
  label,
  value,
  max,
  className,
}: {
  label: string;
  value: number;
  max: number;
  className?: string;
}) {
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        'h-1 w-16 shrink-0 overflow-hidden rounded-full bg-border',
        className,
      )}
    >
      <span
        className="block h-full rounded-full bg-brand"
        style={{ width: `${max === 0 ? 0 : (value / max) * 100}%` }}
      />
    </span>
  );
}

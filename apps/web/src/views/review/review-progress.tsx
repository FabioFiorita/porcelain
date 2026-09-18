import { Progress } from '@/components/ui/progress';

export function ReviewProgress({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  return (
    <div className="hidden items-center gap-2 text-[11px] text-muted-foreground md:flex">
      <Progress
        value={total === 0 ? 0 : (done / total) * 100}
        className="w-20"
        aria-label={`${done} of ${total} files reviewed`}
      />
      <span className="tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

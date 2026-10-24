import { cn } from '@/shared/lib/utils';

export function HeadTruncatedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span dir="rtl" className={cn('min-w-0 truncate text-left', className)}>
      <bdi dir="ltr">{text}</bdi>
    </span>
  );
}

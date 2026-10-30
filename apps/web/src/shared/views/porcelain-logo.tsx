import { cn } from '@/shared/lib/utils';

export function PorcelainLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" />
      <path d="M12 3v5.5q0 .5-.5 .5h-2q-.5 0-.5 .5V11q0 .5.5 .5H12v2q0 .5.5 .5h2q.5 0 .5 .5V16q0 .5-.5 .5H12V21" />
      <g fill="currentColor" stroke="none">
        <circle cx="12" cy="6.5" r="1.25" />
        <circle cx="12" cy="11.5" r="1.25" />
        <circle cx="12" cy="16.5" r="1.25" />
      </g>
    </svg>
  );
}

import { cn } from '@/shared/lib/utils';

export function PorcelainLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect x="3.5" y="2.5" width="17" height="19" rx="4" />
      <path d="M8 7.5c2.5 1.6 5.5 1.6 8 0" />
      <path d="M12 11v6" />
    </svg>
  );
}

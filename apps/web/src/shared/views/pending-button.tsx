import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function PendingContent({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex items-center gap-[inherit]">
      <span
        className="inline-flex items-center gap-[inherit] data-[pending=true]:opacity-0"
        data-pending={pending}
      >
        {children}
      </span>
      {pending && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <Spinner />
        </span>
      )}
    </span>
  );
}

type PendingButtonProps = Pick<
  ComponentProps<typeof Button>,
  | 'aria-description'
  | 'aria-label'
  | 'children'
  | 'className'
  | 'disabled'
  | 'onClick'
  | 'size'
  | 'type'
  | 'variant'
> & {
  pending: boolean;
  'data-slot'?: string;
};

export function PendingButton({
  pending,
  disabled,
  children,
  variant,
  size,
  type,
  className,
  onClick,
  'aria-description': description,
  'aria-label': label,
  'data-slot': slot,
}: PendingButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      type={type}
      className={className}
      onClick={onClick}
      data-slot={slot ?? 'button'}
      aria-description={description}
      aria-label={label}
      aria-busy={pending}
      disabled={disabled || pending}
    >
      <PendingContent pending={pending}>{children}</PendingContent>
    </Button>
  );
}

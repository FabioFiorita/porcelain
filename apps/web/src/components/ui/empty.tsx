import { cn } from '@renderer/lib/utils'

function Empty({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="empty"
      className={cn(
        'flex min-h-32 flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-6 text-center text-balance',
        className,
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="empty-header"
      className={cn('flex max-w-sm flex-col items-center gap-1.5', className)}
      {...props}
    />
  )
}

function EmptyMedia({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="empty-media"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'h3'>): React.JSX.Element {
  return (
    <h3
      data-slot="empty-title"
      className={cn('text-sm font-medium text-foreground', className)}
      {...props}
    />
  )
}

function EmptyDescription({
  className,
  ...props
}: React.ComponentProps<'p'>): React.JSX.Element {
  return (
    <p
      data-slot="empty-description"
      className={cn('max-w-sm text-xs leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        'flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance',
        className,
      )}
      {...props}
    />
  )
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle }

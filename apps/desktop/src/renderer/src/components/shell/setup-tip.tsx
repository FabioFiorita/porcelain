import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { X } from 'lucide-react'

/**
 * One-time onboarding tip card: short copy, action buttons, dismiss (X).
 * Used on Changes / Files / Settings starter tips — not the Review empty canvas.
 */
export function SetupTip({
  children,
  actions,
  onDismiss,
  testId,
  dismissTestId,
  className,
}: {
  children: React.ReactNode
  actions?: React.ReactNode
  onDismiss: () => void
  testId?: string
  dismissTestId?: string
  className?: string
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      className={cn(
        'relative flex flex-col gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 pr-8',
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1 right-1 size-6 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        data-testid={dismissTestId}
        onClick={onDismiss}
      >
        <X className="size-3.5" />
      </Button>
      {children}
      {actions !== undefined && actions !== null && (
        <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
      )}
    </div>
  )
}

import { TestIds } from '@shared/test-ids'
import { Component, type ReactNode } from 'react'

interface ErrorBoundaryState {
  error: Error | null
}

/** Catches render crashes and shows the error instead of a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error): void {
    console.error('renderer crash:', error)
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="dark flex h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-foreground">
          <p className="text-lg font-medium">Something went wrong</p>
          <pre className="max-h-80 max-w-full overflow-auto rounded-md bg-muted p-4 text-xs text-destructive">
            {this.state.error.stack ?? this.state.error.message}
          </pre>
          <p className="text-sm text-muted-foreground">Reload the window with Cmd+R</p>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Pane-level: contains a crash to one pane instead of taking the window down.
 *
 * Review content is agent-authored and arrives from outside the app — markup an
 * agent wrote, or a review received from a clone. One unrenderable document must
 * cost the human that document, not the whole app — they still need the other
 * Review tabs, the file list, and the evidence to finish the review.
 */
export class PaneErrorBoundary extends Component<
  { children: ReactNode; label: string },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error): void {
    console.error('pane crash:', error)
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-8"
          data-testid={TestIds.paneError}
        >
          <p className="text-sm font-medium">{this.props.label} could not be displayed</p>
          <p className="max-w-md text-center text-xs text-muted-foreground">
            The rest of this review still works — switch tabs to keep reading.
          </p>
          <pre className="mt-1 max-h-32 max-w-full overflow-auto rounded-md bg-muted/50 p-3 text-2xs text-muted-foreground">
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

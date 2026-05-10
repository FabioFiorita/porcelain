import { Component, type ReactNode } from 'react'

interface ErrorBoundaryState {
  error: Error | null
}

/** Catches render crashes and shows the error instead of a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('renderer crash:', error)
  }

  render(): ReactNode {
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

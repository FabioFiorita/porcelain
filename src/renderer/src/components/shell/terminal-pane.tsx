import { SquareTerminal } from 'lucide-react'

export function TerminalPane(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-8 items-center gap-2 border-b px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <SquareTerminal className="size-3.5" />
        Terminal
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Terminal coming soon (xterm.js)</p>
      </div>
    </div>
  )
}

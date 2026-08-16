import { Button } from '@renderer/components/ui/button'
import {
  blurTerminal,
  focusTerminal,
  isTerminalFocused,
  sendTerminalArrow,
  sendTerminalInput,
} from '@renderer/lib/terminal-registry'
import { cn } from '@renderer/lib/utils'
import { useTerminalInputStore } from '@renderer/stores/terminal-input'
import { TestIds } from '@shared/test-ids'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Keyboard } from 'lucide-react'
import { useRef } from 'react'

const ARROWS = [
  { direction: 'left', label: 'Left', Icon: ArrowLeft },
  { direction: 'down', label: 'Down', Icon: ArrowDown },
  { direction: 'up', label: 'Up', Icon: ArrowUp },
  { direction: 'right', label: 'Right', Icon: ArrowRight },
] as const

const KEY_CLASS = 'h-9 min-w-9 shrink-0 px-2 font-mono text-xs'
const ICON_KEY_CLASS = 'size-9 shrink-0'

/**
 * One key, and the bar's one piece of real behaviour: FOCUS PRESERVATION.
 *
 * Tapping a button moves focus out of Ghostty, and on iOS losing focus dismisses the
 * software keyboard — so a key bar built the naive way closes the keyboard on its own
 * first tap. Two guards: `onMouseDown` preventDefault stops the focus move outright where
 * the browser honors it (desktop), and for touch the button samples focus at pointer-down
 * (before anything moves) and restores it after the key is sent — but ONLY if the terminal
 * had it, so tapping Esc with the keyboard deliberately dismissed can't raise it again.
 *
 * `onActivate` receives that sampled state, and the keyboard toggle — the one key whose
 * whole job is to CHANGE focus — opts out of the restore with `restoreFocus={false}`.
 */
function KeyButton({
  sessionId,
  onActivate,
  testId,
  className,
  variant = 'outline',
  restoreFocus = true,
  pressed,
  label,
  title,
  children,
}: {
  sessionId: string
  onActivate: (wasFocused: boolean) => void
  testId: string
  className: string
  variant?: 'outline' | 'ghost'
  restoreFocus?: boolean
  pressed?: boolean
  label?: string
  title?: string
  children: React.ReactNode
}): React.JSX.Element {
  const wasFocused = useRef(false)
  return (
    <Button
      variant={variant}
      className={className}
      aria-pressed={pressed}
      aria-label={label}
      title={title}
      data-testid={testId}
      onMouseDown={(event: React.MouseEvent<HTMLButtonElement>): void => event.preventDefault()}
      onPointerDown={() => {
        wasFocused.current = isTerminalFocused(sessionId)
      }}
      onClick={() => {
        onActivate(wasFocused.current)
        if (restoreFocus && wasFocused.current) focusTerminal(sessionId)
      }}
    >
      {children}
    </Button>
  )
}

/**
 * The key row above a terminal pane: the keys a shell needs that a software keyboard
 * doesn't have (Esc, Tab, Ctrl chords, arrows) plus a keyboard show/dismiss toggle.
 *
 * Touch devices only — `terminal-view` owns that gate (always on, no Settings toggle).
 * Sits at the TOP so it stays above the iOS soft keyboard; a bottom bar was covered
 * whenever you were typing, which made the row useless on iPad.
 */
export function TerminalKeyBar({ sessionId }: { sessionId: string }): React.JSX.Element {
  const ctrlArmed = useTerminalInputStore((s) => s.pendingCtrlId === sessionId)
  const toggleCtrl = useTerminalInputStore((s) => s.toggleCtrl)

  return (
    <div
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-2 py-1.5"
      data-testid={TestIds.terminalKeyBar}
    >
      <KeyButton
        sessionId={sessionId}
        testId={TestIds.terminalKey('esc')}
        className={KEY_CLASS}
        onActivate={() => sendTerminalInput(sessionId, '\x1b')}
      >
        Esc
      </KeyButton>
      <KeyButton
        sessionId={sessionId}
        testId={TestIds.terminalKey('tab')}
        className={KEY_CLASS}
        onActivate={() => sendTerminalInput(sessionId, '\t')}
      >
        Tab
      </KeyButton>
      <KeyButton
        sessionId={sessionId}
        testId={TestIds.terminalKey('ctrl')}
        // Sticky, so it reads as a held modifier: armed = the app's one selected fill.
        className={cn(KEY_CLASS, ctrlArmed && 'bg-accent')}
        pressed={ctrlArmed}
        title="Ctrl — then press a key (⌃C, ⌃D, ⌃R…)"
        onActivate={() => toggleCtrl(sessionId)}
      >
        Ctrl
      </KeyButton>
      <KeyButton
        sessionId={sessionId}
        testId={TestIds.terminalKey('ctrl-c')}
        className={KEY_CLASS}
        // Interrupt is THE key you reach for on a phone; two taps through sticky Ctrl is
        // one too many while a runaway process is printing.
        title="Interrupt (Ctrl-C)"
        onActivate={() => sendTerminalInput(sessionId, '\x03')}
      >
        ^C
      </KeyButton>
      {ARROWS.map(({ direction, label, Icon }) => (
        <KeyButton
          key={direction}
          sessionId={sessionId}
          testId={TestIds.terminalKey(label)}
          className={ICON_KEY_CLASS}
          label={label}
          onActivate={() => sendTerminalArrow(sessionId, direction)}
        >
          <Icon />
        </KeyButton>
      ))}
      <KeyButton
        sessionId={sessionId}
        testId={TestIds.terminalKey('keyboard')}
        className={cn(ICON_KEY_CLASS, 'ml-auto')}
        variant="ghost"
        label="Toggle keyboard"
        title="Show or dismiss the keyboard"
        restoreFocus={false}
        onActivate={(wasFocused: boolean): void => {
          if (wasFocused) blurTerminal(sessionId)
          else focusTerminal(sessionId)
        }}
      >
        <Keyboard />
      </KeyButton>
    </div>
  )
}

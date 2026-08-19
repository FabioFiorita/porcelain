import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { compactButtonClass } from '@renderer/lib/controls'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useEffect, useState } from 'react'
import { useQuickAddDismiss } from './quick-add-dismiss'
import { MissingEnvironmentTargetError, useTaskActions } from './tasks-mutations'

/**
 * The menu-bar quick-add surface: title, optional notes, one Task on This device.
 *
 * Deliberately NOT the full New Task composer (projects, tags, @-mentions, uploads). This
 * window exists to catch a thought in two seconds from anywhere in the OS; anything the
 * popover cannot express is a reason to open the app, not a reason to grow the popover.
 * The Task is always filed on the local daemon (`null` target) — the popover carries no
 * Environment switcher, and a silent guess would file it on the wrong machine.
 */

/** How long the confirmation stays up before the popover dismisses itself. */
const CONFIRMATION_MS = 900

export function QuickAddView(): React.JSX.Element {
  const actions = useTaskActions()
  const dismiss = useQuickAddDismiss()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)

  // Escape dismisses, exactly like clicking away from a menu-bar popover.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss])

  // Created → show what landed, then close. The window is destroyed on dismiss, so the
  // timer never outlives the surface it belongs to.
  useEffect(() => {
    if (created === null) return
    const timer = window.setTimeout(dismiss, CONFIRMATION_MS)
    return () => window.clearTimeout(timer)
  }, [created, dismiss])

  const submit = (): void => {
    setError(null)
    const trimmed = title.trim()
    if (trimmed === '') {
      setError('A Task needs a title.')
      return
    }
    runUserAction(
      async () => {
        await actions.add(null, {
          title: trimmed,
          ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
        })
        setCreated(trimmed)
      },
      (reason: unknown) => {
        setError(
          reason instanceof MissingEnvironmentTargetError || reason instanceof Error
            ? reason.message
            : 'Could not create that Task.',
        )
      },
    )
  }

  return (
    <div
      data-testid={TestIds.quickAdd}
      className="flex h-screen w-screen flex-col gap-2 bg-background p-3 text-foreground"
    >
      <div className="flex items-baseline justify-between">
        <h1 className="text-sm font-semibold">Quick Add Task</h1>
        <span className="text-2xs text-muted-foreground">This device</span>
      </div>
      {created === null ? (
        <>
          {/* Autofocus is the point of a menu-bar popover: it exists to be typed into
              the instant it opens. */}
          <Input
            autoFocus
            data-testid={TestIds.quickAddTitle}
            placeholder="What needs doing?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
          <Textarea
            data-testid={TestIds.quickAddNotes}
            className="min-h-16 flex-1 resize-none text-sm"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit()
            }}
          />
          {error !== null && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between">
            <span className="text-2xs text-muted-foreground">Esc to dismiss</span>
            <Button
              data-testid={TestIds.quickAddSubmit}
              className={compactButtonClass}
              disabled={actions.isPending}
              onClick={submit}
            >
              Add task
            </Button>
          </div>
        </>
      ) : (
        <p
          data-testid={TestIds.quickAddConfirmation}
          className="flex-1 text-sm text-muted-foreground"
        >
          Added “{created}”.
        </p>
      )}
    </div>
  )
}

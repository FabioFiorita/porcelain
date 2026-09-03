import { ENVIRONMENT_NAME_MAX_LENGTH } from '@porcelain/contracts/projects'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useRenameEnvironment } from '@renderer/features/remote'
import { compactButtonClass } from '@renderer/lib/controls'
import { TestIds } from '@shared/test-ids'
import { Pencil } from 'lucide-react'
import { useState } from 'react'

/**
 * The name of one Environment row, and the inline editor that sets it.
 *
 * Two Porcelain daemons with their own homes on ONE machine report the same host name, so
 * the machine name alone cannot say which row is which. The nickname is written on the
 * daemon that owns the Environment — not on this client — so every device paired with it
 * reads the same label.
 *
 * Clearing the field is a real gesture, not an error: an empty name falls back to the
 * machine name the daemon derives for itself, which is why the placeholder shows it.
 */
export function EnvironmentName(props: {
  /** null is This device — the daemon the shell itself launched. */
  environmentId: string | null
  /** What the row shows today: nickname when set, machine name otherwise. */
  name: string
  /** The machine name a cleared nickname falls back to; null when the daemon is down. */
  machineName: string | null
  /** An unreachable daemon cannot be told its own name. */
  disabled: boolean
}): React.JSX.Element {
  const rowId = props.environmentId ?? 'local'
  const { rename, pendingId } = useRenameEnvironment()
  const [draft, setDraft] = useState<string | null>(null)
  const isPending = pendingId === props.environmentId
  // Measured raw, exactly as the contract measures it — the daemon trims, this does not.
  const tooLong = draft !== null && draft.length > ENVIRONMENT_NAME_MAX_LENGTH

  // Local is a stable role label. Host-derived names and human nicknames belong to saved
  // remote Environments; showing either here makes one physical computer look like a remote.
  if (props.environmentId === null) {
    return (
      <p
        className="truncate text-sm-minus font-medium"
        data-testid={TestIds.environmentName(rowId)}
      >
        Local
      </p>
    )
  }

  /**
   * Save. The editor stays open until the daemon answers: a rename crosses to ANOTHER
   * machine, and discarding the typed name on the way would leave a failed rename with
   * nothing on screen to correct. Over-long input is refused with a message rather than
   * silently cut down — a name the human did not choose is worse than an error they see.
   */
  function commit(): void {
    if (draft === null || tooLong) return
    rename({ environmentId: props.environmentId, name: draft }, { onSuccess: () => setDraft(null) })
  }

  if (draft === null) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <p
          className="truncate text-sm-minus font-medium"
          data-testid={TestIds.environmentName(rowId)}
        >
          {props.name}
        </p>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Rename ${props.name}`}
                data-testid={TestIds.environmentRename(rowId)}
                disabled={props.disabled || isPending}
                onClick={() => setDraft(props.name)}
              >
                <Pencil />
              </Button>
            }
          />
          <TooltipContent>
            {props.disabled ? 'Reachable Environments only' : 'Rename this Environment'}
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <Input
          aria-label="Environment name"
          aria-invalid={tooLong}
          className="h-7 max-w-56"
          data-testid={TestIds.environmentNameInput(rowId)}
          onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
            setDraft(event.target.value)
          }
          onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>): void => {
            if (event.key === 'Enter') commit()
            // Escape is Cancel, and Cancel is closed while a write is in flight for the same
            // reason: the typed name is the only copy until the daemon answers.
            if (event.key === 'Escape' && !isPending) setDraft(null)
          }}
          placeholder={props.machineName ?? 'Machine name'}
          value={draft}
        />
        <Button
          className={compactButtonClass}
          data-testid={TestIds.environmentNameSave(rowId)}
          disabled={isPending || tooLong}
          onClick={commit}
          size="sm"
          variant="outline"
        >
          Save
        </Button>
        <Button
          className={compactButtonClass}
          disabled={isPending}
          onClick={() => setDraft(null)}
          size="sm"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
      {tooLong ? (
        <p className="text-xs text-destructive" role="alert">
          {`Names are limited to ${ENVIRONMENT_NAME_MAX_LENGTH} characters.`}
        </p>
      ) : null}
    </div>
  )
}

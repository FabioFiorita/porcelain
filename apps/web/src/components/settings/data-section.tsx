import { describeDisposition } from '@porcelain/client-runtime/companion-disposition'
import { Button } from '@renderer/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import {
  useCompanionDispositions,
  useCompanionGitVisibility,
  useSetCompanionDisposition,
  useSetCompanionGitVisibility,
} from '@renderer/hooks/use-companion-dispositions'
import { compactButtonClass } from '@renderer/lib/controls'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { runUserAction } from '@shared/background'
// Type-only on purpose: `@shared/project-porcelain` imports `node:path`, so a
// value import from it fails the web bundle. Client-facing copy lives in
// `@porcelain/client-runtime/companion-disposition` instead.
import type { CompanionDisposition } from '@shared/project-porcelain'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'

/**
 * Settings → Data: where this project's companion data lives and what git carries.
 *
 * Split out of Settings → Companion, which had grown two unrelated jobs: the
 * agent skill (a machine install) and the project's git dispositions (a property of
 * the checkout, reachable from every client). Companion now owns only the skill.
 *
 * The toggle is a git disposition, not a storage location — companion data lives
 * in `<project>/.porcelain/` either way. Local writes an ignore line and untracks;
 * Shared removes the line and leaves staging to the human.
 */
function DispositionRow({
  channelKey,
  label,
  hint,
  disposition,
  trackedCount,
  onChange,
}: {
  channelKey: string
  label: string
  hint: string
  disposition: CompanionDisposition
  trackedCount: number
  onChange: (next: CompanionDisposition) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm-minus font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        <p
          className="mt-0.5 text-xs text-muted-foreground/80"
          data-testid={TestIds.companionDispositionState(channelKey)}
        >
          {describeDisposition(disposition, trackedCount)}
        </p>
      </div>
      <div className="shrink-0 self-start">
        <ToggleGroup
          value={[disposition]}
          onValueChange={(value: string[]) => {
            const next = value[0]
            if (next === 'shared' || next === 'local') {
              onChange(next satisfies CompanionDisposition)
            }
          }}
        >
          <ToggleGroupItem
            value="shared"
            size="sm"
            className={compactButtonClass}
            data-testid={TestIds.companionDisposition(channelKey, 'shared')}
          >
            Shared
          </ToggleGroupItem>
          <ToggleGroupItem
            value="local"
            size="sm"
            className={compactButtonClass}
            data-testid={TestIds.companionDisposition(channelKey, 'local')}
          >
            Local
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}

export function DataSection(): React.JSX.Element {
  const project = useProjectSelectionStore((s) => s.project)
  const channels = useCompanionDispositions()
  const { data: visibility } = useCompanionGitVisibility()
  const setVisibility = useSetCompanionGitVisibility()
  const { set } = useSetCompanionDisposition()
  const [lastUntracked, setLastUntracked] = useState<string[]>([])
  const hidden = visibility?.hidden === true

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm-minus font-medium">What git carries</p>
          {/* Said once, up front: the toggle picks a git disposition, not a second
              copy on disk. Without this the rows read as "local storage vs cloud". */}
          <p className="text-xs text-muted-foreground">
            Every channel below is stored in{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-2xs">.porcelain/</code>{' '}
            inside this project. <span className="font-medium text-foreground">Shared</span> lets
            git carry it to teammates, other worktrees, and your other machines.{' '}
            <span className="font-medium text-foreground">Local</span> ignores it here — the file
            still exists, it just never leaves this clone.
          </p>
        </div>
        {project !== null && (
          <div
            className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid={TestIds.companionGitVisibility}
          >
            <div className="min-w-0">
              <p className="text-sm-minus font-medium">
                {hidden ? 'Hidden from git in this clone' : 'Visible to git'}
              </p>
              <p className="text-xs text-muted-foreground">
                {hidden ? 'Nothing shows in git status. Sharing anything lifts this.' : null}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 self-start sm:self-center"
              data-testid={TestIds.companionGitVisibilityToggle}
              onClick={() => {
                runUserAction(
                  async () => {
                    await setVisibility(!hidden)
                  },
                  (error) => {
                    toastUserActionError('Change git visibility', error)
                  },
                )
              }}
            >
              {hidden ? 'Start sharing' : 'Hide from git'}
            </Button>
          </div>
        )}
        {project === null ? (
          <p className="text-xs text-muted-foreground">Open a project to choose.</p>
        ) : (
          <div className="flex flex-col gap-4" data-testid={TestIds.companionDispositions}>
            {(channels ?? []).map((channel) => (
              <DispositionRow
                key={channel.key}
                channelKey={channel.key}
                label={channel.label}
                hint={channel.hint}
                disposition={channel.disposition}
                trackedCount={channel.trackedPaths.length}
                onChange={(next) => {
                  runUserAction(
                    async () => {
                      setLastUntracked(await set(channel.key, next))
                    },
                    (error) => {
                      toastUserActionError('Change what git carries', error)
                    },
                  )
                }}
              />
            ))}
          </div>
        )}
        {lastUntracked.length > 0 && (
          <p className="text-xs text-muted-foreground" data-testid={TestIds.companionUntracked}>
            Untracked {lastUntracked.length} {lastUntracked.length === 1 ? 'file' : 'files'} — still
            on disk, removal staged.
          </p>
        )}
      </div>
    </div>
  )
}

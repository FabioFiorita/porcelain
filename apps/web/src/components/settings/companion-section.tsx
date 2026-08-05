import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import {
  useCompanionDispositions,
  useSetCompanionDisposition,
} from '@renderer/hooks/use-companion-dispositions'
import { compactButtonClass } from '@renderer/lib/controls'
import { useRepoStore } from '@renderer/stores/repo'
import type { CompanionDisposition } from '@shared/project-porcelain'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'
import { SkillsSection } from './skills-section'

/**
 * Settings → Companion: what git carries, plus the agent companion skill.
 *
 * The toggle is a git disposition, not a storage location — companion data lives
 * in `<repo>/.porcelain/` either way. Local writes an ignore line and untracks;
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
  onChange: (next: CompanionDisposition) => Promise<void>
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm-minus font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0 self-start sm:self-center">
        <ToggleGroup
          value={[disposition]}
          onValueChange={async (value: string[]) => {
            const next = value[0]
            if (next === 'shared' || next === 'local') {
              await onChange(next satisfies CompanionDisposition)
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
            Local{trackedCount > 0 && disposition === 'shared' ? ` (${trackedCount})` : ''}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}

export function CompanionSection(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const channels = useCompanionDispositions()
  const { set } = useSetCompanionDisposition()
  const [lastUntracked, setLastUntracked] = useState<string[]>([])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm-minus font-medium">What git carries</p>
          <p className="text-xs text-muted-foreground">
            Companion data always lives in <span className="font-mono">.porcelain/</span> inside
            this repo. This only decides whether git carries it to the rest of the team — it is
            written as ignore rules your teammates can read and commit.
          </p>
        </div>
        {repo === null ? (
          <p className="text-xs text-muted-foreground">Open a project to choose.</p>
        ) : (
          <div className="flex flex-col gap-3" data-testid={TestIds.companionDispositions}>
            {(channels ?? []).map((channel) => (
              <DispositionRow
                key={channel.key}
                channelKey={channel.key}
                label={channel.label}
                hint={channel.hint}
                disposition={channel.disposition}
                trackedCount={channel.trackedPaths.length}
                onChange={async (next) => {
                  setLastUntracked(await set(channel.key, next))
                }}
              />
            ))}
          </div>
        )}
        {lastUntracked.length > 0 && (
          <p className="text-xs text-muted-foreground" data-testid={TestIds.companionUntracked}>
            Stopped tracking {lastUntracked.length} {lastUntracked.length === 1 ? 'file' : 'files'}.
            They are still on disk; the removal is staged and lands for everyone on your next
            commit.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Companion skills teach your agent how to push feature reviews (Intent, Execution,
          Evidence), read comments, manage the board, and curate actions. They ship through
          skills.sh. Commands use <span className="font-mono">-g</span> so the skill is available in
          every project, not only one working directory.
        </p>
        <SkillsSection />
      </div>
    </div>
  )
}

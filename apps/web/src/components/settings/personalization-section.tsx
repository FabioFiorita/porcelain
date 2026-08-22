import type { ProfileLayer } from '@porcelain/contracts'
import type { WorktreeProfileView } from '@porcelain/contracts/files'
import { Button } from '@renderer/components/ui/button'
import { useWorktreeProfile } from '@renderer/features/files'
import { compactButtonClass } from '@renderer/lib/controls'
import { copyText } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { runUserAction } from '@shared/background'
import {
  PROFILE_KEEPER_PROMPT,
  profileStarterPrompt,
  profileWorktreePrompt,
} from '@shared/profile-prompts'
import { TestIds } from '@shared/test-ids'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ProjectScopePicker } from './project-scope-picker'

/**
 * Settings → Personalization: the worktree profile, READ-ONLY.
 *
 * Read-only is the feature, not a gap. Pins and hides are edited from the tree,
 * where every hidden path stays one deliberate gesture away, discoverable from
 * the tree rather than from settings. Layer order is written by the agent, so
 * the copyable prompts below ARE the affordance — a form here would just
 * be the hand-curation nobody did.
 *
 * The two levels are shown apart on purpose. A single merged list cannot say
 * which focus is the project baseline and which this worktree added, and a
 * reader who cannot tell them apart cannot decide which one to ask their agent
 * to change.
 */

function CopyButton({
  label,
  text,
  testId,
}: {
  label: string
  text: string
  testId: string
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = (): void =>
    runUserAction(
      async () => {
        await copyText(text)
        setCopied(true)
        // Long enough to read, short enough that a second copy still feels live.
        setTimeout(() => setCopied(false), 2000)
      },
      (): void => {
        toast.error('Could not copy the prompt')
      },
    )

  return (
    <Button
      variant="outline"
      size="sm"
      className={compactButtonClass}
      onClick={copy}
      data-testid={testId}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

function PathList({
  paths,
  empty,
}: {
  paths: readonly string[]
  empty: string
}): React.JSX.Element {
  if (paths.length === 0) {
    return <p className="text-xs text-muted-foreground italic">{empty}</p>
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {paths.map((path) => (
        <li key={path} className="truncate font-mono text-xs">
          {path}
        </li>
      ))}
    </ul>
  )
}

/** Layer order reads as a sequence, so render it as one rather than as a list. */
function LayerOrder({
  layers,
  empty,
}: {
  layers: readonly ProfileLayer[]
  empty: string
}): React.JSX.Element {
  if (layers.length === 0) {
    return <p className="text-xs text-muted-foreground italic">{empty}</p>
  }
  return (
    <p className="text-xs">
      {layers.map((layer, index) => (
        <span key={layer.label}>
          {index > 0 && <span className="text-muted-foreground"> → </span>}
          <span className="font-medium">{layer.label}</span>
        </span>
      ))}
    </p>
  )
}

function ProfileField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {children}
    </div>
  )
}

function BaseProfile({ view }: { view: WorktreeProfileView }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3" data-testid={TestIds.personalizationBase}>
      <div>
        <p className="text-sm-minus font-medium">This project</p>
        <p className="text-xs text-muted-foreground">
          Inherited by every worktree of this repository. Hiding and pinning from the file tree
          writes here, so it applies everywhere.
        </p>
      </div>
      <ProfileField label="Pinned">
        <PathList paths={view.base.pinnedPaths} empty="Nothing pinned." />
      </ProfileField>
      <ProfileField label="Hidden">
        <PathList paths={view.base.hiddenPaths} empty="Nothing hidden — the plain tree." />
      </ProfileField>
      <ProfileField label="Story order">
        <LayerOrder layers={view.base.layers} empty="No layers declared — changes read plainly." />
      </ProfileField>
    </section>
  )
}

function OverrideProfile({ view }: { view: WorktreeProfileView }): React.JSX.Element {
  const override = view.override
  return (
    <section className="flex flex-col gap-3" data-testid={TestIds.personalizationOverride}>
      <div>
        <p className="text-sm-minus font-medium">This worktree</p>
        <p className="text-xs text-muted-foreground">
          {override === null
            ? 'No override — this worktree inherits everything above. Ask your agent for focus shaped to the task you are on.'
            : 'Added on top of the project profile, for this worktree only. Your agent writes this.'}
        </p>
      </div>
      {override !== null && (
        <>
          <ProfileField label="Also pinned">
            <PathList paths={override.pinnedPaths} empty="Nothing extra." />
          </ProfileField>
          <ProfileField label="Also hidden">
            <PathList paths={override.hiddenPaths} empty="Nothing extra." />
          </ProfileField>
          {override.unhiddenPaths.length > 0 && (
            <ProfileField label="Shown despite the project hiding them">
              <PathList paths={override.unhiddenPaths} empty="" />
            </ProfileField>
          )}
          <ProfileField label="Story order">
            <LayerOrder
              layers={override.layers ?? view.base.layers}
              empty="No layers declared — changes read plainly."
            />
          </ProfileField>
        </>
      )}
    </section>
  )
}

export function PersonalizationSection(): React.JSX.Element {
  const repoPath = useHubRepoPath()
  const view = useWorktreeProfile()

  if (repoPath === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          A profile belongs to a repository and its worktrees, not to the app. Choose one to see its
          pins, hides, and story order.
        </p>
        <ProjectScopePicker />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          Pins, hides, and the order your changes read in. Set once for the project and inherited by
          every worktree; an agent can override it for the one you are working in.
        </p>
        {/* Naming the checkout is half of it — a reader also has to be able to change which one
            they are reading, without leaving Settings for the Hub tree and coming back. */}
        <ProjectScopePicker />
        <p className="truncate font-mono text-2xs text-muted-foreground" title={repoPath}>
          {repoPath}
        </p>
      </div>

      {view === undefined ? (
        <p className="text-xs text-muted-foreground">Reading the profile…</p>
      ) : (
        <>
          <BaseProfile view={view} />
          <OverrideProfile view={view} />
        </>
      )}

      <section className="flex flex-col gap-3 border-t border-foreground/5 pt-4">
        <div>
          <p className="text-sm-minus font-medium">Have your agent do it</p>
          <p className="text-xs text-muted-foreground">
            Porcelain never writes a profile on its own, and never guesses your layers from
            directory names — a confident wrong order is worse than none. Hand one of these to the
            agent you already have.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton
            label="Copy: set my profile up"
            text={profileStarterPrompt('30 days', repoPath)}
            testId={TestIds.personalizationCopyStarter}
          />
          <CopyButton
            label="Copy: focus this worktree"
            text={profileWorktreePrompt(repoPath)}
            testId={TestIds.personalizationCopyWorktree}
          />
          <CopyButton
            label="Copy: keep it up to date"
            text={PROFILE_KEEPER_PROMPT}
            testId={TestIds.personalizationCopyKeeper}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          The last one belongs in your <span className="font-mono">AGENTS.md</span> — paste it once
          and the profile follows the work without you asking.
        </p>
      </section>
    </div>
  )
}

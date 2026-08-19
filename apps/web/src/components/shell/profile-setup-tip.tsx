import type { WorktreeProfileView } from '@porcelain/contracts/files'
import { Button } from '@renderer/components/ui/button'
import { useWorktreeProfile } from '@renderer/features/files'
import { compactButtonClass } from '@renderer/lib/controls'
import { copyText } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { useSetupTipsStore } from '@renderer/stores/setup-tips'
import { runUserAction } from '@shared/background'
import { profileStarterPrompt, profileWorktreePrompt } from '@shared/profile-prompts'
import { TestIds } from '@shared/test-ids'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { SetupTip } from './setup-tip'

/**
 * First-run prompt for pins, hides, and story order.
 *
 * Porcelain never guesses layers, so the only thing this card can honestly do is
 * hand the human the paragraph their agent needs — and the one decision only
 * they can make is which level it lands on: the project baseline every worktree
 * inherits, or an override shaped to the task in this checkout alone. Two
 * buttons, two prompts, no third option that quietly picks for them.
 *
 * It shows once per project and never again after a dismissal or a first
 * profile, because an empty profile is a legitimate way to use Porcelain and a
 * card that keeps asking is worse than no card.
 */

/**
 * Nothing declared at either level — the state where a prompt is help rather
 * than noise. A worktree override that exists at all (even empty-ish) means
 * somebody has already been here, so the card stays away.
 */
export function isProfileUnset(view: WorktreeProfileView | undefined): boolean {
  if (view === undefined) return false
  const { base, override } = view
  return (
    override === null &&
    base.pinnedPaths.length === 0 &&
    base.hiddenPaths.length === 0 &&
    base.layers.length === 0
  )
}

function CopyPromptButton({
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

export function ProfileSetupTip({
  projectPath,
}: {
  projectPath: string
}): React.JSX.Element | null {
  // The checkout the daemon is answering for — that is the `workspace` the agent
  // must name, and it is a worktree path, not the project root the tip is keyed on.
  const repoPath = useHubRepoPath()
  const view = useWorktreeProfile()
  const dismiss = useSetupTipsStore((s) => s.dismiss)
  const dismissed = useSetupTipsStore((s) => s.dismissed[projectPath]?.['scope-kickoff'] === true)

  // `undefined` is "still reading" and resolves to false, so the card never
  // flashes in before the profile that would have hidden it arrives.
  if (dismissed || !isProfileUnset(view)) return null

  const workspacePath = repoPath ?? undefined

  return (
    <SetupTip
      testId={TestIds.filesProfileSetup}
      dismissTestId={TestIds.filesProfileSetupDismiss}
      className="mx-2 mt-2"
      onDismiss={() => dismiss(projectPath, 'scope-kickoff')}
      actions={
        <>
          <CopyPromptButton
            label="For this project"
            text={profileStarterPrompt('30 days', workspacePath)}
            testId={TestIds.filesProfileSetupProject}
          />
          <CopyPromptButton
            label="Just this worktree"
            text={profileWorktreePrompt(workspacePath)}
            testId={TestIds.filesProfileSetupWorktree}
          />
        </>
      }
    >
      <p className="text-xs font-medium">Nothing pinned, hidden, or ordered yet</p>
      <p className="text-2xs text-muted-foreground">
        Porcelain will not guess your layers. Copy a prompt for the agent you already have — a
        baseline every worktree inherits, or focus for this checkout alone.
      </p>
    </SetupTip>
  )
}

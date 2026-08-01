import { SetupTip } from '@renderer/components/shell/setup-tip'
import { Button } from '@renderer/components/ui/button'
import { SidebarMenu } from '@renderer/components/ui/sidebar'
import { useReadDir, useRepoScope } from '@renderer/hooks/use-files'
import { scopeSetupPrompt } from '@renderer/lib/agent-setup-prompts'
import { copyText } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { useSetupTipsStore } from '@renderer/stores/setup-tips'
import { useTreeDirsStore } from '@renderer/stores/tree-dirs'
import { TestIds } from '@shared/test-ids'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TreeNode } from './tree-node'

/** Root looks monorepo-noisy enough that a focus setup prompt is worth showing. */
const NOISY_ROOT_DIR_THRESHOLD = 5

export function FileTree({ rootPath }: { rootPath: string }): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const entries = useReadDir(rootPath)
  const scope = useRepoScope()
  const scopeKickoffDismissed = useSetupTipsStore((s) =>
    repo ? s.dismissed[repo.path]?.['scope-kickoff'] === true : true,
  )
  const dismissTip = useSetupTipsStore((s) => s.dismiss)
  const [copied, setCopied] = useState(false)
  // Watch the repo root the same way each expanded `DirNode` watches itself, so an
  // add/remove at the top level (not inside an expanded subfolder) refreshes too.
  const addWatchedDir = useTreeDirsStore((s) => s.add)
  const removeWatchedDir = useTreeDirsStore((s) => s.remove)
  useEffect(() => {
    addWatchedDir(rootPath)
    return () => removeWatchedDir(rootPath)
  }, [rootPath, addWatchedDir, removeWatchedDir])

  if (entries === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  const rootDirs = entries.filter((e) => e.kind === 'dir').length
  const scopeEmpty =
    scope !== undefined && scope.hiddenPaths.length === 0 && scope.pinnedPaths.length === 0
  const showScopeKickoff =
    repo !== null && scopeEmpty && rootDirs >= NOISY_ROOT_DIR_THRESHOLD && !scopeKickoffDismissed

  const handleCopyScopeSetup = async (): Promise<void> => {
    await copyText(scopeSetupPrompt())
    setCopied(true)
  }

  return (
    <div className="flex flex-col gap-1">
      {showScopeKickoff && repo !== null && (
        <SetupTip
          testId={TestIds.filesScopeSetup}
          dismissTestId={TestIds.filesScopeSetupDismiss}
          className="mx-2 mt-1"
          onDismiss={() => dismissTip(repo.path, 'scope-kickoff')}
          actions={
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-2xs"
              onClick={async () => {
                await handleCopyScopeSetup()
              }}
            >
              {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              {copied ? 'Copied' : 'Copy focus setup prompt'}
            </Button>
          }
        >
          <p className="text-2xs leading-snug text-muted-foreground">
            Large tree with no hide/pin yet. Ask your agent to focus the monorepo for you.
          </p>
        </SetupTip>
      )}
      <SidebarMenu>
        {entries.map((entry) => (
          <TreeNode key={entry.path} entry={entry} />
        ))}
      </SidebarMenu>
    </div>
  )
}

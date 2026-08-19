import type { HubTarget } from '@porcelain/client-runtime/projects'
import type { ActionView } from '@porcelain/contracts/actions'
import {
  LocalPathDialog,
  type LocalPathDialogMode,
} from '@renderer/components/terminal/local-path-dialog'
import { Button } from '@renderer/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import { SidebarGroup, SidebarGroupContent } from '@renderer/components/ui/sidebar'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useLocalDaemon, useLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ActionComposer, type ActionDraft, draftFromAction } from './action-composer'
import { ActionRow } from './action-row'
import { useActionRun } from './action-run'
import { useActionRunStore } from './action-run-store'
import { ActionTargetPicker } from './action-target-picker'
import { ActionTrustDialog } from './action-trust-dialog'
import { useTrustAction } from './actions-mutations'
import { useActions } from './actions-queries'
import { type ActionsScope, useActionsScopes, useSiblingActions } from './actions-scope'
import { WorktreeScriptsSection } from './worktree-scripts-section'

/**
 * The rows this menu is about: commands the human presses. Worktree lifecycle scripts share
 * the same store and the same trust gate, but Porcelain starts them — listing them here would
 * make every row's Play arrow mean two different things.
 */
function clickable(actions: readonly ActionView[]): ActionView[] {
  return actions.filter((action) => action.kind === 'action')
}

/** One other Environment that has the same Project — listed, never run from here. */
function SiblingEnvironment({ scope }: { scope: ActionsScope }): React.JSX.Element | null {
  const actions = clickable(useSiblingActions(scope))
  if (actions.length === 0) return null
  return (
    <div
      className="flex flex-col gap-1.5 px-1 pt-2"
      data-testid={TestIds.actionsEnvironment(scope.environmentId)}
    >
      <span className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {scope.environmentName}
      </span>
      {actions.map((action, index) => (
        <ActionRow
          key={action.id}
          action={action}
          readOnly
          onEdit={() => undefined}
          onRun={() => undefined}
          showWhere={false}
          isFirst={index === 0}
          isLast={index === actions.length - 1}
          rowsBelow={actions.length - index - 1}
        />
      ))}
      <p className="px-1 text-2xs text-muted-foreground">
        Connect this window to {scope.environmentName} to run these.
      </p>
    </div>
  )
}

/**
 * The Hub's top-corner Actions menu: the selected Project's saved commands, one click
 * from running — in a Worktree the human named. The agent curates these through the
 * MCP tools; the human runs them, and nothing runs without an explicit
 * Environment + Worktree target (#24).
 *
 * When the same Project exists on more than one Environment the menu groups by
 * Environment, so "which machine" is never a guess the reader has to make.
 */
export function ActionsGroup(): React.JSX.Element {
  const { selected, siblings } = useActionsScopes()
  const saved = useActions(true, selected?.projectId ?? null, selected?.environmentId ?? null)
  const actions = clickable(saved)
  const runAction = useActionRun()
  const selection = useHubSelectionStore((s) => s.selection)
  const localDaemon = useLocalDaemon()
  const canSpawnLocal = localDaemon !== undefined && !localDaemon.isLocal && selected !== null
  const [draft, setDraft] = useState<ActionDraft | null>(null)
  // Held while the human answers "which checkout?" for an action with no target yet.
  const [pendingTarget, setPendingTarget] = useState<ActionView | null>(null)
  // When a local-targeted action needs the folder map first. Also fed by the file
  // finder via useActionRunStore (compose-intent).
  const [pendingLocal, setPendingLocal] = useState<{
    action: ActionView
    target: HubTarget
  } | null>(null)
  // Held while the human reads a command they have not run here before.
  const [pendingTrust, setPendingTrust] = useState<ActionView | null>(null)
  const trustAction = useTrustAction()
  const [mappingMode, setMappingMode] = useState<LocalPathDialogMode | null>(null)
  const storePending = useActionRunStore((s) => s.pendingLocal)
  const clearStorePending = useActionRunStore((s) => s.clearPendingLocal)
  const mappedLocalPath = useLocalTerminalPath(pendingLocal?.target.path ?? null)

  /**
   * The selection is a usable target only when it names a Worktree of the Project
   * this menu is showing — selecting a sibling Project must never retarget a run.
   */
  const selectionTarget: HubTarget | null =
    selection.kind === 'worktree' && selection.projectId === selected?.projectId
      ? {
          environmentId: selection.environmentId,
          projectId: selection.projectId,
          worktreeId: selection.worktreeId,
          path: selection.path,
        }
      : null

  useEffect(() => {
    if (storePending === null) return
    if (selectionTarget === null) {
      setPendingTarget(storePending)
    } else {
      setPendingLocal({ action: storePending, target: selectionTarget })
      setMappingMode('run')
    }
    clearStorePending()
  }, [storePending, clearStorePending, selectionTarget])

  const spawn = (action: ActionView, target: HubTarget, localPath?: string | null): void => {
    runUserAction(
      async () => {
        const result = await runAction(action, { target, localPath })
        if (result === 'needs-local-path') {
          setPendingLocal({ action, target })
          setMappingMode('run')
        }
        if (result === 'needs-target') setPendingTarget(action)
      },
      (error) => {
        toastUserActionError('Run command', error)
      },
    )
  }

  /**
   * A command this machine has never accepted goes to the review step instead of a
   * shell; a run with no Worktree goes to the picker. Everything already accepted and
   * targeted runs exactly as before — the gates must cost nothing on the path people
   * use fifty times a day, or they train people to click through them.
   */
  const startNew = (): void => {
    setDraft({ title: '', command: '', where: 'primary' })
  }

  const handleRun = (action: ActionView): void => {
    if (!action.trusted) {
      setPendingTrust(action)
      return
    }
    if (selectionTarget === null) {
      setPendingTarget(action)
      return
    }
    spawn(action, selectionTarget)
  }

  if (selected === null) {
    return (
      <SidebarGroup className="px-3">
        <p
          className="px-1 py-2 text-xs text-muted-foreground"
          data-testid={TestIds.actionsNoProject}
        >
          Select a Project to see its saved commands.
        </p>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup className="px-3">
      {actions.length === 0 ? (
        <Empty className="min-h-0 p-4" data-testid={TestIds.actionsEmpty}>
          <EmptyMedia>
            <Zap />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No actions yet</EmptyTitle>
            <EmptyDescription>
              Add a dev server, a test watcher, or anything you need to run in the terminal. Agents
              can add them here too.
            </EmptyDescription>
          </EmptyHeader>
          {selected.current && (
            <EmptyContent>
              <Button size="sm" data-testid={TestIds.actionsAdd} onClick={startNew}>
                Add action
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <div className="flex items-center justify-end px-1">
            {selected.current && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-2xs"
                data-testid={TestIds.actionsAdd}
                onClick={startNew}
              >
                Add action
              </Button>
            )}
          </div>
          <SidebarGroupContent className="flex flex-col gap-1.5 px-1">
            {actions.map((action, index) => (
              <ActionRow
                key={action.id}
                action={action}
                readOnly={!selected.current}
                onEdit={(a: ActionView): void => setDraft(draftFromAction(a))}
                onRun={handleRun}
                showWhere={canSpawnLocal}
                isFirst={index === 0}
                isLast={index === actions.length - 1}
                rowsBelow={actions.length - index - 1}
              />
            ))}
          </SidebarGroupContent>
        </>
      )}
      <WorktreeScriptsSection actions={saved} editable={selected.current} />
      {siblings.map((scope) => (
        <SiblingEnvironment key={scope.environmentId} scope={scope} />
      ))}
      <ActionTargetPicker
        open={pendingTarget !== null}
        actionTitle={pendingTarget?.title ?? ''}
        environmentName={selected.environmentName}
        worktrees={selected.worktrees}
        onCancel={() => setPendingTarget(null)}
        onPick={(worktree) => {
          const action = pendingTarget
          setPendingTarget(null)
          if (action === null) return
          spawn(action, {
            environmentId: selected.environmentId,
            projectId: selected.projectId,
            worktreeId: worktree.id,
            path: worktree.path,
          })
        }}
      />
      <ActionTrustDialog
        action={pendingTrust}
        onCancel={() => setPendingTrust(null)}
        onTrust={(action: ActionView): void => {
          setPendingTrust(null)
          runUserAction(
            async () => {
              await trustAction(action.id)
              // List refetch is async; the run path requires trusted — pass explicit true.
              const trusted = { ...action, trusted: true }
              if (selectionTarget === null) setPendingTarget(trusted)
              else spawn(trusted, selectionTarget)
            },
            (error) => {
              toastUserActionError('Accept command', error)
            },
          )
        }}
      />
      <ActionComposer
        draft={draft}
        open={draft !== null}
        showWhere={canSpawnLocal}
        onOpenChange={(open: boolean): void => {
          if (!open) setDraft(null)
        }}
      />
      {mappingMode && pendingLocal && (
        <LocalPathDialog
          key={`run:${pendingLocal.action.id}`}
          repoPath={pendingLocal.target.path}
          initialPath={mappedLocalPath ?? null}
          mode={mappingMode}
          onSaved={(localPath: string): void => {
            const pending = pendingLocal
            setPendingLocal(null)
            setMappingMode(null)
            spawn(pending.action, pending.target, localPath)
          }}
          onClose={() => {
            setPendingLocal(null)
            setMappingMode(null)
          }}
        />
      )}
    </SidebarGroup>
  )
}

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

/**
 * The rows this menu is about: commands the human presses. Worktree lifecycle scripts share
 * the same store and the same trust gate, but Porcelain starts them — listing them here would
 * make every row's Play arrow mean two different things.
 */
function clickable(actions: readonly ActionView[]): ActionView[] {
  return actions.filter((action) => action.kind === 'action')
}

/** One other Environment that has the same Project. Play targets it without changing review scope. */
function SiblingEnvironment({
  scope,
  onRun,
}: {
  scope: ActionsScope
  onRun: (action: ActionView, scope: ActionsScope) => void
}): React.JSX.Element | null {
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
          runOnly
          onEdit={() => undefined}
          onRun={(selectedAction) => onRun(selectedAction, scope)}
          showWhere={false}
          isFirst={index === 0}
          isLast={index === actions.length - 1}
          rowsBelow={actions.length - index - 1}
        />
      ))}
      <p className="px-1 text-2xs text-muted-foreground">Select it to manage these Actions.</p>
    </div>
  )
}

/**
 * The Hub's top-corner Actions menu: the selected Project's saved commands, one click
 * from running — in a Worktree the human named. The agent curates these through the
 * MCP tools; the human runs them, and nothing runs without an explicit
 * Environment + Worktree target.
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
  const [pendingTarget, setPendingTarget] = useState<{
    action: ActionView
    scope: ActionsScope
  } | null>(null)
  // When a local-targeted action needs the folder map first. Also fed by the file
  // finder via useActionRunStore (compose-intent).
  const [pendingLocal, setPendingLocal] = useState<{
    action: ActionView
    target: HubTarget
  } | null>(null)
  // Held while the human reads a command they have not run here before.
  const [pendingTrust, setPendingTrust] = useState<{
    action: ActionView
    scope: ActionsScope
  } | null>(null)
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
      if (selected !== null) setPendingTarget({ action: storePending, scope: selected })
    } else {
      setPendingLocal({ action: storePending, target: selectionTarget })
      setMappingMode('run')
    }
    clearStorePending()
  }, [storePending, clearStorePending, selected, selectionTarget])

  const spawn = (action: ActionView, target: HubTarget, localPath?: string | null): void => {
    runUserAction(
      async () => {
        const result = await runAction(action, { target, localPath })
        if (result === 'needs-local-path') {
          setPendingLocal({ action, target })
          setMappingMode('run')
        }
        if (result === 'needs-target' && selected !== null) {
          setPendingTarget({ action, scope: selected })
        }
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

  const handleRun = (action: ActionView, scope?: ActionsScope): void => {
    const actionScope = scope ?? selected
    if (actionScope === null) return
    if (!action.trusted) {
      setPendingTrust({ action, scope: actionScope })
      return
    }
    const implicitTarget =
      actionScope.environmentId === selectionTarget?.environmentId &&
      actionScope.projectId === selectionTarget.projectId
        ? selectionTarget
        : null
    if (implicitTarget === null) {
      setPendingTarget({ action, scope: actionScope })
      return
    }
    spawn(action, implicitTarget)
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
          <EmptyContent>
            <Button size="sm" data-testid={TestIds.actionsAdd} onClick={startNew}>
              Add action
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex items-center justify-end px-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-2xs"
              data-testid={TestIds.actionsAdd}
              onClick={startNew}
            >
              Add action
            </Button>
          </div>
          <SidebarGroupContent className="flex flex-col gap-1.5 px-1">
            {actions.map((action, index) => (
              <ActionRow
                key={action.id}
                action={action}
                readOnly={false}
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
      {siblings.map((scope) => (
        <SiblingEnvironment key={scope.environmentId} scope={scope} onRun={handleRun} />
      ))}
      <ActionTargetPicker
        open={pendingTarget !== null}
        actionTitle={pendingTarget?.action.title ?? ''}
        environmentName={pendingTarget?.scope.environmentName ?? ''}
        worktrees={pendingTarget?.scope.worktrees ?? []}
        onCancel={() => setPendingTarget(null)}
        onPick={(worktree) => {
          const pending = pendingTarget
          setPendingTarget(null)
          if (pending === null) return
          spawn(pending.action, {
            environmentId: pending.scope.environmentId,
            projectId: pending.scope.projectId,
            worktreeId: worktree.id,
            path: worktree.path,
          })
        }}
      />
      <ActionTrustDialog
        action={pendingTrust?.action ?? null}
        environmentName={pendingTrust?.scope.environmentName}
        onCancel={() => setPendingTrust(null)}
        onTrust={(action: ActionView): void => {
          const pending = pendingTrust
          if (pending === null) return
          setPendingTrust(null)
          runUserAction(
            async () => {
              const scope = pending.scope
              await trustAction(action.id, {
                environmentId: scope.environmentId,
                projectId: scope.projectId,
              })
              // List refetch is async; the run path requires trusted — pass explicit true.
              const trusted = { ...action, trusted: true }
              const implicitTarget =
                scope.environmentId === selectionTarget?.environmentId &&
                scope.projectId === selectionTarget.projectId
                  ? selectionTarget
                  : null
              if (implicitTarget === null) setPendingTarget({ action: trusted, scope })
              else spawn(trusted, implicitTarget)
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

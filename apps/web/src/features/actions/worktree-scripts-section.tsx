import type { ActionView, WorktreeScriptKind } from '@porcelain/contracts/actions'
import { Button } from '@renderer/components/ui/button'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { cn } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'
import { ActionComposer, type ActionDraft, draftFromAction } from './action-composer'
import { ActionRow } from './action-row'
import { ActionTrustDialog } from './action-trust-dialog'
import type { ActionMutationTarget } from './actions-mutations'
import { useTrustAction } from './actions-mutations'

/**
 * The Worktree lifecycle scripts of the selected Project: what Porcelain runs for the human
 * when a Worktree is created, and what it runs before one is removed.
 *
 * They live in the Actions store beside the Actions and are curated the same way (edit,
 * reorder, duplicate, delete, accept). They are shown apart because clicking is not what
 * starts them — Actions are the things the human presses, and mixing an automatic command
 * into that list makes the list lie about what a click does.
 */

const SECTIONS: ReadonlyArray<{ kind: WorktreeScriptKind; title: string; blurb: string }> = [
  {
    kind: 'worktree-setup',
    title: 'On create',
    blurb: 'Runs in a terminal in the new Worktree, in this order.',
  },
  {
    kind: 'worktree-dispose',
    title: 'On remove',
    blurb: 'Runs before the checkout is deleted; removal waits for it.',
  },
]

function ScriptList({
  kind,
  title,
  blurb,
  scripts,
  editable,
  onEdit,
  onNew,
  onAccept,
  mutationTarget,
}: {
  kind: WorktreeScriptKind
  title: string
  blurb: string
  scripts: readonly ActionView[]
  editable: boolean
  onEdit: (action: ActionView) => void
  onNew: () => void
  onAccept: (action: ActionView) => void
  mutationTarget: ActionMutationTarget
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 px-1 pt-2" data-testid={TestIds.actionsScripts(kind)}>
      <div className="flex items-center justify-between gap-2">
        <span className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </span>
        {editable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-2xs"
            data-testid={TestIds.actionsScriptAdd(kind)}
            onClick={onNew}
          >
            Add script
          </Button>
        )}
      </div>
      {scripts.map((script, index) => (
        <ActionRow
          key={script.id}
          action={script}
          lifecycle
          readOnly={!editable}
          onEdit={onEdit}
          onRun={onAccept}
          showWhere={false}
          isFirst={index === 0}
          isLast={index === scripts.length - 1}
          rowsBelow={scripts.length - 1 - index}
          mutationTarget={mutationTarget}
        />
      ))}
      <p className="px-1 text-2xs text-muted-foreground">{blurb}</p>
    </div>
  )
}

export function WorktreeScriptsSection({
  actions,
  editable,
  showHeading = true,
  mutationTarget,
}: {
  /** The Project's full saved list; this component takes only the two script roles from it. */
  actions: readonly ActionView[]
  editable: boolean
  /** False where the host already says what this is — the dialog raised from the tree. */
  showHeading?: boolean
  mutationTarget: ActionMutationTarget
}): React.JSX.Element {
  const [draft, setDraft] = useState<ActionDraft | null>(null)
  // A lifecycle row has nothing to run on click, so accepting its command is the whole
  // interaction — the dialog must end here rather than chaining into a spawn like Actions do.
  const [pendingTrust, setPendingTrust] = useState<ActionView | null>(null)
  const trustAction = useTrustAction(mutationTarget)

  return (
    <div
      className={cn('flex flex-col', showHeading && 'border-t pt-1')}
      data-testid={TestIds.actionsScriptsSection}
    >
      {showHeading && (
        <span className="px-2 pt-2 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Worktree scripts
        </span>
      )}
      {SECTIONS.map((section) => (
        <ScriptList
          key={section.kind}
          kind={section.kind}
          title={section.title}
          blurb={section.blurb}
          editable={editable}
          scripts={actions.filter((action) => action.kind === section.kind)}
          onEdit={(action) => setDraft(draftFromAction(action))}
          onNew={() => setDraft({ title: '', command: '', where: 'primary', kind: section.kind })}
          onAccept={(action) => {
            if (action.trusted) return
            setPendingTrust(action)
          }}
          mutationTarget={mutationTarget}
        />
      ))}
      <ActionTrustDialog
        action={pendingTrust}
        onCancel={() => setPendingTrust(null)}
        onTrust={(action: ActionView): void => {
          setPendingTrust(null)
          runUserAction(
            () => trustAction(action.id),
            (error) => {
              toastUserActionError('Accept command', error)
            },
          )
        }}
      />
      <ActionComposer
        draft={draft}
        open={draft !== null}
        showWhere={false}
        mutationTarget={mutationTarget}
        onOpenChange={(open: boolean): void => {
          if (!open) setDraft(null)
        }}
      />
    </div>
  )
}

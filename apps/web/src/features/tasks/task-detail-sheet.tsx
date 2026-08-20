import type { TaskRow } from '@porcelain/client-runtime/tasks'
import { Button } from '@renderer/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@renderer/components/ui/sheet'
import { toastingAction } from '@renderer/hooks/mutation-error'
import { compactButtonClass } from '@renderer/lib/controls'
import { trpc } from '@renderer/lib/trpc'
import { TestIds } from '@shared/test-ids'
import { useQueries } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  composerTags,
  emptyComposerValue,
  TaskComposer,
  type TaskComposerValue,
} from './task-composer'
import { liftCompletedTokens } from './task-mentions'
import { useTaskActions } from './tasks-mutations'

function draftFromRow(row: TaskRow): TaskComposerValue {
  const lifted = liftCompletedTokens(row.task.notes ?? '', Number.MAX_SAFE_INTEGER)
  const projectId = row.task.references.projectId
  const worktreeId = row.task.references.worktreeId
  const pathRefs = [...row.task.pathRefs]
  if (projectId !== undefined && worktreeId !== undefined) {
    for (const path of lifted.paths) {
      if (pathRefs.some((entry) => entry.path === path)) continue
      pathRefs.push({ projectId, worktreeId, path, kind: path.endsWith('/') ? 'folder' : 'file' })
    }
  }
  const links = [...row.task.links]
  for (const link of lifted.links) {
    if (links.some((entry) => entry.url === link.url)) continue
    links.push(link)
  }
  return {
    title: row.task.title,
    notes: lifted.notes.trim(),
    projectId: projectId ?? null,
    worktreeId: worktreeId ?? null,
    pathRefs,
    tags: [...row.task.tags, ...lifted.tags.filter((tag) => !row.task.tags.includes(tag))],
    links,
    uploads: [],
  }
}

// A fresh [] default per render would change identity for the composer below.
const NO_TAGS: readonly string[] = []

export type TaskDetailSheetProps = {
  row: TaskRow | null
  onClose: () => void
  knownTags?: readonly string[]
}

export function TaskDetailSheet({
  row,
  onClose,
  knownTags = NO_TAGS,
}: TaskDetailSheetProps): React.JSX.Element {
  const actions = useTaskActions()
  const utils = trpc.useUtils()
  const [draft, setDraft] = useState<TaskComposerValue>(
    row === null ? emptyComposerValue() : draftFromRow(row),
  )
  const [removedIds, setRemovedIds] = useState<string[]>([])

  useEffect(() => {
    if (row === null) return
    setDraft(draftFromRow(row))
    setRemovedIds([])
  }, [row])

  const pictures = useQueries({
    queries: (row?.task.attachments ?? [])
      .filter((attachment) => !removedIds.includes(attachment.id))
      .map((attachment) => ({
        enabled: row !== null,
        queryKey: ['tasks', 'attachment', row?.task.id, attachment.id],
        queryFn: async () =>
          utils.client.getTaskAttachment.query({
            taskId: row?.task.id ?? '',
            attachmentId: attachment.id,
          }),
      })),
  })

  const save = (): void => {
    if (row === null) return
    const title = draft.title.trim()
    if (title === '') return
    toastingAction('Update Task', () =>
      actions.update(row.environmentId, {
        taskId: row.task.id,
        title,
        notes: draft.notes,
        references:
          draft.projectId === null
            ? {}
            : draft.worktreeId === null
              ? { projectId: draft.projectId }
              : { projectId: draft.projectId, worktreeId: draft.worktreeId },
        pathRefs: draft.pathRefs,
        tags: composerTags(draft),
        links: draft.links,
        ...(draft.uploads.length > 0
          ? {
              attachmentUploads: draft.uploads.map((upload) => ({
                name: upload.name,
                contentBase64: upload.contentBase64,
              })),
            }
          : {}),
        ...(removedIds.length > 0 ? { removeAttachmentIds: removedIds } : {}),
      }),
    )()
    onClose()
  }

  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md" data-testid={TestIds.tasksSheet}>
        <SheetHeader>
          <SheetTitle>{row?.task.shortId ?? 'Task'}</SheetTitle>
          <SheetDescription>Pictures, file tags, and notes for this Task.</SheetDescription>
        </SheetHeader>
        {row !== null && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-6">
            <TaskComposer
              value={draft}
              onChange={setDraft}
              // An existing Task already belongs to an Environment and cannot be moved, so
              // the picker offers only that machine's Projects. Editing one was the other
              // half of filing against a checkout the receiving daemon has never seen.
              environment={{ kind: 'environment', environmentId: row.environmentId }}
              existingPictures={pictures.flatMap((query, index) => {
                const attachment = row.task.attachments.filter(
                  (item) => !removedIds.includes(item.id),
                )[index]
                if (attachment === undefined) return []
                return [
                  {
                    id: attachment.id,
                    name: attachment.name,
                    previewUrl: query.data?.dataUrl,
                  },
                ]
              })}
              onRemoveExisting={(id) => setRemovedIds((current) => [...current, id])}
              knownTags={knownTags}
            />
          </div>
        )}
        <SheetFooter>
          <Button className={compactButtonClass} disabled={actions.isPending} onClick={save}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

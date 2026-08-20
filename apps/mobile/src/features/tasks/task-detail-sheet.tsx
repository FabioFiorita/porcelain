import { TASK_STATUSES, type TaskStatus } from '@porcelain/contracts/tasks'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking, Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { SegmentedControl } from '@/components/native/segmented-control'
import { EmptyNote, ErrorNote, PanelLabel } from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { useHubInventories } from '@/features/projects'
import { cn } from '@/lib/utils'

import { TaskAttachments } from './task-attachments'
import { TaskHeaderAction } from './task-header-action'
import { formatWhen, projectNamesFrom } from './task-match'
import { TASK_STATUS_LABELS } from './task-status-scope'
import { useTaskActions } from './tasks-mutations'
import { useTaskRow } from './tasks-queries'

/**
 * One Task, opened from the board: what it says, and the two things this screen can change.
 *
 * The editable set is title, status and notes — Web's row status menu and the notes half of its
 * composer. Tags, links, file tags and pictures are SHOWN but not edited here: Web edits them
 * through a mentions-and-markdown composer with an `@` picker and paste-to-upload, and a
 * half-built version of that on a phone would lose data rather than mirror it.
 *
 * Edits are an OVERLAY on the live row rather than a copy of it. `useTaskRow` re-reads the
 * board, so a `tasks.changed` arriving while this is open updates every field the person has
 * not touched, and cannot silently revert one they have.
 */
export function TaskDetailSheet({
  environmentId,
  taskId,
}: {
  environmentId: string
  taskId: string
}): React.JSX.Element {
  const router = useRouter()
  const row = useTaskRow(taskId, environmentId)
  const actions = useTaskActions()
  const projectNames = projectNamesFrom(useHubInventories())
  const [edits, setEdits] = useState<{
    title?: string
    notes?: string
    status?: TaskStatus
  }>({})
  const [error, setError] = useState<string | null>(null)

  if (row === null) {
    return (
      <View className="flex-1 bg-background" testID="porcelain-task-detail">
        <EmptyNote
          body="Its Environment may be unreachable, or it was deleted somewhere else."
          testID="porcelain-task-missing"
          title="This Task is not on the board"
        />
      </View>
    )
  }

  const task = row.task
  const title = edits.title ?? task.title
  const notes = edits.notes ?? task.notes ?? ''
  const status = edits.status ?? task.status
  const projectId = task.references.projectId
  const projectName = projectId === undefined ? null : (projectNames[projectId] ?? projectId)

  const save = (): void => {
    const trimmed = title.trim()
    if (trimmed === '') {
      setError('A Task needs a title.')
      return
    }
    setError(null)
    void actions
      .update(environmentId, { notes, status, taskId: task.id, title: trimmed })
      .then(() => {
        router.back()
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not save that Task.')
      })
  }

  return (
    <View className="flex-1 bg-background" testID="porcelain-task-detail">
      <Stack.Screen
        options={{
          headerRight: () => (
            <TaskHeaderAction
              disabled={actions.isPending}
              label="Save"
              testID="porcelain-task-save"
              onPress={save}
            />
          ),
          title: task.shortId,
        }}
      />
      <SurfaceScroll gap={12} paddingTop={12}>
        {error === null ? null : <ErrorNote message={error} testID="porcelain-task-error" />}

        <View className="gap-1.5">
          <PanelLabel>Title</PanelLabel>
          <Input
            accessibilityLabel="Task title"
            testID="porcelain-task-title"
            value={title}
            onChangeText={(next) => {
              setEdits((current) => ({ ...current, title: next }))
            }}
          />
        </View>

        <View className="gap-1.5">
          <PanelLabel>Status</PanelLabel>
          <SegmentedControl
            disabled={actions.isPending}
            options={TASK_STATUSES.map((entry) => ({
              label: TASK_STATUS_LABELS[entry],
              testID: `porcelain-task-status-${entry}`,
              value: entry,
            }))}
            testID="porcelain-task-status"
            value={status}
            onChange={(next) => {
              setEdits((current) => ({ ...current, status: next }))
            }}
          />
        </View>

        <View className="gap-1.5">
          <PanelLabel>Notes</PanelLabel>
          <Textarea
            accessibilityLabel="Task notes"
            placeholder="Markdown, and optional."
            testID="porcelain-task-notes"
            value={notes}
            onChangeText={(next) => {
              setEdits((current) => ({ ...current, notes: next }))
            }}
          />
        </View>

        {task.tags.length === 0 ? null : (
          <View className="gap-1.5">
            <PanelLabel>Tags</PanelLabel>
            <View className="flex-row flex-wrap gap-1.5" testID="porcelain-task-tags">
              {task.tags.map((tag) => (
                <View className="rounded-full bg-muted px-2 py-0.5" key={tag}>
                  <Text className="text-3xs text-muted-foreground">{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {task.links.length === 0 ? null : (
          <View className="gap-1.5">
            <PanelLabel>Links</PanelLabel>
            <View className={cn(PANEL_CARD, 'gap-0.5 p-1')} testID="porcelain-task-links">
              {task.links.map((link) => (
                <Pressable
                  accessibilityLabel={link.label}
                  accessibilityRole="link"
                  className="min-h-11 flex-row items-center gap-2 rounded-xl px-2 active:bg-accent"
                  key={link.url}
                  testID={`porcelain-task-link-${link.url}`}
                  onPress={() => {
                    // The contract already refuses anything but http(s), so the host opens it.
                    void Linking.openURL(link.url)
                  }}
                >
                  <ChromeGlyph name="network" size={13} tone="muted" />
                  <Text className="min-w-0 flex-1 text-xs text-foreground" numberOfLines={1}>
                    {link.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {task.pathRefs.length === 0 ? null : (
          <View className="gap-1.5">
            <PanelLabel>Files</PanelLabel>
            <View className={cn(PANEL_CARD, 'gap-1 p-2.5')} testID="porcelain-task-paths">
              {task.pathRefs.map((ref) => (
                <Text
                  className="font-mono text-3xs text-muted-foreground"
                  key={`${ref.worktreeId}:${ref.path}`}
                  numberOfLines={1}
                >
                  {ref.path}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View className="gap-1.5">
          <PanelLabel>Where it lives</PanelLabel>
          <View className={cn(PANEL_CARD, 'gap-1 p-2.5')} testID="porcelain-task-where">
            <DetailLine label="Environment" value={row.environmentName} />
            <DetailLine label="Project" value={projectName ?? 'Not filed against a Project'} />
            {task.references.worktreeId === undefined ? null : (
              <DetailLine label="Worktree" value={task.references.worktreeId} />
            )}
            <DetailLine label="Updated" value={formatWhen(task.updatedAt)} />
            <DetailLine label="Created" value={formatWhen(task.createdAt)} />
          </View>
        </View>

        <TaskAttachments environmentId={environmentId} task={task} />
      </SurfaceScroll>
    </View>
  )
}

function DetailLine({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-3">
      <Text className="shrink-0 text-3xs text-muted-foreground">{label}</Text>
      <Text className="min-w-0 flex-1 text-right text-xs text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

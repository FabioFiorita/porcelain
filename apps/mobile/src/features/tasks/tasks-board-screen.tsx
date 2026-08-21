import type { TaskRow } from '@porcelain/client-runtime/tasks'
import { TASK_STATUS_LABELS, taskMatchesQuery } from '@porcelain/client-runtime/tasks'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  EmptyNote,
  ErrorNote,
  PanelLabel,
  ScreenHeader,
  SearchField,
} from '@/components/panel-chrome'
import {
  SURFACE_GUTTER,
  SURFACE_NOTE,
  SURFACE_ROW,
  SURFACE_STACK_GAP,
  SURFACE_TOOLBAR,
} from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Text } from '@/components/ui/text'
import { useHubInventories } from '@/features/projects'
import { cn } from '@/lib/utils'

import { formatWhen, projectNamesFrom } from './task-match'
import { NewTaskHeaderAction } from './tasks-header-actions'
import {
  DEFAULT_TASK_STATUS_SCOPE,
  groupRowsByStatus,
  type TaskStatusScope,
  taskStatusScopeOptions,
} from './task-status-scope'
import { useTasks } from './tasks-queries'

/**
 * The Tasks board — every paired Environment's daemon-wide table in one list.
 *
 * Web draws a configurable table; a phone draws status sections of cards. The two agree on the
 * things that are decisions rather than layout: Done is hidden until asked for, the Environment
 * is a label that only appears when more than one can be reached, and only fields `taskSchema`
 * actually carries are printed — there is no priority, no assignee and no due date on the wire,
 * so there is none on the card.
 *
 * Search is a `SearchField` in the toolbar band, the same place the web client puts it. The
 * filter it drives is `taskMatchesQuery`, the one implementation Web filters with too. The phone
 * adds the Environment label to what it searches, because this board lists every paired
 * Environment at once and the Viewer is already standing inside one.
 */
export function TasksBoardScreen(): React.JSX.Element {
  const { rows, environments, error, isLoaded } = useTasks()
  const projectNames = projectNamesFrom(useHubInventories())
  const [scope, setScope] = useState<TaskStatusScope>(DEFAULT_TASK_STATUS_SCOPE)
  const [query, setQuery] = useState('')

  const matched = rows.filter((row) =>
    taskMatchesQuery(row, query, projectNames, [row.environmentName]),
  )
  const groups = groupRowsByStatus(matched, scope)
  const shown = groups.reduce((total, group) => total + group.rows.length, 0)
  // The same gate Web puts on its Environment column: one Environment would print the same
  // name on every card, which is noise rather than information.
  const multiEnvironment = environments.length > 1

  return (
    <View className="flex-1 bg-background" testID="porcelain-tasks-screen">
      <ScreenHeader
        actions={<NewTaskHeaderAction />}
        testID="porcelain-tasks-header"
        title="Tasks"
      />
      <View className={cn(SURFACE_TOOLBAR, SURFACE_STACK_GAP)}>
        <SearchField
          placeholder="Filter by anything…"
          testID="porcelain-tasks-search"
          value={query}
          onChangeText={setQuery}
        />
        <SegmentedControl
          options={taskStatusScopeOptions()}
          testID="porcelain-tasks-scope"
          value={scope}
          onChange={setScope}
        />
      </View>
      {error === null ? null : (
        <View className={SURFACE_NOTE}>
          <ErrorNote
            message={`Couldn't load Tasks. ${error.message}`}
            testID="porcelain-tasks-error"
          />
        </View>
      )}
      <SurfaceScroll gap={4} paddingTop={4}>
        {error === null && isLoaded && rows.length === 0 ? (
          <EmptyNote
            body="Tasks are daemon-wide. Add one with the plus, or file it from the desktop — it shows up here."
            testID="porcelain-tasks-empty"
            title="No Tasks yet"
          />
        ) : null}
        {error === null && rows.length > 0 && shown === 0 ? (
          <EmptyNote
            body={
              scope === 'done'
                ? 'No Tasks match this filter.'
                : 'No Tasks match this filter. Done Tasks are hidden until the control asks for them.'
            }
            testID="porcelain-tasks-no-matches"
            title="Nothing here"
          />
        ) : null}
        {groups.map((group) => (
          <View key={group.status} testID={`porcelain-tasks-group-${group.status}`}>
            <View className={cn(SURFACE_GUTTER, 'flex-row items-center gap-2 py-2')}>
              <PanelLabel>{TASK_STATUS_LABELS[group.status]}</PanelLabel>
              <Text className="text-2xs text-muted-foreground">{group.rows.length}</Text>
            </View>
            {group.rows.map((row) => (
              <TaskCard
                key={`${row.environmentId}:${row.task.id}`}
                projectNames={projectNames}
                row={row}
                showEnvironment={multiEnvironment}
              />
            ))}
          </View>
        ))}
      </SurfaceScroll>
    </View>
  )
}

/**
 * One Task. The fields are Web's default visible columns — id, title, project, environment,
 * links, updated — minus status, which is the section this card sits in rather than a badge
 * repeated on every row.
 */
function TaskCard({
  projectNames,
  row,
  showEnvironment,
}: {
  projectNames: Readonly<Record<string, string>>
  row: TaskRow
  showEnvironment: boolean
}): React.JSX.Element {
  const router = useRouter()
  const projectId = row.task.references.projectId
  // The raw id when the owning Environment is unreachable: a name this device cannot confirm
  // would be a guess about which repository the Task belongs to.
  const projectName = projectId === undefined ? null : (projectNames[projectId] ?? projectId)

  return (
    <Pressable
      accessibilityLabel={`Task ${row.task.shortId} ${row.task.title}`}
      accessibilityRole="button"
      className={SURFACE_ROW}
      testID={`porcelain-task-${row.task.id}`}
      onPress={() => {
        // The Environment rides in the URL because every write has to name the daemon it goes
        // to, and a detail screen that had to guess is how a Task gets edited on the wrong one.
        router.push({
          params: { environment: row.environmentId, id: row.task.id },
          pathname: '/tasks/[id]',
        })
      }}
    >
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text className="font-mono text-3xs text-muted-foreground">{row.task.shortId}</Text>
            <Text className="min-w-0 flex-1 text-sm font-medium text-foreground" numberOfLines={2}>
              {row.task.title}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {projectName === null ? null : (
              <Text className="shrink text-3xs text-muted-foreground" numberOfLines={1}>
                {projectName}
              </Text>
            )}
            {showEnvironment ? (
              <Text className="shrink-0 text-3xs text-muted-foreground" numberOfLines={1}>
                {row.environmentName}
              </Text>
            ) : null}
            {row.task.links.length > 0 ? (
              <ChromeGlyph name="network" size={10} tone="muted" />
            ) : null}
            {row.task.attachments.length > 0 ? (
              <ChromeGlyph name="image" size={10} tone="muted" />
            ) : null}
            <Text className="ml-auto shrink-0 text-3xs text-muted-foreground" numberOfLines={1}>
              {formatWhen(row.task.updatedAt)}
            </Text>
          </View>
        </View>
        <ChromeGlyph name="chevronRight" size={11} tone="muted" />
      </View>
    </Pressable>
  )
}

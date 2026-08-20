import type { CreateTaskInput } from '@porcelain/contracts/tasks'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ErrorNote, PanelLabel } from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { useHubInventories } from '@/features/projects'
import { cn } from '@/lib/utils'

import { TaskHeaderAction } from './task-header-action'
import { MissingEnvironmentTargetError, useTaskActions } from './tasks-mutations'
import { useTasks } from './tasks-queries'

/**
 * Compose a Task: a title, optional notes, and where it goes.
 *
 * Two pickers, both of them Web's rules rather than mobile inventions:
 *
 *   - The **Environment** is asked for only when more than one can be reached. A board showing
 *     three machines has no "current" daemon to fall back on, so an unchosen target is refused
 *     (`MissingEnvironmentTargetError`) instead of guessed — guessing is how a Task lands on
 *     the wrong machine.
 *   - The **Project** list belongs to the chosen Environment. Every Project is one daemon's,
 *     and a flat list across daemons cannot say whose; switching Environments therefore CLEARS
 *     the Project rather than carrying it across, because a reference that survived the switch
 *     names a repository the receiving daemon has never seen.
 *
 * No status control: Web's create dialog has none either, and the daemon owns the default. No
 * tags, links, file tags or pictures — those are the composer's, and the composer is not here.
 */
export function NewTaskSheet(): React.JSX.Element {
  const router = useRouter()
  const { environments } = useTasks()
  const inventories = useHubInventories()
  const actions = useTaskActions()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const multiEnvironment = environments.length > 1
  // One Environment means there is nothing to choose, so no control appears and the sole
  // Environment is the target. `undefined` on a multi-Environment board is the refusable case.
  const target = multiEnvironment ? chosen : environments[0]?.id
  const projects =
    target === undefined
      ? []
      : (inventories.find((entry) => entry.environment.id === target)?.inventory.projects ?? [])

  const retarget = (next: string): void => {
    if (next === chosen) return
    setChosen(next)
    setProjectId(null)
  }

  const submit = (): void => {
    const trimmed = title.trim()
    if (trimmed === '') {
      setError('A Task needs a title.')
      return
    }
    setError(null)
    const input: CreateTaskInput = {
      title: trimmed,
      ...(notes.trim() === '' ? {} : { notes: notes.trim() }),
      ...(projectId === null ? {} : { references: { projectId } }),
    }
    void actions
      .add(target, input)
      .then(() => {
        router.back()
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof MissingEnvironmentTargetError
            ? reason.message
            : reason instanceof Error
              ? reason.message
              : 'Could not create that Task.',
        )
      })
  }

  return (
    <View className="flex-1 bg-background" testID="porcelain-new-task">
      <Stack.Screen
        options={{
          headerRight: () => (
            <TaskHeaderAction
              disabled={actions.isPending}
              label="Add"
              testID="porcelain-new-task-submit"
              onPress={submit}
            />
          ),
        }}
      />
      <SurfaceScroll gap={12} paddingTop={12}>
        {error === null ? null : <ErrorNote message={error} testID="porcelain-new-task-error" />}

        <View className="gap-1.5">
          <PanelLabel>Title</PanelLabel>
          <Input
            accessibilityLabel="Task title"
            autoFocus
            placeholder="What needs doing?"
            testID="porcelain-new-task-title"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View className="gap-1.5">
          <PanelLabel>Notes</PanelLabel>
          <Textarea
            accessibilityLabel="Task notes"
            placeholder="Markdown, and optional."
            testID="porcelain-new-task-notes"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {multiEnvironment ? (
          <View className="gap-1.5">
            <PanelLabel>Environment</PanelLabel>
            <ChoiceList testID="porcelain-new-task-environment">
              {environments.map((environment) => (
                <ChoiceRow
                  key={environment.id}
                  label={environment.name}
                  selected={target === environment.id}
                  testID={`porcelain-new-task-environment-${environment.id}`}
                  onPress={() => {
                    retarget(environment.id)
                  }}
                />
              ))}
            </ChoiceList>
          </View>
        ) : null}

        <View className="gap-1.5">
          <PanelLabel>Project</PanelLabel>
          {target === undefined ? (
            <Text className="text-xs text-muted-foreground">
              Choose an Environment to see its Projects.
            </Text>
          ) : (
            <ChoiceList testID="porcelain-new-task-project">
              <ChoiceRow
                label="No Project"
                selected={projectId === null}
                testID="porcelain-new-task-project-none"
                onPress={() => {
                  setProjectId(null)
                }}
              />
              {projects.map((project) => (
                <ChoiceRow
                  key={project.id}
                  label={project.name}
                  selected={projectId === project.id}
                  testID={`porcelain-new-task-project-${project.id}`}
                  onPress={() => {
                    setProjectId(project.id)
                  }}
                />
              ))}
            </ChoiceList>
          )}
        </View>
      </SurfaceScroll>
    </View>
  )
}

/** A grouped single-choice list — the platform's shape for a picker with room to spare. */
function ChoiceList({
  children,
  testID,
}: {
  children: React.ReactNode
  testID: string
}): React.JSX.Element {
  return (
    <View className={cn(PANEL_CARD, 'gap-0.5 p-1')} testID={testID}>
      {children}
    </View>
  )
}

function ChoiceRow({
  label,
  onPress,
  selected,
  testID,
}: {
  label: string
  onPress: () => void
  selected: boolean
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="min-h-11 flex-row items-center gap-2 rounded-xl px-2 active:bg-accent"
      testID={testID}
      onPress={onPress}
    >
      <Text className="min-w-0 flex-1 text-sm text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {selected ? <ChromeGlyph name="check" size={13} tone="primary" /> : null}
    </Pressable>
  )
}

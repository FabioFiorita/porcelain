import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ErrorNote, PanelLabel } from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { useHubInventories } from '@/features/projects'
import { isEnabled, isPaired, useEnvironments } from '@/features/remote'
import { SheetAction, SheetBar } from '@/features/shell/sheet-bar'
import { cn } from '@/lib/utils'

import { useCreateHubWorktree } from './hub-mutations'
import { openHubWorktree } from './hub-selection'
import { newWorktreeRequest, newWorktreeTarget, showsEnvironmentPicker } from './new-worktree-form'

/**
 * Add a Worktree: which Project it belongs to, the branch it creates, and what it starts from.
 *
 * Three fields, because `createHubWorktree` carries three things this screen can answer. There
 * is no "copy untracked files" switch and no New/Existing toggle — the first is not on the
 * contract at all, and the second is a different gesture (checking a branch out) wearing this
 * one's clothes.
 *
 * Two rules, because a picker over more than one Environment has no implicit target:
 *
 *   - The **Environment** control appears only when more than one is paired. A board reaching
 *     three daemons has no "current" one to fall back on, so an unchosen target is refused
 *     rather than guessed.
 *   - The **Project** list belongs to the chosen Environment, so switching Environments CLEARS
 *     it: a Project id that survived the switch names a repository the receiving daemon has
 *     never seen.
 *
 * On success the new checkout is OPENED — the shared binding's `selectionEffect` is
 * `select-result`, and on mobile opening a Worktree is a write to the Environment record.
 */
export function NewWorktreeSheet(): React.JSX.Element {
  const router = useRouter()
  const environments = useEnvironments().filter(isEnabled).filter(isPaired)
  const inventories = useHubInventories()
  const actions = useCreateHubWorktree()
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [branch, setBranch] = useState('')
  const [baseRef, setBaseRef] = useState('')
  const [error, setError] = useState<string | null>(null)

  const multiEnvironment = showsEnvironmentPicker(environments.length)
  const target = newWorktreeTarget(
    environments.map((environment) => environment.id),
    chosen,
  )
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
    const request = newWorktreeRequest({ baseRef, branch, environmentId: target, projectId })
    if (!request.ok) {
      setError(request.message)
      return
    }
    const environment = environments.find((entry) => entry.id === request.environmentId)
    if (environment === undefined) {
      setError('That Environment is no longer paired.')
      return
    }
    setError(null)
    void actions
      .create(environment, request.input)
      .then(async (worktree) => {
        await openHubWorktree(environment, worktree)
        router.back()
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error && reason.message.length > 0
            ? reason.message
            : 'Could not create that Worktree.',
        )
      })
  }

  const submitAction = (
    <SheetAction
      disabled={actions.isPending}
      label="Add"
      testID="porcelain-new-worktree-submit"
      onPress={submit}
    />
  )

  return (
    <View className="flex-1 bg-background" testID="porcelain-new-worktree">
      <SheetBar action={submitAction} title="New Worktree" />
      <SurfaceScroll gap={12} paddingTop={12}>
        {error === null ? null : (
          <ErrorNote message={error} testID="porcelain-new-worktree-error" />
        )}

        {multiEnvironment ? (
          <View className="gap-1.5">
            <PanelLabel>Environment</PanelLabel>
            <ChoiceList testID="porcelain-new-worktree-environment">
              {environments.map((environment) => (
                <ChoiceRow
                  key={environment.id}
                  label={environment.nickname}
                  selected={target === environment.id}
                  testID={`porcelain-new-worktree-environment-${environment.id}`}
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
          ) : projects.length === 0 ? (
            <Text className="text-xs text-muted-foreground">
              That Environment has no Projects yet.
            </Text>
          ) : (
            <ChoiceList testID="porcelain-new-worktree-project">
              {projects.map((project) => (
                <ChoiceRow
                  key={project.id}
                  label={project.name}
                  selected={projectId === project.id}
                  testID={`porcelain-new-worktree-project-${project.id}`}
                  onPress={() => {
                    setProjectId(project.id)
                  }}
                />
              ))}
            </ChoiceList>
          )}
        </View>

        <View className="gap-1.5">
          <PanelLabel>Branch</PanelLabel>
          <Input
            accessibilityLabel="Branch name"
            autoCapitalize="none"
            autoCorrect={false}
            className="font-mono"
            placeholder="work/my-change"
            testID="porcelain-new-worktree-branch"
            value={branch}
            onChangeText={setBranch}
          />
        </View>

        <View className="gap-1.5">
          <PanelLabel>From</PanelLabel>
          <Input
            accessibilityLabel="Base ref"
            autoCapitalize="none"
            autoCorrect={false}
            className="font-mono"
            placeholder="Current HEAD"
            testID="porcelain-new-worktree-base"
            value={baseRef}
            onChangeText={setBaseRef}
          />
          <Text className="text-2xs text-muted-foreground">
            A branch or ref to start from. Left empty, the Worktree starts at current HEAD.
          </Text>
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

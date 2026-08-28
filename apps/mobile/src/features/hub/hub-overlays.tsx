import { actionsMutations } from '@porcelain/client-runtime/actions'
import {
  type ActionView,
  actionsProcedures,
  type WorktreeScriptKind,
} from '@porcelain/contracts/actions'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ErrorNote, PanelLabel } from '@/components/panel-chrome'
import { PANEL_CARD, SURFACE_ROW } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select } from '@/components/ui/select'
import { Text } from '@/components/ui/text'
import { actionsListKeyForProject } from '@/features/actions/actions-query-key'
import { callActionsProcedure } from '@/features/actions/use-actions-transport'
import { useOpenProject, useProjectDirectories } from '@/features/projects'
import {
  environmentActions,
  isEnabled,
  isPaired,
  useActiveEnvironment,
  useEnvironments,
} from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'
import { useCreateHubWorktree } from './hub-mutations'
import { useHubOverlayStore } from './hub-overlay-store'
import { ResponsiveHubDialog } from './responsive-hub-dialog'

export function HubOverlays(): React.JSX.Element {
  return (
    <>
      <ProjectPicker />
      <WorktreeSetup />
      <WorktreeScripts />
    </>
  )
}

const listActionsProcedure = namedContractProcedure('actions', actionsProcedures.actions)
const addActionProcedure = namedContractProcedure('addAction', actionsMutations.add.procedure)
const updateActionProcedure = namedContractProcedure(
  'updateAction',
  actionsMutations.update.procedure,
)
const moveActionProcedure = namedContractProcedure('moveAction', actionsMutations.move.procedure)
const deleteActionProcedure = namedContractProcedure(
  'deleteAction',
  actionsMutations.delete.procedure,
)
const trustActionsProcedure = namedContractProcedure(
  'trustActions',
  actionsMutations.trust.procedure,
)

function WorktreeScripts(): React.JSX.Element {
  const target = useHubOverlayStore((state) => state.worktreeScripts)
  const close = useHubOverlayStore((state) => state.closeWorktreeScripts)
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<WorktreeScriptKind>('worktree-setup')
  const [editing, setEditing] = useState<ActionView | null>(null)
  const [title, setTitle] = useState('')
  const [command, setCommand] = useState('')
  const [error, setError] = useState<string | null>(null)
  const environment = target?.environment ?? null
  const projectId = target?.project.id ?? null
  const key = actionsListKeyForProject(environment?.id ?? 'none', projectId ?? 'none')
  const query = useQuery({
    enabled: target !== null,
    queryKey: key,
    queryFn: async () =>
      target === null
        ? []
        : callActionsProcedure(target.environment, listActionsProcedure, {
            projectId: target.project.id,
          }),
  })
  const mutation = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ exact: true, queryKey: key })
    },
  })
  const scripts = (query.data ?? []).filter(
    (action): action is ActionView =>
      action.kind === 'worktree-setup' || action.kind === 'worktree-dispose',
  )

  useEffect(() => {
    if (target === null) return
    setKind('worktree-setup')
    setEditing(null)
    setTitle('')
    setCommand('')
    setError(null)
  }, [target])

  const save = (): void => {
    if (target === null || title.trim() === '' || command.trim() === '') {
      setError('Give the script a name and command.')
      return
    }
    setError(null)
    const run =
      editing === null
        ? () =>
            callActionsProcedure(target.environment, addActionProcedure, {
              command: command.trim(),
              kind,
              projectId: target.project.id,
              title: title.trim(),
            })
        : () =>
            callActionsProcedure(target.environment, updateActionProcedure, {
              command: command.trim(),
              id: editing.id,
              projectId: target.project.id,
              title: title.trim(),
            })
    mutation.mutate(run, {
      onError: (reason) =>
        setError(reason instanceof Error ? reason.message : 'Could not save the script.'),
      onSuccess: () => {
        setEditing(null)
        setTitle('')
        setCommand('')
      },
    })
  }

  const runMutation = (run: () => Promise<unknown>): void => {
    setError(null)
    mutation.mutate(run, {
      onError: (reason) =>
        setError(reason instanceof Error ? reason.message : 'Could not update the scripts.'),
    })
  }

  return (
    <ResponsiveHubDialog
      description={
        target === null
          ? undefined
          : `Commands Porcelain runs when ${target.project.name} worktrees are created or removed.`
      }
      open={target !== null}
      testID="porcelain-worktree-scripts"
      title="Worktree scripts"
      onClose={close}
    >
      <SurfaceScroll gap={14} paddingTop={16}>
        {error === null && query.error === null ? null : (
          <View className="px-4">
            <ErrorNote
              message={error ?? String(query.error)}
              testID="porcelain-worktree-scripts-error"
            />
          </View>
        )}
        {(['worktree-setup', 'worktree-dispose'] as const).map((sectionKind) => (
          <View key={sectionKind} className="gap-2 px-4">
            <PanelLabel>{sectionKind === 'worktree-setup' ? 'On create' : 'On remove'}</PanelLabel>
            {scripts
              .filter((action) => action.kind === sectionKind)
              .map((action, index, rows) => (
                <View key={action.id} className="gap-2 rounded-lg border border-border p-3">
                  <Text className="text-sm font-semibold text-foreground">{action.title}</Text>
                  <Text className="font-mono text-xs text-muted-foreground">{action.command}</Text>
                  {!action.trusted ? (
                    <Text className="text-xs text-destructive">
                      Not trusted on this environment
                    </Text>
                  ) : null}
                  <View className="flex-row flex-wrap gap-2">
                    {!action.trusted && target !== null ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() =>
                          runMutation(() =>
                            callActionsProcedure(target.environment, trustActionsProcedure, {
                              ids: [action.id],
                              projectId: target.project.id,
                            }),
                          )
                        }
                      >
                        <Text>Trust</Text>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        setKind(sectionKind)
                        setEditing(action)
                        setTitle(action.title)
                        setCommand(action.command)
                      }}
                    >
                      <Text>Edit</Text>
                    </Button>
                    {index > 0 && target !== null ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          runMutation(() =>
                            callActionsProcedure(target.environment, moveActionProcedure, {
                              direction: 'up',
                              id: action.id,
                              projectId: target.project.id,
                            }),
                          )
                        }
                      >
                        <Text>Up</Text>
                      </Button>
                    ) : null}
                    {index < rows.length - 1 && target !== null ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          runMutation(() =>
                            callActionsProcedure(target.environment, moveActionProcedure, {
                              direction: 'down',
                              id: action.id,
                              projectId: target.project.id,
                            }),
                          )
                        }
                      >
                        <Text>Down</Text>
                      </Button>
                    ) : null}
                    {target !== null ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          Alert.alert(
                            `Delete ${action.title}?`,
                            'This removes the saved lifecycle script.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () =>
                                  runMutation(() =>
                                    callActionsProcedure(
                                      target.environment,
                                      deleteActionProcedure,
                                      { id: action.id, projectId: target.project.id },
                                    ),
                                  ),
                              },
                            ],
                          )
                        }
                      >
                        <Text className="text-destructive">Delete</Text>
                      </Button>
                    ) : null}
                  </View>
                </View>
              ))}
          </View>
        ))}
        <View className="gap-3 border-t border-border px-4 pt-4">
          <PanelLabel>{editing === null ? 'Add script' : 'Edit script'}</PanelLabel>
          {editing === null ? (
            <SegmentedControl
              value={kind}
              options={[
                { value: 'worktree-setup', label: 'On create' },
                { value: 'worktree-dispose', label: 'On remove' },
              ]}
              onChange={setKind}
            />
          ) : null}
          <Input placeholder="Name" value={title} onChangeText={setTitle} />
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            className="font-mono"
            placeholder="Command"
            value={command}
            onChangeText={setCommand}
          />
          <View className="flex-row justify-end gap-2">
            {editing === null ? null : (
              <Button
                variant="ghost"
                onPress={() => {
                  setEditing(null)
                  setTitle('')
                  setCommand('')
                }}
              >
                <Text>Cancel edit</Text>
              </Button>
            )}
            <Button disabled={mutation.isPending} onPress={save}>
              <Text>{editing === null ? 'Add' : 'Save'}</Text>
            </Button>
          </View>
        </View>
      </SurfaceScroll>
    </ResponsiveHubDialog>
  )
}

function ProjectPicker(): React.JSX.Element {
  const open = useHubOverlayStore((state) => state.projectPickerOpen)
  const close = useHubOverlayStore((state) => state.closeProjectPicker)
  const environments = useEnvironments().filter(isEnabled).filter(isPaired)
  const active = useActiveEnvironment()
  const [path, setPath] = useState<string | null>(null)
  const browser = useProjectDirectories(path, open)
  const opener = useOpenProject()
  const [error, setError] = useState<string | null>(null)
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const openingPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPath(null)
      setOpeningPath(null)
      openingPathRef.current = null
    }
  }, [open])

  const chooseEnvironment = (id: string): void => {
    setPath(null)
    void environmentActions.setActive(id)
  }
  const openPath = (next: string): void => {
    if (openingPathRef.current !== null || opener.isPending) return
    openingPathRef.current = next
    setOpeningPath(next)
    setError(null)
    void opener
      .open(next)
      .then(close)
      .catch((reason: unknown) => {
        openingPathRef.current = null
        setOpeningPath(null)
        setError(reason instanceof Error ? reason.message : 'Could not open that Project.')
      })
  }
  const isOpening = openingPath !== null || opener.isPending

  return (
    <ResponsiveHubDialog
      description="Browse a daemon and add a folder to Projects."
      open={open}
      testID="porcelain-project-picker"
      title="Open project"
      onClose={close}
    >
      <SurfaceScroll gap={12} paddingTop={12}>
        {environments.length > 1 ? (
          <View className="gap-1.5">
            <PanelLabel>Environment</PanelLabel>
            <Select
              options={environments.map((environment) => ({
                label: environment.nickname,
                testID: `porcelain-project-picker-environment-${environment.id}`,
                value: environment.id,
              }))}
              testID="porcelain-project-picker-environment"
              title="Environment"
              value={active?.id ?? environments[0]?.id ?? ''}
              onChange={chooseEnvironment}
            />
          </View>
        ) : null}
        <Text className="px-4 font-mono text-2xs text-muted-foreground" numberOfLines={1}>
          {browser.result?.path ?? 'Loading…'}
        </Text>
        {error === null && browser.error === null ? null : (
          <View className="px-4">
            <ErrorNote
              message={error ?? browser.error ?? ''}
              testID="porcelain-project-picker-error"
            />
          </View>
        )}
        <View className={`${PANEL_CARD} gap-2 p-2`}>
          <Pressable
            accessibilityLabel="Up"
            className={SURFACE_ROW}
            disabled={browser.result?.parent === null || browser.result === undefined}
            testID="porcelain-project-picker-up"
            onPress={() => setPath(browser.result?.parent ?? null)}
          >
            <View className="flex-row items-center gap-2">
              <ChromeGlyph name="chevronUp" size={15} />
              <Text className="text-sm text-muted-foreground">Up</Text>
            </View>
          </Pressable>
          {browser.result?.entries.map((entry) => (
            <View key={entry.path} className="flex-row items-center gap-2">
              <Pressable
                accessibilityLabel={`Folder ${entry.name}`}
                className={`${SURFACE_ROW} min-w-0 flex-1`}
                testID={`porcelain-project-picker-folder-${entry.name}`}
                onPress={() => setPath(entry.path)}
              >
                <View className="flex-row items-center gap-2">
                  <ChromeGlyph
                    name={entry.isRepo ? 'folderFill' : 'folder'}
                    size={15}
                    tone={entry.isRepo ? 'primary' : 'muted'}
                  />
                  <Text className="min-w-0 flex-1 font-mono text-sm" numberOfLines={1}>
                    {entry.name}
                  </Text>
                </View>
              </Pressable>
              {entry.isRepo ? (
                <Button
                  disabled={isOpening}
                  size="sm"
                  testID={`porcelain-project-picker-open-${entry.name}`}
                  variant="ghost"
                  onPress={() => openPath(entry.path)}
                >
                  <Text>{openingPath === entry.path ? 'Opening…' : 'Open'}</Text>
                </Button>
              ) : null}
            </View>
          ))}
        </View>
        <View className="flex-row justify-end gap-2 px-4">
          <Button variant="ghost" onPress={close}>
            <Text>Cancel</Text>
          </Button>
          <Button
            disabled={browser.result === undefined || isOpening}
            testID="porcelain-project-picker-open-current"
            onPress={() => browser.result && openPath(browser.result.path)}
          >
            <Text>{openingPath === browser.result?.path ? 'Opening…' : 'Open this folder'}</Text>
          </Button>
        </View>
      </SurfaceScroll>
    </ResponsiveHubDialog>
  )
}

function WorktreeSetup(): React.JSX.Element {
  const target = useHubOverlayStore((state) => state.worktreeSetup)
  const close = useHubOverlayStore((state) => state.closeWorktreeSetup)
  const creator = useCreateHubWorktree()
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [branch, setBranch] = useState('')
  const [baseRef, setBaseRef] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (target === null) return
    setMode('new')
    setBranch('')
    setBaseRef('')
    setError(null)
  }, [target])

  const submit = (): void => {
    if (target === null) return
    const cleanBranch = branch.trim()
    if (cleanBranch === '') {
      setError(mode === 'existing' ? 'Choose an existing branch.' : 'Enter a branch name.')
      return
    }
    setError(null)
    void creator
      .create(target.environment, {
        branch: cleanBranch,
        projectId: target.project.id,
        ...(mode === 'existing'
          ? { existing: true }
          : baseRef.trim() === ''
            ? {}
            : { baseRef: baseRef.trim() }),
      })
      .then(close)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Could not add that Worktree.'),
      )
  }

  return (
    <ResponsiveHubDialog
      description={target === null ? undefined : `Add a Worktree for ${target.project.name}.`}
      open={target !== null}
      testID="porcelain-worktree-setup"
      title="New worktree"
      onClose={close}
    >
      <SurfaceScroll gap={14} paddingTop={16}>
        <View className="px-4">
          <SegmentedControl
            value={mode}
            options={[
              { value: 'new', label: 'New' },
              { value: 'existing', label: 'Existing' },
            ]}
            onChange={setMode}
          />
        </View>
        {error === null ? null : (
          <View className="px-4">
            <ErrorNote message={error} testID="porcelain-worktree-setup-error" />
          </View>
        )}
        <View className="gap-1.5 px-4">
          <PanelLabel>{mode === 'existing' ? 'Existing branch' : 'Branch'}</PanelLabel>
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            className="font-mono"
            placeholder={mode === 'existing' ? 'main' : 'work/my-change'}
            value={branch}
            onChangeText={setBranch}
          />
        </View>
        {mode === 'new' ? (
          <View className="gap-1.5 px-4">
            <PanelLabel>Create from ref</PanelLabel>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              className="font-mono"
              placeholder="Current HEAD"
              value={baseRef}
              onChangeText={setBaseRef}
            />
          </View>
        ) : null}
        <View className="flex-row justify-end gap-2 px-4">
          <Button variant="ghost" onPress={close}>
            <Text>Cancel</Text>
          </Button>
          <Button disabled={creator.isPending} onPress={submit}>
            <Text>Add</Text>
          </Button>
        </View>
      </SurfaceScroll>
    </ResponsiveHubDialog>
  )
}

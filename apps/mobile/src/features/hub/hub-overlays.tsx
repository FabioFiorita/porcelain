import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ErrorNote, PanelLabel } from '@/components/panel-chrome'
import { PANEL_CARD, SURFACE_ROW } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select } from '@/components/ui/select'
import { Text } from '@/components/ui/text'
import { useOpenProject, useProjectDirectories } from '@/features/projects'
import {
  environmentActions,
  isPaired,
  useActiveEnvironment,
  useEnvironments,
} from '@/features/remote'

import { useHubOverlayStore } from './hub-overlay-store'
import { useCreateHubWorktree } from './hub-mutations'
import { ResponsiveHubDialog } from './responsive-hub-dialog'

export function HubOverlays(): React.JSX.Element {
  return (
    <>
      <ProjectPicker />
      <WorktreeSetup />
    </>
  )
}

function ProjectPicker(): React.JSX.Element {
  const open = useHubOverlayStore((state) => state.projectPickerOpen)
  const close = useHubOverlayStore((state) => state.closeProjectPicker)
  const environments = useEnvironments().filter(isPaired)
  const active = useActiveEnvironment()
  const [path, setPath] = useState<string | null>(null)
  const browser = useProjectDirectories(path, open)
  const opener = useOpenProject()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setPath(null)
  }, [open])

  const chooseEnvironment = (id: string): void => {
    setPath(null)
    void environmentActions.setActive(id)
  }
  const openPath = (next: string): void => {
    setError(null)
    void opener
      .open(next)
      .then(close)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not open that Project.')
      })
  }

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
        <View className={PANEL_CARD}>
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
            <View key={entry.path} className="flex-row items-center">
              <Pressable
                accessibilityLabel={`Folder ${entry.name}`}
                className={SURFACE_ROW + ' min-w-0 flex-1'}
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
                <Button size="sm" variant="ghost" onPress={() => openPath(entry.path)}>
                  <Text>Open</Text>
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
            disabled={browser.result === undefined || opener.isPending}
            onPress={() => browser.result && openPath(browser.result.path)}
          >
            <Text>Open this folder</Text>
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

import type { CommitModel } from '@porcelain/contracts'
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { SegmentedControl } from '@/components/segmented-control'
import { Text } from '@/components/ui/text'
import { useConnectionState } from '@/lib/daemon/environments-store'
import { commitModelsQuery } from '@/lib/daemon/procedures/settings'
import { useDaemonQuery } from '@/lib/daemon/queries'
import { cn } from '@/lib/utils'

import { PreferenceRow } from './preference-row'
import {
  type DiffMode,
  type HtmlMode,
  type MarkdownMode,
  type PullMode,
  type ThemeMode,
  usePreferencesStore,
} from './preferences-store'

/** Viewer + git prefs. Stored on-device; commit model list comes from the active daemon. */
export function GeneralSettings(): React.JSX.Element {
  const theme = usePreferencesStore((s) => s.theme)
  const setTheme = usePreferencesStore((s) => s.setTheme)
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const setMarkdownMode = usePreferencesStore((s) => s.setMarkdownMode)
  const htmlMode = usePreferencesStore((s) => s.htmlMode)
  const setHtmlMode = usePreferencesStore((s) => s.setHtmlMode)
  const pullMode = usePreferencesStore((s) => s.pullMode)
  const setPullMode = usePreferencesStore((s) => s.setPullMode)
  const commitModel = usePreferencesStore((s) => s.commitModel)
  const setCommitModel = usePreferencesStore((s) => s.setCommitModel)

  const connection = useConnectionState()
  const modelsQuery = useDaemonQuery(commitModelsQuery, undefined, {
    enabled: connection.kind === 'ready',
  })
  const models = modelsQuery.data ?? []

  return (
    <View className="gap-5" testID="porcelain-settings-general">
      <PreferenceRow
        description="Light, dark, or match the system."
        label="Appearance"
        testID="porcelain-settings-appearance"
      >
        <SegmentedControl<ThemeMode>
          options={[
            { value: 'system', label: 'System', testID: 'porcelain-settings-theme-system' },
            { value: 'light', label: 'Light', testID: 'porcelain-settings-theme-light' },
            { value: 'dark', label: 'Dark', testID: 'porcelain-settings-theme-dark' },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </PreferenceRow>

      <PreferenceRow description="How file diffs are rendered." label="Diff layout">
        <SegmentedControl<DiffMode>
          options={[
            { value: 'unified', label: 'Unified' },
            { value: 'split', label: 'Split' },
          ]}
          value={diffMode}
          onChange={setDiffMode}
        />
      </PreferenceRow>

      <PreferenceRow description="Default view when opening markdown files." label="Markdown">
        <SegmentedControl<MarkdownMode>
          options={[
            { value: 'reader', label: 'Reader' },
            { value: 'source', label: 'Source' },
          ]}
          value={markdownMode}
          onChange={setMarkdownMode}
        />
      </PreferenceRow>

      <PreferenceRow
        description="Default view when opening .html files (sandboxed preview)."
        label="HTML"
      >
        <SegmentedControl<HtmlMode>
          options={[
            { value: 'preview', label: 'Preview' },
            { value: 'source', label: 'Source' },
          ]}
          value={htmlMode}
          onChange={setHtmlMode}
        />
      </PreferenceRow>

      <PreferenceRow description="How the git pull quick command reconciles." label="Pull strategy">
        <SegmentedControl<PullMode>
          options={[
            { value: 'merge', label: 'Merge' },
            { value: 'rebase', label: 'Rebase' },
          ]}
          value={pullMode}
          onChange={setPullMode}
        />
      </PreferenceRow>

      <PreferenceRow
        description="Model used for generated commit messages and commit groups. Effort is fixed at medium."
        label="Commit message model"
        testID="porcelain-settings-commit-model"
      >
        <CommitModelPicker
          isLoading={modelsQuery.isLoading && connection.kind === 'ready'}
          options={models.map((model) => ({ id: model.id, label: model.label }))}
          unreachable={connection.kind !== 'ready'}
          value={commitModel}
          onChange={setCommitModel}
        />
      </PreferenceRow>
    </View>
  )
}

function CommitModelPicker({
  value,
  onChange,
  options,
  isLoading,
  unreachable,
}: {
  value: string
  onChange: (value: CommitModel) => void
  options: readonly { id: string; label: string }[]
  isLoading: boolean
  unreachable: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.id === value)
  const label = unreachable
    ? 'Connect an environment'
    : isLoading
      ? 'Loading…'
      : (selected?.label ?? (options.length === 0 ? 'No providers' : value))

  return (
    <View className="w-full max-w-sm gap-1.5">
      <Pressable
        accessibilityLabel="Commit message model"
        accessibilityRole="button"
        accessibilityState={{ disabled: unreachable || isLoading || options.length === 0 }}
        className={cn(
          'h-9 flex-row items-center justify-between rounded-md border border-border bg-background px-3 active:bg-accent',
          (unreachable || isLoading || options.length === 0) && 'opacity-60',
        )}
        disabled={unreachable || isLoading || options.length === 0}
        testID="porcelain-settings-commit-model-trigger"
        onPress={() => {
          setOpen((current) => !current)
        }}
      >
        <Text className="text-sm text-foreground">{label}</Text>
        <Text className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View
          className="overflow-hidden rounded-md border border-border bg-card"
          testID="porcelain-settings-commit-model-list"
        >
          {options.map((option) => {
            const selectedOption = option.id === value
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedOption }}
                className={cn(
                  'flex-row items-center justify-between px-3 py-2.5 active:bg-accent',
                  selectedOption && 'bg-accent/60',
                )}
                testID={`porcelain-settings-commit-model-${option.id}`}
                onPress={() => {
                  onChange(option.id)
                  setOpen(false)
                }}
              >
                <Text className="text-sm text-foreground">{option.label}</Text>
                {selectedOption ? (
                  <Text className="text-xs font-semibold text-primary">Selected</Text>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

import type { CommitModel } from '@porcelain/contracts'
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ActionSheet, ErrorNote } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/segmented-control'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

import { PreferenceRow } from './preference-row'
import {
  type DiffMode,
  type HtmlMode,
  type MarkdownMode,
  type PullMode,
  type TerminalTextSize,
  type ThemeMode,
  usePreferencesStore,
} from './preferences-store'
import { useCommitModels } from './use-settings'

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
  const terminalTextSize = usePreferencesStore((s) => s.terminalTextSize)
  const setTerminalTextSize = usePreferencesStore((s) => s.setTerminalTextSize)
  const commitModel = usePreferencesStore((s) => s.commitModel)
  const setCommitModel = usePreferencesStore((s) => s.setCommitModel)

  const models = useCommitModels()

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

      <PreferenceRow
        description="How file diffs are rendered."
        label="Diff layout"
        testID="porcelain-settings-diff-mode"
      >
        <SegmentedControl<DiffMode>
          options={[
            { value: 'unified', label: 'Unified', testID: 'porcelain-settings-diff-unified' },
            { value: 'split', label: 'Split', testID: 'porcelain-settings-diff-split' },
          ]}
          testID="porcelain-settings-diff-mode-control"
          value={diffMode}
          onChange={setDiffMode}
        />
      </PreferenceRow>

      {/* The *default* a markdown file opens in. The viewer's own toggle overrides it for the
          file on screen and deliberately never writes back here. */}
      <PreferenceRow
        description="Default view when opening markdown files."
        label="Markdown"
        testID="porcelain-settings-markdown-mode"
      >
        <SegmentedControl<MarkdownMode>
          options={[
            { value: 'reader', label: 'Reader', testID: 'porcelain-settings-markdown-reader' },
            { value: 'source', label: 'Source', testID: 'porcelain-settings-markdown-source' },
          ]}
          testID="porcelain-settings-markdown-mode-control"
          value={markdownMode}
          onChange={setMarkdownMode}
        />
      </PreferenceRow>

      <PreferenceRow
        description="Default view when opening .html files (sandboxed preview)."
        label="HTML"
        testID="porcelain-settings-html-mode"
      >
        <SegmentedControl<HtmlMode>
          options={[
            { value: 'preview', label: 'Preview', testID: 'porcelain-settings-html-preview' },
            { value: 'source', label: 'Source', testID: 'porcelain-settings-html-source' },
          ]}
          testID="porcelain-settings-html-mode-control"
          value={htmlMode}
          onChange={setHtmlMode}
        />
      </PreferenceRow>

      <PreferenceRow
        description="How the git pull quick command reconciles."
        label="Pull strategy"
        testID="porcelain-settings-pull-mode"
      >
        <SegmentedControl<PullMode>
          options={[
            { value: 'merge', label: 'Merge', testID: 'porcelain-settings-pull-merge' },
            { value: 'rebase', label: 'Rebase', testID: 'porcelain-settings-pull-rebase' },
          ]}
          testID="porcelain-settings-pull-mode-control"
          value={pullMode}
          onChange={setPullMode}
        />
      </PreferenceRow>

      <PreferenceRow
        description="How large terminal output renders."
        label="Terminal text size"
        testID="porcelain-settings-terminal-text-size"
      >
        <SegmentedControl<TerminalTextSize>
          options={[
            { value: 'small', label: 'Small', testID: 'porcelain-settings-terminal-text-small' },
            {
              value: 'medium',
              label: 'Medium',
              testID: 'porcelain-settings-terminal-text-medium',
            },
            { value: 'large', label: 'Large', testID: 'porcelain-settings-terminal-text-large' },
          ]}
          testID="porcelain-settings-terminal-text-size-control"
          value={terminalTextSize}
          onChange={setTerminalTextSize}
        />
      </PreferenceRow>

      <PreferenceRow
        description="Model used for generated commit messages and commit groups. Effort is fixed at medium."
        label="Commit message model"
        testID="porcelain-settings-commit-model"
      >
        <CommitModelPicker
          isLoading={models.isLoading}
          options={models.options.map((model) => ({ id: model.id, label: model.label }))}
          unreachable={models.unreachable}
          value={commitModel}
          onChange={setCommitModel}
        />
        {/* The provider list is a daemon read like any other: a host that answers with an
            error left this row printing the raw model id and no reason for it. */}
        {models.error === null ? null : (
          <ErrorNote
            message={models.error.message || 'The daemon refused the provider list.'}
            testID="porcelain-settings-commit-model-error"
          />
        )}
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
  const disabled = unreachable || isLoading || options.length === 0
  const label = unreachable
    ? 'Connect an environment'
    : isLoading
      ? 'Loading…'
      : (selected?.label ?? (options.length === 0 ? 'No providers' : value))

  return (
    <View className="w-full max-w-sm">
      <Pressable
        accessibilityLabel="Commit message model"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className={cn(
          'h-9 flex-row items-center justify-between rounded-md border border-border bg-background px-3 active:bg-accent',
          disabled && 'opacity-60',
        )}
        disabled={disabled}
        testID="porcelain-settings-commit-model-trigger"
        onPress={() => {
          setOpen(true)
        }}
      >
        <Text className="text-sm text-foreground">{label}</Text>
        <ChromeGlyph name="chevron" size={12} />
      </Pressable>

      {/* The list opens as an `ActionSheet` rather than expanding under the trigger. It is a
          single select from a short list, which is what the sheet is for — and the inline
          version pushed every preference below it down the screen while it was open, so the
          row you were reading moved out from under your thumb. */}
      <ActionSheet
        actions={options.map((option) => ({
          glyph: option.id === value ? 'squareCheck' : 'square',
          id: option.id,
          label: option.label,
          tone: option.id === value ? 'primary' : ('muted' as const),
          onPress: () => {
            onChange(option.id)
          },
        }))}
        open={open}
        subtitle={selected?.label ?? value}
        testID="porcelain-settings-commit-model-list"
        title="Commit message model"
        onClose={() => {
          setOpen(false)
        }}
      />
    </View>
  )
}

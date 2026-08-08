import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ShellModalScroll } from '@/components/shell-modal'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'

import { type ProjectSheet, useProjectSheet } from './use-workspace'
import { workspaceTestId } from './workspace-lists'
import {
  EmptyPickerState,
  ErrorState,
  type PickerBodyProps,
  PickerSection,
  WorkspaceRow,
} from './workspace-picker'

/** Project recents plus the daemon-side directory browser used by local and remote daemons. */
export function ProjectSheetBody({ open }: PickerBodyProps): React.JSX.Element {
  const sheet = useProjectSheet(open)

  if (sheet.mode === 'browse') return <DirectoryBrowser sheet={sheet} />

  return (
    <View className="gap-4" testID="porcelain-project-sheet">
      {!sheet.paired ? (
        <EmptyPickerState
          body="Pair a daemon in Settings → Environments before opening a project."
          testID="porcelain-project-no-environment"
          title="No daemon connected"
        />
      ) : null}

      {sheet.paired && sheet.isLoading ? (
        <Text className="text-sm text-muted-foreground" testID="porcelain-project-loading">
          Loading projects…
        </Text>
      ) : null}
      {sheet.paired && sheet.loadError !== null ? (
        <ErrorState message={sheet.loadError} testID="porcelain-project-error" />
      ) : null}
      {sheet.paired &&
      !sheet.isLoading &&
      sheet.loadError === null &&
      sheet.projects.length === 0 ? (
        <EmptyPickerState
          body="Open a directory on the daemon to add it to Projects."
          testID="porcelain-project-empty"
          title="No recent projects"
        />
      ) : null}
      {sheet.projects.length > 0 ? (
        <PickerSection title="Projects">
          {sheet.projects.map((project) => (
            <WorkspaceRow
              key={project.path}
              detail={project.path}
              disabled={sheet.busyPath !== null}
              label={project.name}
              selected={project.path === sheet.activePath}
              testID={workspaceTestId('project-row', project.path)}
              onPress={() => {
                sheet.open(project.path)
              }}
            />
          ))}
        </PickerSection>
      ) : null}

      <Button
        accessibilityLabel="Open project directory"
        disabled={!sheet.paired || sheet.busyPath !== null}
        testID="porcelain-project-open-directory"
        variant="outline"
        onPress={sheet.startBrowsing}
      >
        <ChromeGlyph name="folder" size={16} tone="foreground" />
        <UiText>Open directory…</UiText>
      </Button>
      {sheet.actionError ? (
        <ErrorState message={sheet.actionError} testID="porcelain-project-action-error" />
      ) : null}
    </View>
  )
}

function DirectoryBrowser({ sheet }: { sheet: ProjectSheet }): React.JSX.Element {
  const { browse, busyPath, paired } = sheet
  const result = browse.result
  const entries = result?.entries ?? []
  const upDisabled = !paired || result === undefined || result.parent === null || busyPath !== null

  return (
    <View className="gap-3" testID="porcelain-project-browser">
      <View className="gap-1">
        <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
          Daemon folders
        </Text>
        <Text
          className="font-mono text-xs text-muted-foreground"
          numberOfLines={1}
          testID="porcelain-project-browser-path"
        >
          {result?.path ?? (browse.error !== null ? 'Unable to read this folder' : 'Loading…')}
        </Text>
      </View>

      <Pressable
        accessibilityLabel="Go to parent folder"
        accessibilityRole="button"
        accessibilityState={{ disabled: upDisabled }}
        className="h-11 flex-row items-center gap-3 border-b border-border px-3 active:bg-accent"
        disabled={upDisabled}
        testID="porcelain-project-up"
        onPress={() => {
          if (result?.parent !== null && result?.parent !== undefined) {
            sheet.setBrowsePath(result.parent)
          }
        }}
      >
        <ChromeGlyph name="arrowUp" size={18} tone="foreground" />
        <Text className="font-mono text-sm text-foreground">..</Text>
      </Pressable>

      <ShellModalScroll className="max-h-72" contentContainerClassName="gap-1">
        {browse.isLoading ? (
          <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading folders…
          </Text>
        ) : null}
        {browse.error !== null ? (
          <ErrorState message={browse.error} testID="porcelain-project-browser-error" />
        ) : null}
        {!browse.isLoading && browse.error === null && entries.length === 0 ? (
          <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
            No folders here
          </Text>
        ) : null}
        {entries.map((entry) => (
          <View key={entry.path} className="flex-row items-center gap-2 rounded-xl px-2 py-1">
            <Pressable
              accessibilityLabel={`Browse folder ${entry.name}`}
              accessibilityRole="button"
              className="min-w-0 flex-1 flex-row items-center gap-2 rounded-lg px-1 py-2 active:bg-accent"
              testID={workspaceTestId('project-folder', entry.path)}
              onPress={() => {
                sheet.setBrowsePath(entry.path)
              }}
            >
              <ChromeGlyph name="folder" size={16} tone={entry.isRepo ? 'primary' : 'muted'} />
              <Text className="min-w-0 flex-1 font-mono text-sm text-foreground" numberOfLines={1}>
                {entry.name}
              </Text>
              {entry.isRepo ? <Text className="text-3xs text-primary">repo</Text> : null}
            </Pressable>
            {entry.isRepo ? (
              <Button
                accessibilityLabel={`Open ${entry.name}`}
                disabled={busyPath !== null}
                size="sm"
                testID={workspaceTestId('project-folder-open', entry.path)}
                variant="ghost"
                onPress={() => {
                  sheet.open(entry.path)
                }}
              >
                <UiText>Open</UiText>
              </Button>
            ) : null}
          </View>
        ))}
      </ShellModalScroll>

      <View className="gap-2">
        <Button
          accessibilityLabel="Open current folder"
          disabled={!paired || result === undefined || browse.isFetching || busyPath !== null}
          testID="porcelain-project-open-current-folder"
          onPress={() => {
            if (result !== undefined) sheet.open(result.path)
          }}
        >
          <ChromeGlyph name="folder" size={16} tone="primaryForeground" />
          <UiText>{busyPath === result?.path ? 'Opening…' : 'Open this folder'}</UiText>
        </Button>
        <Button
          accessibilityLabel="Back to projects"
          disabled={busyPath !== null}
          testID="porcelain-project-back"
          variant="ghost"
          onPress={sheet.stopBrowsing}
        >
          <UiText>Back to projects</UiText>
        </Button>
      </View>
      {sheet.actionError ? (
        <ErrorState message={sheet.actionError} testID="porcelain-project-action-error" />
      ) : null}
    </View>
  )
}

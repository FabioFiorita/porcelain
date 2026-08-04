import { useMemo, useState } from 'react'
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import {
  MOCK_BRANCHES,
  MOCK_ENVIRONMENTS,
  MOCK_PROJECTS,
  MOCK_WORKSPACE,
  MOCK_WORKTREES,
} from './mock-data'
import { ChromeGlyph } from './shell-icon'
import { ShellModal, ShellModalScroll } from './shell-modal'
import { type SettingsSection, useShellStore } from './shell-store'

const WINDOW = Dimensions.get('window')
const SHEET_MAX_W = Math.min(WINDOW.width * 0.55, 440)
const SHEET_MAX_H = Math.min(WINDOW.height * 0.72, 520)
const SETTINGS_MAX_W = Math.min(WINDOW.width * 0.68, 600)
const SEARCH_MAX_W = Math.min(WINDOW.width * 0.55, 500)

export function ShellSheets(): React.JSX.Element {
  const sheet = useShellStore((state) => state.sheet)
  const closeSheet = useShellStore((state) => state.closeSheet)

  return (
    <>
      <ShellModal
        open={sheet === 'project'}
        onClose={closeSheet}
        title="Project"
        description="Open and recent projects."
        contentStyle={{ width: SHEET_MAX_W, maxHeight: SHEET_MAX_H }}
      >
        <ProjectSheetBody />
      </ShellModal>

      <SearchCommandSheet open={sheet === 'search'} onClose={closeSheet} />

      <ShellModal
        open={sheet === 'branch'}
        onClose={closeSheet}
        title="Branch"
        description="Switch branch in this worktree."
        contentStyle={{ width: SHEET_MAX_W, maxHeight: SHEET_MAX_H }}
      >
        <BranchSheetBody />
      </ShellModal>

      <ShellModal
        open={sheet === 'worktree'}
        onClose={closeSheet}
        title="Worktree"
        description="Open or switch a worktree."
        contentStyle={{ width: SHEET_MAX_W, maxHeight: SHEET_MAX_H }}
      >
        <WorktreeSheetBody />
      </ShellModal>

      <ShellModal
        open={sheet === 'settings'}
        onClose={closeSheet}
        title="Settings"
        description="General, Review, and Environments for this client."
        contentStyle={{ width: SETTINGS_MAX_W, maxHeight: SHEET_MAX_H }}
      >
        <SettingsSheetBody />
      </ShellModal>
    </>
  )
}

function ProjectSheetBody(): React.JSX.Element {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const open = MOCK_PROJECTS.filter((project) => project.group === 'open')
  const recent = MOCK_PROJECTS.filter((project) => project.group === 'recent')

  return (
    <View className="gap-4">
      <SheetSection title="Open">
        {open.map((project) => (
          <SheetRow
            key={project.id}
            label={project.name}
            detail={project.path}
            selected={project.name === MOCK_WORKSPACE.projectName}
            onPress={closeSheet}
          />
        ))}
      </SheetSection>
      <SheetSection title="Recent">
        {recent.map((project) => (
          <SheetRow
            key={project.id}
            label={project.name}
            detail={project.path}
            onPress={closeSheet}
          />
        ))}
      </SheetSection>
      <Button onPress={closeSheet} variant="outline">
        <ChromeGlyph name="folder" size={16} tone="foreground" />
        <UiText>Open directory…</UiText>
      </Button>
    </View>
  )
}

/** Command-palette search — RN Modal + input + grouped list (web Command shape). */
function SearchCommandSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const files = useMemo(
    () =>
      [
        { id: 'f1', label: 'apps/mobile/src/app/_layout.tsx', detail: 'File' },
        { id: 'f2', label: 'apps/mobile/src/features/shell/tablet-shell.tsx', detail: 'File' },
        { id: 'f3', label: 'apps/web/src/components/shell/title-bar.tsx', detail: 'File' },
        { id: 'f4', label: 'packages/contracts/src/index.ts', detail: 'File' },
        { id: 'f5', label: '.agents/skills/mobile/SKILL.md', detail: 'File' },
        { id: 'f6', label: 'apps/mobile/src/features/shell/shell-sheets.tsx', detail: 'File' },
      ].filter((row) => q === '' || row.label.toLowerCase().includes(q)),
    [q],
  )

  const commands = useMemo(
    () =>
      [
        { id: 'c1', label: 'pnpm verify', detail: 'Saved action' },
        { id: 'c2', label: 'pnpm --dir apps/mobile typecheck', detail: 'Saved action' },
        { id: 'c3', label: 'eas fingerprint:compare', detail: 'Saved action' },
      ].filter(
        (row) =>
          q === '' || row.label.toLowerCase().includes(q) || row.detail.toLowerCase().includes(q),
      ),
    [q],
  )

  const commits = useMemo(
    () =>
      [
        { id: 'h1', label: 'a3f2c01', detail: 'Shell: tablet SplitView POC' },
        { id: 'h2', label: '91be440', detail: 'Mobile: NativeWind reusables pass' },
        { id: 'h3', label: '0e12ab9', detail: 'Daemon: environments store' },
      ].filter(
        (row) =>
          q === '' || row.label.toLowerCase().includes(q) || row.detail.toLowerCase().includes(q),
      ),
    [q],
  )

  const empty = files.length === 0 && commands.length === 0 && commits.length === 0

  return (
    <ShellModal
      bare
      hideHeader
      open={open}
      onClose={() => {
        setQuery('')
        onClose()
      }}
      contentStyle={{ width: SEARCH_MAX_W, maxHeight: SHEET_MAX_H }}
    >
      <View className="flex-row items-center gap-2 border-b border-border px-3 py-1 pr-12">
        <ChromeGlyph name="search" size={16} />
        <Input
          autoFocus={open}
          className="native:h-12 flex-1 border-0 bg-transparent px-0 text-base shadow-none"
          onChangeText={setQuery}
          placeholder="Search files, folders, commands, commits…"
          returnKeyType="search"
          value={query}
        />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={{ maxHeight: SHEET_MAX_H - 72 }}
        contentContainerStyle={{ paddingVertical: 6, paddingBottom: 12 }}
      >
        {empty ? (
          <Text className="px-4 py-8 text-center text-sm text-muted-foreground">
            No results{q ? ` for “${query.trim()}”` : ''}.
          </Text>
        ) : null}

        {files.length > 0 ? (
          <CommandGroup heading="Files">
            {files.map((row) => (
              <CommandItem
                key={row.id}
                label={row.label}
                detail={row.detail}
                onPress={() => {
                  setQuery('')
                  onClose()
                }}
              />
            ))}
          </CommandGroup>
        ) : null}

        {commands.length > 0 ? (
          <CommandGroup heading="Commands">
            {commands.map((row) => (
              <CommandItem
                key={row.id}
                label={row.label}
                detail={row.detail}
                onPress={() => {
                  setQuery('')
                  onClose()
                }}
              />
            ))}
          </CommandGroup>
        ) : null}

        {commits.length > 0 ? (
          <CommandGroup heading="Commits">
            {commits.map((row) => (
              <CommandItem
                key={row.id}
                label={row.label}
                detail={row.detail}
                onPress={() => {
                  setQuery('')
                  onClose()
                }}
              />
            ))}
          </CommandGroup>
        ) : null}
      </ScrollView>
    </ShellModal>
  )
}

function CommandGroup({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="gap-0.5 px-1 py-1">
      <Text className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {heading}
      </Text>
      {children}
    </View>
  )
}

function CommandItem({
  label,
  detail,
  onPress,
}: {
  label: string
  detail: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      className="mx-1 flex-row items-center gap-3 rounded-lg px-3 py-2.5 active:bg-accent"
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </Pressable>
  )
}

function BranchSheetBody(): React.JSX.Element {
  const closeSheet = useShellStore((state) => state.closeSheet)
  return (
    <View className="gap-1">
      {MOCK_BRANCHES.map((branch) => (
        <SheetRow
          key={branch.id}
          label={branch.name}
          detail={branch.current ? 'Current branch' : undefined}
          selected={branch.current}
          glyph="branch"
          onPress={closeSheet}
        />
      ))}
    </View>
  )
}

function WorktreeSheetBody(): React.JSX.Element {
  const closeSheet = useShellStore((state) => state.closeSheet)
  return (
    <View className="gap-1">
      {MOCK_WORKTREES.map((worktree) => (
        <SheetRow
          key={worktree.id}
          label={worktree.name}
          detail={worktree.path}
          selected={worktree.current}
          onPress={closeSheet}
        />
      ))}
    </View>
  )
}

function SettingsSheetBody(): React.JSX.Element {
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  const sections: { id: SettingsSection; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'review', label: 'Review' },
    { id: 'environments', label: 'Environments' },
  ]

  return (
    <View className="flex-row gap-4" style={{ maxHeight: SHEET_MAX_H - 100 }}>
      <View className="w-36 shrink-0 gap-1">
        {sections.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            accessibilityState={{ selected: section === entry.id }}
            className={cn(
              'rounded-lg border border-transparent px-3 py-2.5 active:bg-accent',
              section === entry.id && 'border-border bg-accent',
            )}
            onPress={() => {
              setSettingsSection(entry.id)
            }}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                section === entry.id ? 'text-accent-foreground' : 'text-foreground',
              )}
            >
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="w-px self-stretch bg-border" />

      <ShellModalScroll style={{ flex: 1, minWidth: 0 }}>
        {section === 'general' ? <GeneralSettingsMock /> : null}
        {section === 'review' ? <ReviewSettingsMock /> : null}
        {section === 'environments' ? <EnvironmentsSettingsMock /> : null}
      </ShellModalScroll>
    </View>
  )
}

function GeneralSettingsMock(): React.JSX.Element {
  return (
    <View className="gap-3">
      <SettingsCard title="Appearance" body="System · Light · Dark — follows the OS for now." />
      <SettingsCard title="Diff mode" body="Unified (default). Split lands with the real viewer." />
      <SettingsCard title="Markdown" body="Reader or source when opening markdown files." />
      <SettingsCard title="HTML" body="Sandboxed preview or source for .html files." />
      <SettingsCard title="Pull strategy" body="Merge or rebase for the git pull quick command." />
    </View>
  )
}

function ReviewSettingsMock(): React.JSX.Element {
  return (
    <View className="gap-3">
      <SettingsCard
        title="Review layers"
        body="Docs · Agents · Other — same grouping as the web Review section."
      />
      <SettingsCard title="Empty review" body="Show Glance when no unit of work is published." />
    </View>
  )
}

function EnvironmentsSettingsMock(): React.JSX.Element {
  return (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">
        Pair this tablet with a dev daemon. Production port 43117 is never used for product work.
      </Text>
      {MOCK_ENVIRONMENTS.map((environment) => (
        <View
          key={environment.id}
          className={cn(
            'flex-row items-center gap-3 rounded-xl border border-border bg-card p-3',
            environment.active && 'border-primary/40 bg-primary/5',
          )}
        >
          <View className="size-9 items-center justify-center rounded-lg bg-muted">
            <ChromeGlyph name="network" size={16} tone="foreground" />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-medium text-foreground">{environment.name}</Text>
            <Text className="text-xs text-muted-foreground">{environment.host}</Text>
          </View>
          {environment.active ? (
            <Text className="text-xs font-semibold text-primary">Active</Text>
          ) : null}
        </View>
      ))}
      <Button variant="outline">
        <UiText>Add environment…</UiText>
      </Button>
    </View>
  )
}

function SettingsCard({ title, body }: { title: string; body: string }): React.JSX.Element {
  return (
    <View className="gap-1 rounded-xl border border-border bg-muted/40 p-3">
      <Text className="text-sm font-semibold text-foreground">{title}</Text>
      <Text className="text-sm leading-5 text-muted-foreground">{body}</Text>
    </View>
  )
}

function SheetSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="gap-1.5">
      <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </Text>
      <View className="gap-0.5">{children}</View>
    </View>
  )
}

function SheetRow({
  label,
  detail,
  selected,
  glyph,
  onPress,
}: {
  label: string
  detail?: string
  selected?: boolean
  glyph?: 'branch'
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      className={cn(
        'flex-row items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 active:bg-accent',
        selected && 'border-border bg-muted/70',
      )}
      onPress={onPress}
    >
      {glyph === 'branch' ? <ChromeGlyph name="branch" size={16} /> : null}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        {detail ? <Text className="text-xs text-muted-foreground">{detail}</Text> : null}
      </View>
      {selected ? <View className="size-1.5 rounded-full bg-primary" /> : null}
    </Pressable>
  )
}

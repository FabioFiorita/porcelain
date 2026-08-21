import { headLabel } from '@porcelain/contracts'
import type { BranchRef } from '@porcelain/contracts/git'
import { runUserAction } from '@porcelain/shared/background'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { Sheet } from '@/components/ui/sheet'
import { ErrorNote, PanelLabel } from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'

import { branchLabel, matchBranches } from './branch-facts'
import { useGitHead } from './git-queries'
import { useGitCheckout, useGitCreateBranch, useGitWorkspace } from './workspace'

/** git's own refusal — an existing branch, a dirty tree — is the message worth reading. */
function refusal(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message !== '' ? cause.message : fallback
}

/**
 * The branch this surface is acting on, and the picker that changes it.
 *
 * Everything shown comes off `gitHead`: the checked-out ref and the upstream it tracks. There
 * is no ahead/behind count here because the contract does not carry one — the Suggested tile
 * above is where "behind by N" turns into something to tap.
 */
export function GitBranchCard({ active }: { active: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { head } = useGitHead(active)

  const label = head === undefined ? '…' : headLabel(head)
  const upstream = head?.upstream ?? null

  return (
    <View className="gap-2" testID="porcelain-git-branch">
      <PanelLabel>Branch</PanelLabel>
      <Pressable
        accessibilityLabel={`Branch ${label}. Switch branch`}
        accessibilityRole="button"
        className={cn('min-h-12 flex-row items-center gap-2.5 p-2.5 active:bg-accent', PANEL_CARD)}
        testID="porcelain-git-branch-current"
        onPress={() => {
          setOpen(true)
        }}
      >
        <ChromeGlyph name="branch" size={15} />
        <View className="min-w-0 flex-1">
          <Text className="font-mono text-xs text-foreground" numberOfLines={1}>
            {label}
          </Text>
          <Text className="text-2xs text-muted-foreground" numberOfLines={1}>
            {upstream === null ? 'No upstream' : `Tracks ${upstream}`}
          </Text>
        </View>
        <ChromeGlyph name="chevronRight" size={14} />
      </Pressable>

      <BranchSheet
        currentBranch={head?.branch ?? null}
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      />
    </View>
  )
}

/**
 * Local and remote refs, filtered as you type, plus the create form.
 *
 * The branch list only loads while the sheet is open — it is a picker, not a background fact —
 * and checking out a remote-only ref hands git the bare name so it creates the local tracking
 * branch itself, exactly as the web switcher does.
 */
function BranchSheet({
  currentBranch,
  onClose,
  open,
}: {
  currentBranch: string | null
  onClose: () => void
  open: boolean
}): React.JSX.Element {
  const workspace = useGitWorkspace({ enabled: open, placeholderData: true })
  const checkout = useGitCheckout()
  const createBranch = useGitCreateBranch()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const branches = workspace.branches.data ?? []
  const { local, remote } = matchBranches(branches, query)
  const busy = checkout.isPending || createBranch.isPending

  const dismiss = (): void => {
    setQuery('')
    setCreating(false)
    setNewName('')
    setError(null)
    onClose()
  }

  const handleCheckout = (branch: BranchRef): void => {
    if (busy) return
    if (branch.remote === null && branch.name === currentBranch) {
      dismiss()
      return
    }
    setError(null)
    runUserAction(
      async () => {
        // A remote-only ref is checked out by its bare name so git DWIMs the tracking branch.
        await checkout.mutateAsync(branch.name)
        dismiss()
      },
      (cause) => {
        setError(refusal(cause, 'Checkout failed.'))
      },
    )
  }

  const handleCreate = (): void => {
    const name = newName.trim()
    // git is the validator: no client-side name rules, so its refusal is what gets shown.
    if (name === '' || busy) return
    setError(null)
    runUserAction(
      async () => {
        await createBranch.mutateAsync(name)
        dismiss()
      },
      (cause) => {
        setError(refusal(cause, 'Create branch failed.'))
      },
    )
  }

  return (
    <Sheet
      open={open}
      scrollable
      title={creating ? 'New branch' : 'Switch branch'}
      onClose={dismiss}
    >
      <View className="gap-3 px-5">
        <Input
          accessibilityLabel={creating ? 'Branch name' : 'Search branches'}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={creating ? 'Branch name' : 'Switch branch…'}
          testID={creating ? 'porcelain-git-branch-name' : 'porcelain-git-branch-search'}
          value={creating ? newName : query}
          onChangeText={creating ? setNewName : setQuery}
        />
        {error === null ? null : <ErrorNote message={error} testID="porcelain-git-branch-error" />}
      </View>

      {creating ? (
        <View className="flex-row gap-2 px-5">
          <Button
            className="flex-1"
            disabled={busy}
            size="sm"
            testID="porcelain-git-branch-create-cancel"
            variant="outline"
            onPress={() => {
              setCreating(false)
              setNewName('')
              setError(null)
            }}
          >
            <UiText>Cancel</UiText>
          </Button>
          <Button
            className="flex-1"
            disabled={busy || newName.trim() === ''}
            size="sm"
            testID="porcelain-git-branch-create-confirm"
            onPress={handleCreate}
          >
            <UiText>{createBranch.isPending ? 'Creating…' : 'Create'}</UiText>
          </Button>
        </View>
      ) : (
        <>
          {/* surface-gutter-allow: sheet content, not a surface. The sheet's own gutter is the
              20pt the title and the field above sit on, and each row adds `px-3` of its own, so
              8pt here lands the branch names on that same left edge. */}
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-0.5 px-2 pb-2"
            keyboardShouldPersistTaps="handled"
          >
            {workspace.branches.isLoading ? (
              <Text
                className="px-4 py-6 text-center text-sm text-muted-foreground"
                testID="porcelain-git-branch-loading"
              >
                Loading branches…
              </Text>
            ) : null}
            {local.length + remote.length === 0 && !workspace.branches.isLoading ? (
              <Text
                className="px-4 py-6 text-center text-sm text-muted-foreground"
                testID="porcelain-git-branch-empty"
              >
                No branches found.
              </Text>
            ) : null}
            {local.length === 0 ? null : <SheetSection title="Local" />}
            {local.map((branch) => (
              <BranchRow
                key={branch.name}
                branch={branch}
                disabled={busy}
                selected={branch.name === currentBranch}
                onPress={() => {
                  handleCheckout(branch)
                }}
              />
            ))}
            {remote.length === 0 ? null : <SheetSection title="Remote" />}
            {remote.map((branch) => (
              <BranchRow
                key={branchLabel(branch)}
                branch={branch}
                disabled={busy}
                selected={false}
                onPress={() => {
                  handleCheckout(branch)
                }}
              />
            ))}
          </ScrollView>
          <View className="px-5">
            <Button
              disabled={busy}
              size="sm"
              testID="porcelain-git-branch-new"
              variant="outline"
              onPress={() => {
                setError(null)
                setCreating(true)
              }}
            >
              <ChromeGlyph name="plus" size={14} tone="foreground" />
              <UiText>New branch…</UiText>
            </Button>
          </View>
        </>
      )}
    </Sheet>
  )
}

function SheetSection({ title }: { title: string }): React.JSX.Element {
  return <PanelLabel className="px-3 pt-2">{title}</PanelLabel>
}

function BranchRow({
  branch,
  disabled,
  onPress,
  selected,
}: {
  branch: BranchRef
  disabled: boolean
  onPress: () => void
  selected: boolean
}): React.JSX.Element {
  const label = branchLabel(branch)
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      className={cn(
        'min-h-11 flex-row items-center justify-between gap-2 rounded-xl px-3 py-2 active:bg-accent',
        selected && 'bg-muted/70',
        disabled && 'opacity-60',
      )}
      disabled={disabled}
      testID={`porcelain-git-branch-${label}`}
      onPress={onPress}
    >
      <Text className="min-w-0 flex-1 font-mono text-xs text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {selected ? <ChromeGlyph name="check" size={14} tone="primary" /> : null}
    </Pressable>
  )
}

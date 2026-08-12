import { useState } from 'react'
import { Text, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text as UiText } from '@/components/ui/text'

/**
 * The one create form behind both workspace pickers. `gitCreateBranch` and `gitAddWorktree` take
 * the same input — a repo and a branch name off the current HEAD — and differ only in where the
 * result is checked out, so they share a form rather than forking two near-identical sheets.
 *
 * It is a plain body, not its own `ShellModal`: the pickers are already presented in one, and a
 * second native modal on top of the first is what put this form under the iOS keyboard. The
 * picker swaps this in as a mode of its own sheet instead — see `shell-modal.tsx`.
 */
export type WorkspaceCreateTarget = 'branch' | 'worktree'

/**
 * **git owns ref-name validity, not this form.** `git check-ref-format` is a long, subtle grammar
 * (`@{`, consecutive dots, trailing dot, control characters, a bare `@`, …) and any client-side
 * copy of it is a partial copy that will eventually refuse a name git would take. The daemon
 * rethrows git's own refusal and the dialog shows it verbatim — that is the whole guard.
 *
 * What is left here is deliberately not format checking:
 * - an empty name is "nothing to submit", the same disabled-submit rule every form in the app has;
 * - a collision with an already-loaded local branch spends data in hand to skip a round trip that
 *   cannot succeed, and stays correct however git's ref grammar evolves.
 */
export function branchNameError(name: string, existingBranches: readonly string[]): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'Enter a branch name.'
  if (existingBranches.includes(trimmed)) return `A branch named “${trimmed}” already exists.`
  return null
}

/**
 * Mirrors the destination `gitAddWorktree` derives daemon-side so the form can show where the
 * checkout will land: the procedure accepts no path, and a directory the user never sees is
 * exactly the kind of hidden default this form exists to avoid.
 * Keep in step with `gitAddWorktree` in `apps/daemon/src/git/git.ts`.
 */
export function worktreeDirectoryPreview(projectPath: string, branch: string): string | null {
  const normalized = projectPath.replace(/\/+$/, '')
  const cut = normalized.lastIndexOf('/')
  if (cut < 1) return null
  const leaf = branch.trim().replace(/[/\\:<>"|?*]+/g, '-')
  if (leaf === '') return null
  return `${normalized.slice(0, cut)}/${normalized.slice(cut + 1)}-worktrees/${leaf}`
}

/** Header copy for the sheet hosting the form — the picker's `ShellModal` renders it. */
export const WORKSPACE_CREATE_COPY: Record<
  WorkspaceCreateTarget,
  { title: string; description: string; placeholder: string; submit: string; pending: string }
> = {
  branch: {
    description: 'Created off the current HEAD and checked out in this worktree.',
    pending: 'Creating…',
    placeholder: 'Branch name',
    submit: 'Create branch',
    title: 'New branch',
  },
  worktree: {
    description: 'Created off the current HEAD and checked out in a linked worktree.',
    pending: 'Creating…',
    placeholder: 'Branch name',
    submit: 'Create worktree',
    title: 'New worktree',
  },
}

export function WorkspaceCreateForm({
  daemonError,
  existingBranches,
  fromLabel,
  onCancel,
  onSubmit,
  pending,
  projectPath,
  target,
}: {
  /** git's own refusal from the last attempt — shown verbatim, never replaced. */
  daemonError: string | null
  existingBranches: readonly string[]
  fromLabel: string
  onCancel: () => void
  onSubmit: (branch: string) => void
  pending: boolean
  projectPath: string
  target: WorkspaceCreateTarget
}): React.JSX.Element {
  // Mounted only while the picker is in create mode, so the field starts empty every time
  // without an effect watching an `open` prop.
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const copy = WORKSPACE_CREATE_COPY[target]
  const testID = `porcelain-workspace-create-${target}`
  const validation = branchNameError(name, existingBranches)
  const destination = target === 'worktree' ? worktreeDirectoryPreview(projectPath, name) : null

  const submit = (): void => {
    setSubmitted(true)
    if (validation !== null || pending) return
    onSubmit(name.trim())
  }

  // A dirty field owns the message: the daemon's error describes the name the user has already
  // moved past, so local validation wins while they are still typing.
  const dirty = name !== ''
  const message = validation !== null && (dirty || submitted) ? validation : daemonError

  return (
    <View className="gap-4" testID={testID}>
      <View className="gap-1">
        <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
          Branches from
        </Text>
        <Text
          className="font-mono text-xs text-foreground"
          numberOfLines={1}
          testID={`${testID}-from`}
        >
          {fromLabel}
        </Text>
      </View>

      <Input
        accessibilityLabel={copy.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        className="font-mono"
        editable={!pending}
        placeholder={copy.placeholder}
        returnKeyType="done"
        testID={`${testID}-name`}
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
      />

      {destination !== null ? (
        <View className="gap-1">
          <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
            Worktree folder
          </Text>
          <Text
            className="font-mono text-xs text-muted-foreground"
            numberOfLines={2}
            testID={`${testID}-destination`}
          >
            {destination}
          </Text>
        </View>
      ) : null}

      {message !== null ? (
        <View
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-3"
          testID={`${testID}-error`}
        >
          <Text className="text-xs leading-5 text-destructive">{message}</Text>
        </View>
      ) : null}

      <View className="flex-row justify-end gap-2">
        <Button
          accessibilityLabel="Cancel"
          disabled={pending}
          testID={`${testID}-cancel`}
          variant="ghost"
          onPress={onCancel}
        >
          <UiText>Cancel</UiText>
        </Button>
        <Button
          accessibilityLabel={copy.submit}
          disabled={pending || validation !== null}
          testID={`${testID}-submit`}
          onPress={submit}
        >
          <UiText>{pending ? copy.pending : copy.submit}</UiText>
        </Button>
      </View>
    </View>
  )
}

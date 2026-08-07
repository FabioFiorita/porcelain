import { applyCommitPrefix, parseCommitPrefix } from '@porcelain/client-runtime/commit-message'
import type { CommitGroupGenerationGroup } from '@porcelain/contracts'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { PanelLabel, StatusNote } from '@/components/panel-chrome'
import { ShellModal, ShellModalScroll, useShellModalSize } from '@/components/shell-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text as UiText } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import type { FlowGroup } from '@/lib/daemon/procedures/changes'
import { useActiveRepo } from '@/lib/daemon/repo'
import { cn } from '@/lib/utils'
import { useCommitDraftStore } from './commit-draft-store'
import { useWorkingFlow } from './use-changes'
import {
  useCommit,
  useCommitConventions,
  useCommitGeneration,
  useFileStaging,
  usePush,
  useStageAll,
} from './use-commit'

/**
 * The commit composer: conventional-commit tokens over a free-text message, the staging
 * toggle, and both generators.
 *
 * The textarea stays the single source of truth — the tokens only read and rewrite its
 * leading prefix, so a hand-written message with no prefix commits exactly as typed.
 */
export function CommitCard({ active }: { active: boolean }): React.JSX.Element {
  const repo = useActiveRepo()
  const repoPath = repo?.path ?? ''
  const message = useCommitDraftStore((state) => state.messages[repoPath] ?? '')
  const setMessage = useCommitDraftStore((state) => state.setMessage)
  const clearMessage = useCommitDraftStore((state) => state.clearMessage)

  const conventions = useCommitConventions()
  const { commit, error: commitError, isCommitting } = useCommit()
  const { generateGroups, generateMessage, isGenerating } = useCommitGeneration()
  const { isStaging, stageAll, unstageAll } = useStageAll()
  const { stageFile } = useFileStaging()
  const { isPushing, push } = usePush()
  // Commit always acts on the working tree, whatever scope the list is reading.
  const groups = useWorkingFlow(active)

  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null)
  const [generated, setGenerated] = useState<CommitGroupGenerationGroup[] | null>(null)
  const [applyingGroup, setApplyingGroup] = useState(false)

  const files = workingFiles(groups)
  const hasStaged = files.some((file) => file.staged === true)
  const hasUnstaged = files.some((file) => file.unstaged === true)
  const allStaged = files.length > 0 && files.every((f) => f.staged === true && f.unstaged !== true)
  const treeClean = files.length === 0

  const { scope, type } = parseCommitPrefix(message)
  const ready = applyCommitPrefix(message, null, null).trim() !== '' && !treeClean

  /**
   * Every action in this card reports on the one status line — a generated message, a staging
   * write, a failed provider. Nothing here fails silently.
   */
  const report = async (run: () => Promise<string>): Promise<void> => {
    setStatus(null)
    try {
      setStatus({ failed: false, text: await run() })
    } catch (cause) {
      setStatus({ failed: true, text: cause instanceof Error ? cause.message : String(cause) })
    }
  }

  const handleCommit = async (): Promise<void> => {
    if (!ready || isCommitting) return
    setStatus(null)
    try {
      await commit(message.trim())
      clearMessage(repoPath)
      setGenerated(null)
      setStatus({ failed: false, text: 'Committed' })
    } catch (cause) {
      setStatus({ failed: true, text: cause instanceof Error ? cause.message : String(cause) })
    }
  }

  /**
   * A clean tree is the normal state for a push — the commits are already made — so this is the
   * one action here that survives `treeClean`. The daemon's output is printed as written: an
   * "Everything up-to-date" and a rejected non-fast-forward must not look alike.
   */
  const handlePush = async (): Promise<void> => {
    if (isPushing) return
    await report(async () => {
      const output = await push()
      return output === '' ? 'Pushed' : output
    })
  }

  const handleToggleStaging = async (): Promise<void> => {
    if (isStaging) return
    await report(async () => {
      if (allStaged) {
        await unstageAll()
        return 'Unstaged all changes'
      }
      await stageAll()
      return 'Staged all changes'
    })
  }

  const handleGenerateMessage = async (): Promise<void> => {
    if (!hasStaged || isGenerating) return
    await report(async () => {
      const next = await generateMessage()
      setMessage(repoPath, next)
      setGenerated(null)
      return 'Generated commit message'
    })
  }

  const handleGenerateGroups = async (): Promise<void> => {
    if (hasStaged || !hasUnstaged || isGenerating) return
    await report(async () => {
      const next = await generateGroups()
      setGenerated(next)
      return `Generated ${next.length} commit group${next.length === 1 ? '' : 's'}`
    })
  }

  const handleUseGroup = async (group: CommitGroupGenerationGroup): Promise<void> => {
    if (applyingGroup) return
    setApplyingGroup(true)
    await report(async () => {
      for (const path of group.files) await stageFile(path)
      setMessage(repoPath, group.message)
      return `Staged ${group.files.length} file${group.files.length === 1 ? '' : 's'} for this group`
    })
    setApplyingGroup(false)
  }

  return (
    <View className="gap-2" testID="porcelain-changes-commit">
      <PanelLabel>Commit</PanelLabel>
      {treeClean ? (
        <Text className="text-[11px] text-muted-foreground">
          Working tree clean — nothing to stage or commit.
        </Text>
      ) : null}

      <View className="gap-2.5 rounded-2xl border border-border bg-card p-3">
        <View className="flex-row gap-1.5">
          <TokenChip
            disabled={treeClean || conventions === undefined}
            kind="type"
            options={conventions?.types ?? []}
            value={type}
            onChange={(next) => {
              setMessage(repoPath, applyCommitPrefix(message, next, next === null ? null : scope))
            }}
          />
          <TokenChip
            disabled={treeClean || type === null || conventions === undefined}
            kind="scope"
            options={conventions?.scopes ?? []}
            value={scope}
            onChange={(next) => {
              setMessage(repoPath, applyCommitPrefix(message, type, next))
            }}
          />
        </View>

        <Textarea
          accessibilityLabel="Commit message"
          className="min-h-20"
          editable={!treeClean}
          placeholder={treeClean ? 'Nothing to commit' : 'Commit message'}
          testID="porcelain-changes-commit-message"
          value={message}
          onChangeText={(next) => {
            setMessage(repoPath, next)
          }}
        />

        {status === null ? null : (
          <StatusNote
            failed={status.failed}
            testID="porcelain-changes-commit-status"
            text={status.text}
          />
        )}
        {commitError === null ? null : (
          <StatusNote failed text={commitError.message} testID="porcelain-changes-commit-error" />
        )}

        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            disabled={isStaging || treeClean}
            size="sm"
            testID="porcelain-changes-stage-all"
            variant="outline"
            onPress={() => {
              handleToggleStaging()
            }}
          >
            <ChromeGlyph name={allStaged ? 'minus' : 'plus'} size={14} tone="foreground" />
            <UiText>
              {isStaging
                ? allStaged
                  ? 'Unstaging…'
                  : 'Staging…'
                : allStaged
                  ? 'Unstage all'
                  : 'Stage all'}
            </UiText>
          </Button>
          <Button
            className="flex-1"
            disabled={!ready || isCommitting}
            size="sm"
            testID="porcelain-changes-commit-button"
            onPress={() => {
              handleCommit()
            }}
          >
            <ChromeGlyph name="commit" size={14} tone="primaryForeground" />
            <UiText>{isCommitting ? 'Committing…' : 'Commit'}</UiText>
          </Button>
        </View>

        <Button
          accessibilityLabel="Push"
          disabled={isPushing}
          size="sm"
          testID="porcelain-changes-push"
          variant="outline"
          onPress={() => {
            handlePush()
          }}
        >
          <ChromeGlyph name="arrowUpFromLine" size={14} tone="foreground" />
          <UiText>{isPushing ? 'Pushing…' : 'Push'}</UiText>
        </Button>

        <View className="gap-2">
          <Button
            disabled={!hasStaged || isGenerating}
            size="sm"
            testID="porcelain-changes-generate-message"
            variant="outline"
            onPress={() => {
              handleGenerateMessage()
            }}
          >
            <ChromeGlyph name="sparkles" size={14} tone="foreground" />
            <UiText>{isGenerating ? 'Generating…' : 'Generate Commit Message'}</UiText>
          </Button>
          <Button
            disabled={hasStaged || !hasUnstaged || isGenerating}
            size="sm"
            testID="porcelain-changes-generate-groups"
            variant="outline"
            onPress={() => {
              handleGenerateGroups()
            }}
          >
            <ChromeGlyph name="layers" size={14} tone="foreground" />
            <UiText>{isGenerating ? 'Generating…' : 'Generate Group Commit'}</UiText>
          </Button>
          <Text className="text-[11px] leading-4 text-muted-foreground">
            {hasStaged
              ? 'Message is written from the staged diff.'
              : 'Groups split the unstaged diff into separate commits — stage one to write its message.'}
          </Text>
        </View>

        {generated === null ? null : (
          <View className="gap-2 border-t border-border pt-2" testID="porcelain-changes-groups">
            <PanelLabel>Generated groups</PanelLabel>
            {generated.map((group) => (
              <View
                key={group.files.join('|')}
                className="gap-1 rounded-xl border border-border p-2.5"
              >
                <Text className="text-xs font-medium text-foreground">{group.message}</Text>
                <Text className="font-mono text-[10px] leading-4 text-muted-foreground">
                  {group.files.join(', ')}
                </Text>
                <Button
                  className="self-start"
                  disabled={applyingGroup}
                  size="sm"
                  testID={`porcelain-changes-stage-group-${group.files.length}`}
                  variant="ghost"
                  onPress={() => {
                    handleUseGroup(group)
                  }}
                >
                  <UiText>Stage group</UiText>
                </Button>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

function workingFiles(groups: FlowGroup[] | undefined): FlowGroup['files'] {
  return (groups ?? []).flatMap((group) => group.files)
}

/**
 * A `type` / `scope` token. The value is DERIVED from the message text, so editing the
 * message by hand keeps the chips in sync; choosing one rewrites only the leading prefix.
 */
function TokenChip({
  disabled,
  kind,
  onChange,
  options,
  value,
}: {
  disabled: boolean
  kind: 'type' | 'scope'
  onChange: (value: string | null) => void
  options: readonly string[]
  value: string | null
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { maxHeight, width } = useShellModalSize()
  const trimmed = query.trim()
  const filtered = options.filter((option) => option.toLowerCase().includes(trimmed.toLowerCase()))
  const canCreate = trimmed !== '' && !options.includes(trimmed)
  const display = value === null ? kind : kind === 'scope' ? `(${value})` : value

  const choose = (next: string | null): void => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <Pressable
        accessibilityLabel={`Commit ${kind}${value === null ? '' : `, ${value}`}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className={cn(
          'h-9 flex-1 flex-row items-center justify-between gap-1 rounded-lg border border-border bg-background px-2.5 active:bg-accent',
          disabled && 'opacity-50',
        )}
        disabled={disabled}
        testID={`porcelain-changes-commit-${kind}`}
        onPress={() => {
          setOpen(true)
        }}
      >
        <Text
          className={cn(
            'min-w-0 flex-1 font-mono text-xs',
            value === null ? 'text-muted-foreground' : 'text-foreground',
          )}
          numberOfLines={1}
        >
          {display}
        </Text>
        <ChromeGlyph name="chevron" size={11} />
      </Pressable>

      <ShellModal
        open={open}
        title={kind === 'type' ? 'Commit type' : 'Commit scope'}
        description={`Values this repository already uses — or add a new one.`}
        contentStyle={{ maxHeight, width }}
        onClose={() => {
          setOpen(false)
          setQuery('')
        }}
      >
        <Input
          accessibilityLabel={`Filter ${kind}s`}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={`Add ${kind}…`}
          testID={`porcelain-changes-commit-${kind}-input`}
          value={query}
          onChangeText={setQuery}
        />
        <ShellModalScroll className="max-h-72" contentContainerClassName="gap-0.5">
          {value === null ? null : (
            <TokenOption
              label={`Clear ${kind}`}
              testID={`porcelain-changes-commit-${kind}-clear`}
              onPress={() => {
                choose(null)
              }}
            />
          )}
          {filtered.map((option) => (
            <TokenOption
              key={option}
              label={kind === 'scope' ? `(${option})` : option}
              mono
              selected={option === value}
              testID={`porcelain-changes-commit-${kind}-${option}`}
              onPress={() => {
                choose(option)
              }}
            />
          ))}
          {canCreate ? (
            <TokenOption
              label={`Add “${trimmed}”`}
              testID={`porcelain-changes-commit-${kind}-add`}
              onPress={() => {
                choose(trimmed)
              }}
            />
          ) : null}
          {filtered.length === 0 && !canCreate ? (
            <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
              No {kind}s yet.
            </Text>
          ) : null}
        </ShellModalScroll>
      </ShellModal>
    </>
  )
}

function TokenOption({
  label,
  mono = false,
  onPress,
  selected = false,
  testID,
}: {
  label: string
  mono?: boolean
  onPress: () => void
  selected?: boolean
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'min-h-11 flex-row items-center justify-between rounded-xl px-3 py-2 active:bg-accent',
        selected && 'bg-muted/70',
      )}
      testID={testID}
      onPress={onPress}
    >
      <Text className={cn('text-sm text-foreground', mono && 'font-mono text-xs')}>{label}</Text>
      {selected ? <ChromeGlyph name="check" size={14} tone="primary" /> : null}
    </Pressable>
  )
}

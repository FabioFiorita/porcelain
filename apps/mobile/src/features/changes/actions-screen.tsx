import {
  Button,
  ConfirmationDialog,
  HStack,
  List,
  Picker,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
  useNativeState,
} from '@expo/ui/swift-ui'
import {
  disabled,
  font,
  foregroundStyle,
  listStyle,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHost } from '@/components/screen-host'
import { SheetCloseToolbar } from '@/components/sheet-close-toolbar'
import { useCommitDraftStore } from '@/features/changes/data/commit-draft'
import { useChangesMutations } from '@/features/changes/data/mutations'
import {
  useCommitConventions,
  useReviewedPaths,
  useSuggestions,
  useWorkingFlow,
} from '@/features/changes/data/queries'
import { applyCommitPrefix, parseCommitPrefix } from '@/features/changes/lib/commit-message'
import { formatStats } from '@/features/changes/lib/format'
import { firstParam } from '@/features/changes/lib/scope'
import { type DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
import type { FlowFile } from '@/lib/daemon/procedures/changes'
import { useActiveRepo } from '@/lib/daemon/repo'
import { footnote, monospace, secondary } from '@/theme/modifiers'

const headline = font({ textStyle: 'headline' })
const errorStyle = foregroundStyle({ color: '#FF3B30', type: 'color' })

export function ActionsScreen(): React.JSX.Element {
  const path = firstParam(useLocalSearchParams<{ path?: string }>().path)

  return (
    <>
      <DaemonGate requires="repo">
        <ActionsBody path={path} />
      </DaemonGate>
      <SheetCloseToolbar />
    </>
  )
}

function ActionsBody({ path }: { readonly path: string }): React.JSX.Element {
  const repo = useActiveRepo()
  const flow = useWorkingFlow()
  const reviewed = useReviewedPaths()
  const suggestions = useSuggestions()
  const conventions = useCommitConventions()
  const mutations = useChangesMutations()
  const draft = useCommitDraftStore((state) => state.messages[repo?.path ?? ''] ?? '')
  const setDraft = useCommitDraftStore((state) => state.setMessage)
  const clearDraft = useCommitDraftStore((state) => state.clearMessage)
  const nativeMessage = useNativeState(draft)
  const [discardPresented, setDiscardPresented] = useState(false)
  const [pushPresented, setPushPresented] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [pushOutput, setPushOutput] = useState<string | null>(null)

  const files = useMemo(
    (): FlowFile[] => flow.data?.flatMap((group) => group.files) ?? [],
    [flow.data],
  )
  const selectedFile = files.find((file) => file.path === path)
  const reviewedPaths = reviewed.data ?? []
  const allReviewed = files.length > 0 && files.every((file) => reviewedPaths.includes(file.path))
  const allStaged =
    files.length > 0 && files.every((file) => file.staged === true && file.unstaged !== true)
  const stagedFiles = files.filter((file) => file.staged === true)
  const unstagedFiles = files.filter((file) => file.staged !== true || file.unstaged === true)
  const stagedAdditions = stagedFiles.reduce((total, file) => total + (file.additions ?? 0), 0)
  const stagedDeletions = stagedFiles.reduce((total, file) => total + (file.deletions ?? 0), 0)
  const prefix = parseCommitPrefix(draft)
  const pushSuggestion = suggestions.data?.find((suggestion) => suggestion.command === 'push')
  const error = operationError ?? firstErrorMessage(mutations, flow.error, reviewed.error)

  useEffect(() => {
    nativeMessage.set(draft)
  }, [draft, nativeMessage])

  function updateDraft(message: string): void {
    if (repo === null) return
    setDraft(repo.path, message)
  }

  function applyPrefix(type: string | null, scope: string | null): void {
    const next = applyCommitPrefix(draft, type, scope)
    nativeMessage.set(next)
    updateDraft(next)
  }

  async function runStageAll(): Promise<void> {
    setOperationError(null)
    try {
      if (allStaged) await mutations.unstageAll.run()
      else await mutations.stageAll.run()
    } catch (cause) {
      setOperationError(actionError(cause))
    }
  }

  async function runStageFile(): Promise<void> {
    if (selectedFile === undefined) return
    setOperationError(null)
    try {
      if (selectedFile.staged === true && selectedFile.unstaged !== true) {
        await mutations.unstageFile.run(selectedFile.path)
      } else {
        await mutations.stageFile.run(selectedFile.path)
      }
    } catch (cause) {
      setOperationError(actionError(cause))
    }
  }

  async function runDiscard(): Promise<void> {
    if (selectedFile === undefined) return
    setDiscardPresented(false)
    setOperationError(null)
    try {
      await mutations.discardFile.run(selectedFile.path)
      router.dismiss(2)
    } catch (cause) {
      setOperationError(actionError(cause))
    }
  }

  async function runPush(): Promise<void> {
    setPushPresented(false)
    setOperationError(null)
    try {
      setPushOutput(await mutations.push.run())
    } catch (cause) {
      setOperationError(actionError(cause))
    }
  }

  async function runCommit(): Promise<void> {
    if (repo === null || draft.trim() === '' || stagedFiles.length === 0) return
    setOperationError(null)
    try {
      await mutations.commit.run(draft)
      clearDraft(repo.path)
      nativeMessage.set('')
      router.back()
    } catch (cause) {
      setOperationError(actionError(cause))
    }
  }

  async function runReview(pathToToggle: string, next: boolean): Promise<void> {
    setOperationError(null)
    try {
      if (next) await mutations.markReviewed.run(pathToToggle)
      else await mutations.unmarkReviewed.run(pathToToggle)
    } catch (cause) {
      setOperationError(actionError(cause))
    }
  }

  async function runReviewAll(next: boolean): Promise<void> {
    setOperationError(null)
    try {
      await mutations.setReviewed.run(next ? files.map((file) => file.path) : [])
    } catch (cause) {
      setOperationError(actionError(cause))
    }
  }

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        {selectedFile === undefined || path === '' ? null : (
          <Section title="Selected file">
            <Text modifiers={[headline]}>{selectedFile.path}</Text>
            <Button
              label={
                selectedFile.staged === true && selectedFile.unstaged !== true
                  ? 'Unstage file'
                  : 'Stage file'
              }
              modifiers={[
                disabled(mutations.stageFile.isPending || mutations.unstageFile.isPending),
              ]}
              onPress={(): void => {
                runStageFile()
              }}
              systemImage="checkmark.circle"
            />
            <Toggle
              isOn={reviewedPaths.includes(selectedFile.path)}
              label="Reviewed"
              onIsOnChange={(next: boolean): void => {
                runReview(selectedFile.path, next)
              }}
              systemImage="checkmark.seal"
            />
            <Button
              label="Discard changes"
              modifiers={[disabled(mutations.discardFile.isPending)]}
              onPress={(): void => setDiscardPresented(true)}
              role="destructive"
              systemImage="trash"
            />
          </Section>
        )}

        <Section title="Working tree">
          <Button
            label={allStaged ? 'Unstage all' : 'Stage all'}
            modifiers={[
              disabled(
                files.length === 0 ||
                  mutations.stageAll.isPending ||
                  mutations.unstageAll.isPending,
              ),
            ]}
            onPress={(): void => {
              runStageAll()
            }}
            systemImage={allStaged ? 'arrow.uturn.backward' : 'checkmark.circle'}
          />
          <Toggle
            isOn={allReviewed}
            label={allReviewed ? 'Unmark all reviewed' : 'Mark all reviewed'}
            onIsOnChange={(next: boolean): void => {
              runReviewAll(next)
            }}
            systemImage="checklist"
          />
          {flow.isPending && files.length === 0 ? (
            <Text modifiers={[footnote, secondary]}>Reading working-tree changes…</Text>
          ) : null}
        </Section>

        {pushSuggestion === undefined ? null : (
          <Section title="Push">
            <Button
              label={`Push · ${pushSuggestion.reason}`}
              modifiers={[disabled(mutations.push.isPending)]}
              onPress={(): void => setPushPresented(true)}
              systemImage="arrow.up.circle"
            />
            {pushOutput === null ? null : <Text modifiers={[monospace]}>{pushOutput}</Text>}
          </Section>
        )}

        <Section title="Commit">
          <HStack spacing={8}>
            <Text modifiers={[headline]}>Staged</Text>
            <Spacer />
            <Text modifiers={[footnote, secondary]}>
              {`${stagedFiles.length} file${stagedFiles.length === 1 ? '' : 's'} · ${formatStats(stagedAdditions, stagedDeletions) || 'no diff stats'}`}
            </Text>
          </HStack>
          {unstagedFiles.length === 0 ? null : (
            <Text modifiers={[footnote, secondary]}>
              {`${unstagedFiles.length} file${unstagedFiles.length === 1 ? '' : 's'} remain unstaged.`}
            </Text>
          )}
          <Picker<string>
            label="Type"
            modifiers={[pickerStyle('menu')]}
            onSelectionChange={(type: string): void =>
              applyPrefix(type === '' ? null : type, prefix.scope)
            }
            selection={prefix.type ?? ''}
          >
            <Text modifiers={[tag('')]}>No type</Text>
            {(conventions.data?.types ?? []).map((type) => (
              <Text key={type} modifiers={[tag(type)]}>
                {type}
              </Text>
            ))}
          </Picker>
          <Picker<string>
            label="Scope"
            modifiers={[pickerStyle('menu')]}
            onSelectionChange={(scope: string): void =>
              applyPrefix(prefix.type, scope === '' ? null : scope)
            }
            selection={prefix.scope ?? ''}
          >
            <Text modifiers={[tag('')]}>No scope</Text>
            {(conventions.data?.scopes ?? []).map((scope) => (
              <Text key={scope} modifiers={[tag(scope)]}>
                {scope}
              </Text>
            ))}
          </Picker>
          <TextField
            axis="vertical"
            onTextChange={updateDraft}
            placeholder="Commit message"
            text={nativeMessage}
          />
          <Button
            label="Commit"
            modifiers={[
              disabled(
                draft.trim() === '' || stagedFiles.length === 0 || mutations.commit.isPending,
              ),
            ]}
            onPress={(): void => {
              runCommit()
            }}
            systemImage="checkmark"
          />
        </Section>

        {error === null ? null : <Text modifiers={[footnote, errorStyle]}>{error}</Text>}
      </List>
      <ConfirmationDialog
        isPresented={discardPresented}
        onIsPresentedChange={setDiscardPresented}
        title={`Discard ${selectedFile?.path ?? 'file'}?`}
      >
        <ConfirmationDialog.Message>
          <Text>
            {selectedFile?.status === 'untracked' || selectedFile?.status === 'added'
              ? 'This new file moves to the Trash.'
              : 'Tracked changes revert to HEAD.'}
          </Text>
        </ConfirmationDialog.Message>
        <ConfirmationDialog.Actions>
          <Button
            label="Discard"
            onPress={(): void => {
              runDiscard()
            }}
            role="destructive"
          />
          <Button label="Cancel" onPress={(): void => setDiscardPresented(false)} role="cancel" />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
      <ConfirmationDialog
        isPresented={pushPresented}
        onIsPresentedChange={setPushPresented}
        title="Push changes?"
      >
        <ConfirmationDialog.Message>
          <Text>Send the current branch to its upstream.</Text>
        </ConfirmationDialog.Message>
        <ConfirmationDialog.Actions>
          <Button
            label="Push"
            onPress={(): void => {
              runPush()
            }}
          />
          <Button label="Cancel" onPress={(): void => setPushPresented(false)} role="cancel" />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
    </ScreenHost>
  )
}

function actionError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The action could not be completed.'
}

function firstErrorMessage(
  mutations: ReturnType<typeof useChangesMutations>,
  flowError: DaemonError | null,
  reviewedError: DaemonError | null,
): string | null {
  const mutationError = [
    mutations.commit.error,
    mutations.discardFile.error,
    mutations.markReviewed.error,
    mutations.push.error,
    mutations.setReviewed.error,
    mutations.stageAll.error,
    mutations.stageFile.error,
    mutations.unmarkReviewed.error,
    mutations.unstageAll.error,
    mutations.unstageFile.error,
  ].find((current): current is DaemonError => current !== null)
  const error = mutationError ?? flowError ?? reviewedError
  return error === null ? null : daemonErrorMessage(error)
}

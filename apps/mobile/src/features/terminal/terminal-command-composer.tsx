import { runUserAction } from '@porcelain/shared/background'
import { useCallback, useRef, useState } from 'react'
import { Alert, Pressable, Text, type TextInput, View } from 'react-native'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { Textarea } from '@/components/ui/textarea'
import { useIsTablet } from '@/features/shell/use-app-window'
import { getImage, hasImage } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { pickTerminalFiles } from './terminal-attachments'
import {
  deliverComposerDraft,
  type TerminalComposerDraft,
  useTerminalComposerStore,
} from './terminal-composer'
import { getTerminal } from './terminal-engine'
import { sendTerminalBytesAtomically } from './terminal-input'
import { takeArmedModifier } from './terminal-input-store'
import { terminalPasteFailureMessage } from './terminal-recovery'
import { mobileTerminalAdapter } from './terminal-stream-adapter'

/**
 * A visible native editing surface for touch keyboards. It complements the hidden terminal
 * field: direct mode remains the right route for vim, pagers and other interactive TUIs; this
 * composer gives normal platform text selection, dictation and paste a place to work first.
 */
export function TerminalCommandComposer({
  onBlur,
  onFocus,
  sessionId,
}: {
  onBlur: () => void
  onFocus: () => void
  sessionId: string
}): React.JSX.Element {
  const isTablet = useIsTablet()
  const draft = useTerminalComposerStore((state) => state.drafts[sessionId])
  const addAttachment = useTerminalComposerStore((state) => state.addAttachment)
  const clear = useTerminalComposerStore((state) => state.clear)
  const removeAttachment = useTerminalComposerStore((state) => state.removeAttachment)
  const setExpanded = useTerminalComposerStore((state) => state.setExpanded)
  const setText = useTerminalComposerStore((state) => state.setText)
  const inputRef = useRef<TextInput>(null)
  const [delivering, setDelivering] = useState(false)
  const current = draft ?? { attachments: [], expanded: false, text: '' }

  const toggle = useCallback(() => {
    const next = !current.expanded
    setExpanded(sessionId, next)
    if (next && !isTablet) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [current.expanded, isTablet, sessionId, setExpanded])

  const addClipboardImage = useCallback((): void => {
    runUserAction(
      async () => {
        if (!(await hasImage())) {
          Alert.alert('No image on clipboard', 'Copy a screenshot or photo first, then try again.')
          return
        }
        const image = await getImage()
        if (image === null) {
          Alert.alert('Could not read the clipboard image', 'Try copying it again.')
          return
        }
        addAttachment(sessionId, { ...image, filename: 'clipboard.png', kind: 'image' })
        setExpanded(sessionId, true)
      },
      (cause) => {
        Alert.alert(
          'Could not read the clipboard image',
          cause instanceof Error ? cause.message : String(cause),
        )
      },
    )
  }, [addAttachment, sessionId, setExpanded])

  const addFiles = useCallback((): void => {
    runUserAction(
      async () => {
        const result = await pickTerminalFiles().catch(() => ({ result: 'read-failed' as const }))
        if (result.result === 'cancelled') return
        if (result.result === 'too-large') {
          Alert.alert('File too large', `${result.name} is larger than the 8 MiB attachment limit.`)
          return
        }
        if (result.result === 'read-failed') {
          Alert.alert('Could not attach the file', 'Try selecting the file again.')
          return
        }
        for (const attachment of result.attachments) addAttachment(sessionId, attachment)
        setExpanded(sessionId, true)
      },
      (cause) => {
        Alert.alert(
          'Could not attach the file',
          cause instanceof Error ? cause.message : String(cause),
        )
      },
    )
  }, [addAttachment, sessionId, setExpanded])

  const deliver = useCallback(
    (submit: boolean): void => {
      if (delivering) return
      const activeDraft = useTerminalComposerStore.getState().drafts[sessionId] ?? EMPTY_DRAFT
      // Empty Insert is intentionally inert. Empty Send remains a real Return, which lets the
      // composer submit an interactive prompt without making the hidden field reappear.
      if (!submit && activeDraft.text === '' && activeDraft.attachments.length === 0) return
      setDelivering(true)
      takeArmedModifier(sessionId)
      runUserAction(
        async () => {
          const result = await deliverComposerDraft(
            {
              attachments: activeDraft.attachments,
              bracketedPaste: getTerminal(sessionId)?.modes.bracketedPasteMode ?? false,
              submit,
              text: activeDraft.text,
            },
            {
              upload: (attachment) =>
                attachment.kind === 'image'
                  ? mobileTerminalAdapter().pasteImageToTerminal({
                      dataBase64: attachment.base64,
                      id: sessionId,
                      mime: attachment.mime,
                      insert: false,
                    })
                  : mobileTerminalAdapter().pasteFileToTerminal({
                      dataBase64: attachment.base64,
                      filename: attachment.filename,
                      id: sessionId,
                      insert: false,
                      mime: attachment.mime,
                    }),
              write: (bytes) => {
                sendTerminalBytesAtomically(sessionId, bytes)
              },
            },
          )
          if (result.result === 'attachment-failed') {
            Alert.alert(
              `Could not attach the ${result.kind}`,
              terminalPasteFailureMessage(result.failure, result.kind),
            )
            return
          }
          if (result.result === 'too-large') {
            Alert.alert('Command too large', 'Shorten the command before inserting it.')
            return
          }
          clear(sessionId)
        },
        (cause) => {
          Alert.alert(
            'Could not deliver the command',
            cause instanceof Error ? cause.message : String(cause),
          )
        },
        () => {
          setDelivering(false)
        },
      )
    },
    [clear, delivering, sessionId],
  )

  return (
    <View
      className={cn(
        'shrink-0 border-t border-border bg-card px-3 py-2',
        isTablet ? 'gap-2' : 'gap-2 pb-3',
      )}
      testID="porcelain-terminal-composer"
    >
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityLabel={
            current.expanded ? 'Collapse command composer' : 'Expand command composer'
          }
          accessibilityRole="button"
          accessibilityState={{ expanded: current.expanded }}
          className="h-9 flex-1 flex-row items-center gap-2 rounded-lg border border-border bg-secondary px-3 active:bg-accent"
          testID="porcelain-terminal-composer-toggle"
          onPress={toggle}
        >
          <ChromeGlyph
            name={current.expanded ? 'chevronUp' : 'terminal'}
            size={15}
            tone="foreground"
          />
          <Text className="text-sm font-medium text-secondary-foreground">
            {current.expanded ? 'Command composer' : 'Compose command'}
          </Text>
          {current.attachments.length === 0 ? null : (
            <Text className="ml-auto text-xs text-muted-foreground">
              {current.attachments.length} file{current.attachments.length === 1 ? '' : 's'}
            </Text>
          )}
        </Pressable>
        <ComposerButton
          accessibilityLabel="Add image from clipboard"
          disabled={delivering}
          glyph="image"
          testID="porcelain-terminal-composer-add-image"
          onPress={addClipboardImage}
        />
        <ComposerButton
          accessibilityLabel="Attach files"
          disabled={delivering}
          glyph="file"
          testID="porcelain-terminal-composer-add-file"
          onPress={addFiles}
        />
      </View>

      {current.expanded ? (
        <ExpandedComposer
          delivering={delivering}
          draft={current}
          inputRef={inputRef}
          onRemoveImage={(attachmentId) => {
            removeAttachment(sessionId, attachmentId)
          }}
          onBlur={onBlur}
          onFocus={onFocus}
          onInsert={() => {
            deliver(false)
          }}
          onSend={() => {
            deliver(true)
          }}
          onTextChange={(text) => {
            setText(sessionId, text)
          }}
        />
      ) : null}
    </View>
  )
}

const EMPTY_DRAFT: TerminalComposerDraft = { attachments: [], expanded: false, text: '' }

function ExpandedComposer({
  delivering,
  draft,
  inputRef,
  onRemoveImage,
  onBlur,
  onFocus,
  onInsert,
  onSend,
  onTextChange,
}: {
  delivering: boolean
  draft: TerminalComposerDraft
  inputRef: React.RefObject<TextInput | null>
  onRemoveImage: (attachmentId: string) => void
  onBlur: () => void
  onFocus: () => void
  onInsert: () => void
  onSend: () => void
  onTextChange: (text: string) => void
}): React.JSX.Element {
  return (
    <View className="gap-2" testID="porcelain-terminal-composer-expanded">
      {draft.attachments.length === 0 ? null : (
        <View className="flex-row flex-wrap gap-1" testID="porcelain-terminal-composer-attachments">
          {draft.attachments.map((attachment) => (
            <View
              key={attachment.id}
              accessibilityLabel={`${attachment.kind === 'image' ? 'Image' : 'File'} queued for terminal`}
              accessibilityRole="text"
              className="flex-row items-center gap-1 rounded-md bg-secondary px-2 py-1"
            >
              <ChromeGlyph
                name={attachment.kind === 'image' ? 'image' : 'file'}
                size={13}
                tone="muted"
              />
              <Text className="text-xs text-secondary-foreground" numberOfLines={1}>
                {attachment.filename}
              </Text>
              <Pressable
                accessibilityLabel={`Remove queued ${attachment.kind}`}
                accessibilityRole="button"
                className="-mr-1 rounded-sm px-1 py-0.5 active:bg-accent"
                testID={`porcelain-terminal-composer-remove-${attachment.kind}-${attachment.id}`}
                onPress={() => {
                  onRemoveImage(attachment.id)
                }}
              >
                <ChromeGlyph name="close" size={13} tone="muted" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Textarea
        ref={inputRef}
        accessibilityLabel="Command composer"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!delivering}
        numberOfLines={4}
        placeholder="Write, paste, or dictate a command…"
        spellCheck={false}
        testID="porcelain-terminal-composer-input"
        value={draft.text}
        onBlur={onBlur}
        onChangeText={onTextChange}
        onFocus={onFocus}
      />
      <View className="flex-row justify-end gap-2">
        <ComposerButton
          accessibilityLabel="Insert command without submitting"
          disabled={delivering || (draft.text === '' && draft.attachments.length === 0)}
          label="Insert"
          testID="porcelain-terminal-composer-insert"
          onPress={onInsert}
        />
        <ComposerButton
          accessibilityLabel="Insert command and submit"
          disabled={delivering}
          label="Send"
          primary
          testID="porcelain-terminal-composer-send"
          onPress={onSend}
        />
      </View>
    </View>
  )
}

function ComposerButton({
  accessibilityLabel,
  disabled = false,
  glyph,
  label,
  onPress,
  primary = false,
  testID,
}: {
  accessibilityLabel: string
  disabled?: boolean
  glyph?: 'file' | 'image'
  label?: string
  onPress: () => void
  primary?: boolean
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={cn(
        'h-9 min-w-18 items-center justify-center rounded-lg border px-3 active:opacity-80',
        primary ? 'border-primary bg-primary' : 'border-border bg-secondary',
        disabled && 'opacity-50',
      )}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
    >
      {glyph === undefined ? (
        <Text
          className={cn(
            'text-sm font-medium',
            primary ? 'text-primary-foreground' : 'text-secondary-foreground',
          )}
        >
          {label}
        </Text>
      ) : (
        <ChromeGlyph name={glyph} size={16} tone="foreground" />
      )}
    </Pressable>
  )
}

import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AppState,
  Keyboard,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'
import { usePreference } from '@/lib/daemon/preferences'
import { useDaemonSession } from '@/lib/daemon/session'
import { terminalColors } from '@/theme/terminal-colors'

import { TerminalComposer } from './terminal-composer'
import { type SpecialKey, TerminalKeyBar } from './terminal-key-bar'
import {
  type ArrowDirection,
  controlByte,
  type TerminalModifier,
  terminalArrowBytes,
  terminalEditBytes,
  terminalModifierBytes,
} from './terminal-keys'
import { TerminalWebView, type TerminalWebViewHandle } from './terminal-webview'
import { useTerminalSessions } from './use-terminal-sessions'
import { useTerminalStream } from './use-terminal-stream'

const FONT_SIZE_SCHEMA = z.union([z.literal(10), z.literal(12), z.literal(14)])

export function TerminalSessionScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : ''
  const focused = useIsFocused()
  const daemonSession = useDaemonSession()
  const roster = useTerminalSessions(true)
  const terminalRef = useRef<TerminalWebViewHandle>(null)
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark'
  const colors = terminalColors(scheme)
  const insets = useSafeAreaInsets()
  const [fontSize, setFontSize] = usePreference('terminal.fontSize', FONT_SIZE_SCHEMA, 12)
  const [webViewReady, setWebViewReady] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [armed, setArmed] = useState<TerminalModifier | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [applicationCursorKeys, setApplicationCursorKeys] = useState(false)
  const { height, width } = useWindowDimensions()
  const output = useCallback((data: string): void => {
    terminalRef.current?.write(data)
  }, [])
  const stream = useTerminalStream(id === '' ? null : id, output)
  const attachment = stream.attachment
  const attachmentFound = attachment?.found ?? false
  const attachmentGeneration = attachment?.generation ?? null
  const attachmentScrollback = attachment?.scrollback ?? ''
  const terminal = useMemo(
    () => roster.sessions.find((session) => session.id === id) ?? null,
    [id, roster.sessions],
  )
  const title = terminal?.name ?? 'Terminal'
  const exited = stream.attachment?.status === 'exited' || terminal?.status === 'exited'
  const keyboardVisible = keyboardHeight > 0

  useEffect(() => {
    if (!focused || !webViewReady || id === '') return
    stream.attach().catch(() => {})
    return (): void => {
      stream.detach()
    }
  }, [focused, id, stream.attach, stream.detach, webViewReady])

  useEffect(() => {
    if (!webViewReady || !attachmentFound || attachmentGeneration === null) return
    terminalRef.current?.resetAndWrite(attachmentScrollback)
  }, [attachmentFound, attachmentGeneration, attachmentScrollback, webViewReady])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        stream.detach()
        return
      }
      if (state === 'active' && focused && webViewReady) stream.attach().catch(() => {})
    })
    return (): void => subscription.remove()
  }, [focused, stream.attach, stream.detach, webViewReady])

  useEffect(() => {
    // `will*` rather than `did*`: the bar has to travel with the keyboard, not land after it.
    const show = Keyboard.addListener('keyboardWillShow', (event): void => {
      setKeyboardHeight(event.endCoordinates.height)
      terminalRef.current?.fit()
    })
    const hide = Keyboard.addListener('keyboardWillHide', (): void => {
      setKeyboardHeight(0)
      terminalRef.current?.fit()
    })
    return (): void => {
      show.remove()
      hide.remove()
    }
  }, [])

  useEffect(() => {
    if (height < 1 || width < 1) return
    terminalRef.current?.setFontSize(fontSize)
    terminalRef.current?.fit()
  }, [fontSize, height, width])

  /** Refit once the bar/composer/keyboard settle, or xterm keeps the pre-resize row count. */
  useEffect(() => {
    terminalRef.current?.fit()
  }, [])

  function consumeArmed(): TerminalModifier | null {
    if (armed !== null) setArmed(null)
    return armed
  }

  /** Typed characters arriving from xterm. An armed modifier claims exactly one of them. */
  function sendInput(data: string): void {
    const modifier = consumeArmed()
    if (modifier !== null && data.length === 1) {
      const bytes = terminalModifierBytes(modifier, data)
      if (bytes !== null) {
        stream.write(bytes)
        return
      }
    }
    stream.write(data)
  }

  /** Punctuation straight off the bar — still subject to an armed modifier. */
  function sendLiteral(key: string): void {
    sendInput(key)
  }

  function sendSpecial(key: SpecialKey): void {
    const modifier = consumeArmed()
    if (modifier === 'meta' && (key === 'left' || key === 'right')) {
      // Alt+arrow is word motion, not ESC followed by an arrow — readline reads that as two keys.
      const bytes = terminalEditBytes({
        altKey: true,
        ctrlKey: false,
        key: key === 'left' ? 'ArrowLeft' : 'ArrowRight',
        metaKey: false,
        shiftKey: false,
      })
      if (bytes !== null) {
        stream.write(bytes)
        return
      }
    }
    stream.write(specialBytes(key, applicationCursorKeys))
  }

  function sendComposer(text: string, appendNewline: boolean): void {
    stream.write(text)
    if (appendNewline) stream.write('\r')
  }

  function toggleModifier(modifier: TerminalModifier): void {
    setArmed((current) => (current === modifier ? null : modifier))
  }

  function toggleKeyboard(): void {
    if (keyboardVisible) Keyboard.dismiss()
    else terminalRef.current?.focus()
  }

  function requestRename(): void {
    if (id === '' || terminal === null) return
    Alert.prompt(
      'Rename terminal',
      'Choose the label shown in the roster.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: (value?: string): void => {
            roster.rename(id, value ?? terminal.name).catch((error: unknown) => {
              Alert.alert('Rename failed', error instanceof Error ? error.message : 'Try again.')
            })
          },
          text: 'Rename',
        },
      ],
      'plain-text',
      terminal.name,
    )
  }

  function requestKill(): void {
    if (id === '' || terminal === null) return
    Alert.alert(`Kill ${terminal.name}?`, 'The process ends.', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: (): void => {
          stream.kill()
          router.back()
        },
        style: 'destructive',
        text: 'Kill',
      },
    ])
  }

  const missing = stream.phase === 'missing'
  /** Keyboard up: dock to it. Keyboard down: clear the tab bar and home indicator. */
  const bottomInset = keyboardVisible ? keyboardHeight : insets.bottom
  const others = roster.sessions.filter((session) => session.status === 'running')

  return (
    <>
      <Stack.Screen options={{ title }} />
      <View style={{ backgroundColor: colors.background, flex: 1, paddingBottom: bottomInset }}>
        {daemonSession.status !== 'open' ? (
          <Text
            style={{ backgroundColor: colors.noticeFill, color: colors.noticeText, padding: 8 }}
          >
            {daemonSession.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
          </Text>
        ) : null}
        {missing ? (
          <MissingSession scheme={scheme} />
        ) : (
          <>
            <TerminalWebView
              ref={terminalRef}
              fontSize={fontSize}
              onCursorMode={setApplicationCursorKeys}
              onInput={sendInput}
              onLayout={(): void => terminalRef.current?.fit()}
              onReady={(): void => {
                setWebViewReady(true)
                terminalRef.current?.fit()
              }}
              onResize={stream.resize}
            />
            {stream.error === null && !exited ? null : (
              <Text
                style={{
                  color: stream.error === null ? colors.mutedText : colors.errorText,
                  padding: 8,
                }}
              >
                {stream.error === null
                  ? `— exited (code ${stream.attachment?.exitCode ?? terminal?.exitCode ?? 0}) —`
                  : stream.error.message}
              </Text>
            )}
            <TerminalKeyBar
              armed={armed}
              composerOpen={composerOpen}
              keyboardVisible={keyboardVisible}
              onKeyboardToggle={toggleKeyboard}
              onLiteralKey={sendLiteral}
              onRestoreFocus={(): void => terminalRef.current?.focus()}
              onSpecialKey={sendSpecial}
              onToggleComposer={(): void => setComposerOpen((current) => !current)}
              onToggleModifier={toggleModifier}
              scheme={scheme}
              terminalFocused={(): boolean => terminalRef.current?.isFocused() ?? false}
            />
            {composerOpen ? (
              <TerminalComposer
                disabled={exited || stream.phase !== 'attached'}
                onSend={sendComposer}
                scheme={scheme}
              />
            ) : null}
          </>
        )}
      </View>
      <Stack.Toolbar placement="right">
        {exited || missing ? (
          <Stack.Toolbar.Button
            accessibilityLabel="Close terminal"
            icon="xmark"
            onPress={(): void => router.back()}
          />
        ) : (
          <Stack.Toolbar.Menu icon="ellipsis.circle">
            <Stack.Toolbar.MenuAction onPress={requestRename}>Rename</Stack.Toolbar.MenuAction>
            <Stack.Toolbar.Menu inline title="Font size">
              <Stack.Toolbar.MenuAction
                isOn={fontSize === 10}
                onPress={(): void => setFontSize(10)}
              >
                Small
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={fontSize === 12}
                onPress={(): void => setFontSize(12)}
              >
                Medium
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={fontSize === 14}
                onPress={(): void => setFontSize(14)}
              >
                Large
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
            {/* Hop between live shells without walking back to the roster. */}
            <Stack.Toolbar.Menu inline title="Shells">
              {others.map((session) => (
                <Stack.Toolbar.MenuAction
                  key={session.id}
                  isOn={session.id === id}
                  onPress={(): void => {
                    if (session.id === id) return
                    router.replace({ params: { id: session.id }, pathname: '/session/[id]' })
                  }}
                >
                  {session.name}
                </Stack.Toolbar.MenuAction>
              ))}
              <Stack.Toolbar.MenuAction onPress={(): void => router.push('/new')}>
                Start a shell
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.MenuAction destructive onPress={requestKill}>
              Kill
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        )}
      </Stack.Toolbar>
    </>
  )
}

function MissingSession({ scheme }: { scheme: 'light' | 'dark' }): React.JSX.Element {
  const colors = terminalColors(scheme)

  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: '600' }}>
        This session is no longer on the daemon
      </Text>
      <Text style={{ color: colors.mutedText, textAlign: 'center' }}>
        It may have been killed or swept after its idle lifetime.
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Text
          accessibilityRole="button"
          onPress={(): void => router.push('/new')}
          style={{ color: colors.activeFill, padding: 8 }}
        >
          Start a new one
        </Text>
        <Text
          accessibilityRole="button"
          onPress={(): void => router.back()}
          style={{ color: colors.activeFill, padding: 8 }}
        >
          Dismiss
        </Text>
      </View>
    </View>
  )
}

function specialBytes(
  key: 'escape' | 'tab' | 'ctrl-c' | ArrowDirection,
  application: boolean,
): string {
  switch (key) {
    case 'escape':
      return '\x1b'
    case 'tab':
      return '\t'
    case 'ctrl-c':
      return controlByte('c') ?? '\x03'
    default:
      return terminalArrowBytes(key, application)
  }
}

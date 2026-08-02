import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AppState, Keyboard, Text, useWindowDimensions, View } from 'react-native'
import { z } from 'zod'
import { usePreference } from '@/lib/daemon/preferences'
import { useDaemonSession } from '@/lib/daemon/session'

import { TerminalComposer } from './terminal-composer'
import { TerminalKeyBar } from './terminal-key-bar'
import { type ArrowDirection, controlByte, terminalArrowBytes } from './terminal-keys'
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
  const [fontSize, setFontSize] = usePreference('terminal.fontSize', FONT_SIZE_SCHEMA, 12)
  const [webViewReady, setWebViewReady] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [ctrlArmed, setCtrlArmed] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
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
    const show = Keyboard.addListener('keyboardDidShow', (): void => {
      setKeyboardVisible(true)
      terminalRef.current?.fit()
    })
    const hide = Keyboard.addListener('keyboardDidHide', (): void => {
      setKeyboardVisible(false)
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

  function sendInput(data: string): void {
    if (ctrlArmed) {
      setCtrlArmed(false)
      const byte = data.length === 1 ? controlByte(data) : null
      if (byte !== null) {
        stream.write(byte)
        return
      }
    }
    stream.write(data)
  }

  function sendSpecial(key: Parameters<typeof specialBytes>[0]): void {
    setCtrlArmed(false)
    stream.write(specialBytes(key, applicationCursorKeys))
  }

  function sendComposer(text: string, appendNewline: boolean): void {
    stream.write(text)
    if (appendNewline) stream.write('\r')
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
  return (
    <>
      <Stack.Screen options={{ title }} />
      <View style={{ backgroundColor: '#16161a', flex: 1 }}>
        {daemonSession.status !== 'open' ? (
          <Text style={{ backgroundColor: '#3a2e10', color: '#ffd60a', padding: 8 }}>
            {daemonSession.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
          </Text>
        ) : null}
        {missing ? (
          <MissingSession />
        ) : (
          <>
            <TerminalKeyBar
              composerOpen={composerOpen}
              ctrlArmed={ctrlArmed}
              keyboardVisible={keyboardVisible}
              onKeyboardToggle={toggleKeyboard}
              onRestoreFocus={(): void => terminalRef.current?.focus()}
              onSpecialKey={sendSpecial}
              onToggleComposer={(): void => setComposerOpen((current) => !current)}
              onToggleCtrl={(): void => setCtrlArmed((current) => !current)}
              terminalFocused={(): boolean => terminalRef.current?.isFocused() ?? false}
            />
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
            {composerOpen ? (
              <TerminalComposer
                disabled={exited || stream.phase !== 'attached'}
                onSend={sendComposer}
              />
            ) : null}
            {stream.error === null && !exited ? null : (
              <Text style={{ color: stream.error === null ? '#8e8e93' : '#ff6961', padding: 8 }}>
                {stream.error === null
                  ? `— exited (code ${stream.attachment?.exitCode ?? terminal?.exitCode ?? 0}) —`
                  : stream.error.message}
              </Text>
            )}
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
            <Stack.Toolbar.MenuAction destructive onPress={requestKill}>
              Kill
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        )}
      </Stack.Toolbar>
    </>
  )
}

function MissingSession(): React.JSX.Element {
  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#f2f2f7', fontSize: 20, fontWeight: '600' }}>
        This session is no longer on the daemon
      </Text>
      <Text style={{ color: '#aeaeb2', textAlign: 'center' }}>
        It may have been killed or swept after its idle lifetime.
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Text
          accessibilityRole="button"
          onPress={(): void => router.push('/new')}
          style={{ color: '#0A84FF', padding: 8 }}
        >
          Start a new one
        </Text>
        <Text
          accessibilityRole="button"
          onPress={(): void => router.back()}
          style={{ color: '#0A84FF', padding: 8 }}
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

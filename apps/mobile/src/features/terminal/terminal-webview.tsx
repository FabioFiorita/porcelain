import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { type LayoutChangeEvent, Linking, useColorScheme } from 'react-native'
import WebView, { type WebViewMessageEvent } from 'react-native-webview'

import { terminalColors } from '@/theme/terminal-colors'

import { isSafeExternalUrl, javascriptString, parseBridgeMessage } from './webview/bridge-protocol'
import { TERMINAL_HTML } from './webview/terminal-html.generated'

export type TerminalWebViewHandle = {
  write: (data: string) => void
  resetAndWrite: (scrollback: string) => void
  fit: () => void
  setFontSize: (size: number) => void
  focus: () => void
  blur: () => void
  isFocused: () => boolean
}

export const TerminalWebView = forwardRef<
  TerminalWebViewHandle,
  {
    fontSize: number
    onReady: () => void
    onInput: (data: string) => void
    onResize: (cols: number, rows: number) => void
    onCursorMode: (application: boolean) => void
    onLayout: (event: LayoutChangeEvent) => void
  }
>(function TerminalWebView(
  { fontSize, onCursorMode, onInput, onLayout, onReady, onResize },
  ref,
): React.JSX.Element {
  const webViewRef = useRef<WebView>(null)
  const readyRef = useRef(false)
  const focusedRef = useRef(false)
  const initialNavigationRef = useRef(true)
  const pendingWritesRef = useRef<string[]>([])
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark'

  const inject = useCallback((script: string): void => {
    webViewRef.current?.injectJavaScript(`${script}; true;`)
  }, [])

  const write = useCallback(
    (data: string): void => {
      if (data === '') return
      if (!readyRef.current) {
        pendingWritesRef.current.push(data)
        return
      }
      inject(`window.__porcelainTerminalWrite(${javascriptString(data)})`)
    },
    [inject],
  )

  const flushPending = useCallback((): void => {
    const pending = pendingWritesRef.current.splice(0)
    for (const data of pending) {
      inject(`window.__porcelainTerminalWrite(${javascriptString(data)})`)
    }
  }, [inject])

  useImperativeHandle(
    ref,
    () => ({
      blur: (): void => {
        if (readyRef.current) inject('window.__porcelainTerminalBlur()')
      },
      fit: (): void => {
        if (readyRef.current) inject('window.__porcelainTerminalFit()')
      },
      focus: (): void => {
        if (readyRef.current) inject('window.__porcelainTerminalFocus()')
      },
      isFocused: (): boolean => focusedRef.current,
      resetAndWrite: (scrollback: string): void => {
        if (!readyRef.current) return
        inject(
          `window.__porcelainTerminalReset(); window.__porcelainTerminalWrite(${javascriptString(scrollback)}); window.__porcelainTerminalFit()`,
        )
      },
      setFontSize: (size: number): void => {
        if (readyRef.current) inject(`window.__porcelainTerminalFontSize(${size})`)
      },
      write,
    }),
    [inject, write],
  )

  useEffect(() => {
    if (!readyRef.current) return
    inject(`window.__porcelainTerminalFontSize(${fontSize})`)
  }, [fontSize, inject])

  useEffect(() => {
    if (!readyRef.current) return
    inject(`window.__porcelainTerminalTheme(${javascriptString(scheme)})`)
  }, [inject, scheme])

  function message(event: WebViewMessageEvent): void {
    const parsed = parseBridgeMessage(event.nativeEvent.data)
    if (parsed === null) return
    switch (parsed.t) {
      case 'ready':
        readyRef.current = true
        inject(`window.__porcelainTerminalFontSize(${fontSize})`)
        inject(`window.__porcelainTerminalTheme(${javascriptString(scheme)})`)
        flushPending()
        onReady()
        break
      case 'input':
        onInput(parsed.data)
        break
      case 'resize':
        onResize(parsed.cols, parsed.rows)
        break
      case 'cursor-mode':
        onCursorMode(parsed.application)
        break
      case 'focus':
        focusedRef.current = parsed.focused
        break
      case 'link':
        if (isSafeExternalUrl(parsed.url)) {
          Linking.openURL(parsed.url).catch(() => {})
        }
        break
    }
  }

  function shouldStartNavigation(): boolean {
    if (initialNavigationRef.current) {
      initialNavigationRef.current = false
      return true
    }
    return false
  }

  return (
    <WebView
      ref={webViewRef}
      allowFileAccess={false}
      allowsLinkPreview={false}
      // WKWebView's own prev/next/done bar would sit between the key bar and the keyboard,
      // stealing a row of screen to offer form navigation a terminal has no use for.
      hideKeyboardAccessoryView
      javaScriptEnabled
      mediaPlaybackRequiresUserAction
      onLayout={onLayout}
      onMessage={message}
      onShouldStartLoadWithRequest={shouldStartNavigation}
      originWhitelist={['about:blank']}
      setSupportMultipleWindows={false}
      source={{ html: TERMINAL_HTML }}
      style={{ backgroundColor: terminalColors(scheme).background, flex: 1 }}
    />
  )
})

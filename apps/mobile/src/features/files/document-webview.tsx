import { useCallback, useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import WebView from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'

import { scrubRemoteAssets } from '@/features/review/scrub-remote-assets'
import { ensureResponsiveHtml } from './responsive-html'

/**
 * Full-screen sandboxed HTML document viewer for file previews (HTML + markdown reader).
 * Pure RN like the terminal WebView — not hosted inside a SwiftUI tree — so it can share a
 * flex column with the source canvas and truncation footer.
 * Security posture matches evidence: no JS, no file access, remote assets scrubbed.
 */
export function DocumentWebView({ html }: { html: string }): React.JSX.Element {
  const prepared = useMemo(() => {
    const responsive = ensureResponsiveHtml(html)
    return scrubRemoteAssets(responsive)
  }, [html])
  const allowedLoads = useRef(0)
  const allowInitialLoadOnly = useCallback((url: string): boolean => {
    if (allowedLoads.current >= 2) return false
    if (url === 'about:blank' || url.startsWith('data:text/html')) {
      allowedLoads.current += 1
      return true
    }
    return false
  }, [])

  return (
    <View style={styles.fill}>
      <WebView
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        cacheEnabled={false}
        domStorageEnabled={false}
        incognito
        javaScriptEnabled={false}
        mediaPlaybackRequiresUserAction
        mixedContentMode="never"
        onShouldStartLoadWithRequest={(event: ShouldStartLoadRequest): boolean =>
          allowInitialLoadOnly(event.url)
        }
        originWhitelist={['about:blank', 'data:*']}
        scrollEnabled
        setSupportMultipleWindows={false}
        source={{ html: prepared.html }}
        style={styles.fill}
      />
      {prepared.blocked === 0 ? null : (
        <Text style={styles.notice}>
          {`${prepared.blocked} remote ${prepared.blocked === 1 ? 'asset' : 'assets'} blocked`}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  notice: {
    color: '#8E8E93',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
})

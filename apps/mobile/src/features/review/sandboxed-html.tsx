import { RNHostView, Text, VStack } from '@expo/ui/swift-ui'
import { font } from '@expo/ui/swift-ui/modifiers'
import { useCallback, useMemo, useRef } from 'react'
import WebView from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'
import { secondary } from '@/theme/modifiers'
import { scrubRemoteAssets } from './scrub-remote-assets'

export function SandboxedHtml({
  height,
  html,
  scrollEnabled,
}: {
  height?: number
  html: string
  scrollEnabled: boolean
}): React.JSX.Element {
  const scrubbed = useMemo(() => scrubRemoteAssets(html), [html])
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
    <VStack spacing={4}>
      <RNHostView>
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
          originWhitelist={[]}
          scrollEnabled={scrollEnabled}
          setSupportMultipleWindows={false}
          source={{ html: scrubbed.html }}
          style={{
            flex: height === undefined ? 1 : undefined,
            height,
            minHeight: scrollEnabled ? 0 : 160,
            width: '100%',
          }}
        />
      </RNHostView>
      {scrubbed.blocked === 0 ? null : (
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>
          {`${scrubbed.blocked} remote ${scrubbed.blocked === 1 ? 'asset' : 'assets'} blocked`}
        </Text>
      )}
    </VStack>
  )
}

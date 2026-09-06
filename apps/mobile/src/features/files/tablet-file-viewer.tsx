import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { useHubRepoPath } from '@/features/projects'
import { useActiveEnvironment } from '@/features/remote'
import { cn } from '@/lib/utils'
import { pathSegments, pathTestId } from './file-paths'
import { EMPTY_FILE_TABS, fileTabsOwner, useFileTabsStore } from './file-tabs-store'
import { FileViewer } from './file-viewer'
import { useFilesStore } from './files-store'

export function TabletFileViewer({
  filePath,
  line,
  focused,
}: {
  filePath: string
  line?: number
  focused: boolean
}): React.JSX.Element | null {
  const owner = fileTabsOwner(useActiveEnvironment()?.id, useHubRepoPath())
  const state = useFileTabsStore((s) =>
    owner ? (s.owners[owner] ?? EMPTY_FILE_TABS) : EMPTY_FILE_TABS,
  )
  const router = useRouter()
  const tabStrip = useRef<ScrollView>(null)
  const tabPositions = useRef(new Map<string, number>())
  useEffect(() => {
    if (!focused || !state.activePath) return
    const x = tabPositions.current.get(`${owner}:${state.activePath}`)
    if (x !== undefined) tabStrip.current?.scrollTo({ x, animated: true })
  }, [owner, focused, state.activePath])
  const routeOwner = useRef<{ path: string; owner: string | null } | null>(null)
  useEffect(() => {
    if (!focused) {
      routeOwner.current = null
      return
    }
    if (!owner || !filePath) return
    if (routeOwner.current?.path === filePath && routeOwner.current.owner !== owner) return
    routeOwner.current = { path: filePath, owner }
    useFileTabsStore.getState().open(owner, filePath, line)
    useFilesStore.getState().openFile(filePath, line)
  }, [owner, filePath, line, focused])
  useEffect(() => {
    if (!owner || !focused || !filePath) return
    const current = useFileTabsStore.getState().owners[owner]
    if (!current || current !== state || current.tabs.some((tab) => tab.path === filePath)) return
    const next = current.tabs.find((tab) => tab.path === current.activePath)
    if (next)
      router.replace({
        pathname: '/file/[...path]',
        params: {
          path: pathSegments(next.path),
          line: next.line === undefined ? undefined : String(next.line),
        },
      })
    else router.replace('/worktree')
  }, [owner, focused, filePath, state, router])

  const activate = (path: string, at?: number) => {
    if (!owner) return
    useFileTabsStore.getState().open(owner, path, at)
    useFilesStore.getState().openFile(path, at)
    router.replace({
      pathname: '/file/[...path]',
      params: { path: pathSegments(path), line: at === undefined ? undefined : String(at) },
    })
  }
  const close = (path: string) => {
    if (!owner) return
    useFileTabsStore.getState().close(owner, path)
    if (!focused || state.activePath !== path) return
    const next = useFileTabsStore
      .getState()
      .owners[owner]?.tabs.find(
        (tab) => tab.path === useFileTabsStore.getState().owners[owner]?.activePath,
      )
    if (next) activate(next.path, next.line)
    else {
      useFilesStore.setState({ selection: null, selectionLine: null })
      router.replace('/worktree')
    }
  }

  if (!focused && state.tabs.length === 0) return null
  return (
    <View className={focused ? 'flex-1' : 'shrink-0'} testID="porcelain-file-tabs-viewer">
      <View className="border-b border-border">
        <ScrollView
          ref={tabStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="porcelain-file-tabs"
        >
          {state.tabs.map((tab) => {
            const active = focused && state.activePath === tab.path
            const name = tab.path.split('/').at(-1) ?? tab.path
            const duplicateName = state.tabs.some(
              (other) => other.path !== tab.path && other.path.split('/').at(-1) === name,
            )
            return (
              <View
                key={tab.path}
                onLayout={(event) => {
                  const x = event.nativeEvent.layout.x
                  tabPositions.current.set(`${owner}:${tab.path}`, x)
                  if (active) tabStrip.current?.scrollTo({ x, animated: true })
                }}
                className={cn(
                  'flex-row items-center border-r border-border',
                  active ? 'bg-accent' : 'bg-card',
                )}
              >
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tab.path}
                  testID={pathTestId('porcelain-file-tab', tab.path)}
                  onPress={() => activate(tab.path, tab.line)}
                  className="min-h-11 max-w-64 flex-row items-center gap-2 pl-3 pr-2"
                >
                  <ChromeGlyph name="file" size={14} tone={active ? 'foreground' : 'muted'} />
                  <Text numberOfLines={1} className="shrink font-mono text-xs text-foreground">
                    {duplicateName ? tab.path : name}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Close ${tab.path}`}
                  testID={pathTestId('porcelain-file-tab-close', tab.path)}
                  onPress={() => close(tab.path)}
                  className="size-9 items-center justify-center rounded-lg active:bg-muted"
                >
                  <ChromeGlyph name="close" size={13} />
                </Pressable>
              </View>
            )
          })}
        </ScrollView>
      </View>
      {state.tabs.map((tab) => (
        <View
          key={`${owner}:${tab.path}`}
          className="flex-1"
          style={{ display: focused && tab.path === state.activePath ? 'flex' : 'none' }}
        >
          <FileViewer
            active={focused && tab.path === state.activePath}
            filePath={tab.path}
            line={tab.line}
          />
        </View>
      ))}
    </View>
  )
}

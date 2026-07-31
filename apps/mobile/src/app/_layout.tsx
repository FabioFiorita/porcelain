import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useColorScheme } from 'react-native'

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <NativeTabs minimizeBehavior="onScrollDown" tintColor="#0ea5e9">
        <NativeTabs.Trigger name="(files)">
          <NativeTabs.Trigger.Icon sf="folder.fill" md="folder" />
          <NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(changes)">
          <NativeTabs.Trigger.Icon sf="arrow.triangle.branch" md="difference" />
          <NativeTabs.Trigger.Label>Changes</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(review)">
          <NativeTabs.Trigger.Icon sf="checkmark.seal.fill" md="fact_check" />
          <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(board)">
          <NativeTabs.Trigger.Icon sf="rectangle.3.group.fill" md="view_kanban" />
          <NativeTabs.Trigger.Label>Board</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(terminal)">
          <NativeTabs.Trigger.Icon sf="terminal.fill" md="terminal" />
          <NativeTabs.Trigger.Label>Terminal</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  )
}

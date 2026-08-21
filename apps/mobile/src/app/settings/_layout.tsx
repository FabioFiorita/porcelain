import { Stack } from 'expo-router/stack'

/**
 * Settings is a tab root; see `terminals/_layout.tsx` for why a tab root needs its own stack.
 *
 * `headerShown: false` is the app-wide rule now, not a per-screen opt-out: every screen draws
 * `ScreenHeader` from `panel-chrome`, so there is no `UINavigationBar` left to configure and no
 * title to declare here. See the note on `ScreenHeader` for why the native bar had to go.
 */
export default function SettingsLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />
}

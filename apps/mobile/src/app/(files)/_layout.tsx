import { Stack } from 'expo-router/stack'

/**
 * The Files tab is a real native stack: folders and files push instead of swapping in behind a
 * store flag, which hands the interactive pop gesture, the Android hardware back button, and
 * re-tap-the-tab-to-return-to-root back to the navigator.
 *
 * A group rather than a `files/` directory because this tab is also the app's `/` route — the
 * segment stays out of the URL, so the tab root is still `/` while `/folder/…` and `/file/…`
 * live inside the tab's stack rather than beside it as sibling (and therefore hidden) tabs.
 *
 * Headers stay hidden because both pushed screens carry chrome the native bar has no room for
 * — the breadcrumb trail, the full repo-relative path, and the row of file actions. Hiding the
 * bar does not disable the pop gesture.
 */
export default function FilesLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />
}

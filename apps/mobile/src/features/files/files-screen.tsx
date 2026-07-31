import { Stack } from 'expo-router'

import { PlaceholderScreen } from '@/components/placeholder-screen'
import { SettingsToolbar } from '@/components/settings-toolbar'

export function FilesScreen() {
  return (
    <>
      <PlaceholderScreen
        title="Files"
        description="The repository tree and file viewer, scoped to the daemon's checkout."
        details={[
          'Tree navigation with monorepo hide and pin',
          'Viewer for a single file, syntax-aware',
          'Search lives in this header — no separate Search tab on mobile',
        ]}
      />
      <Stack.SearchBar placeholder="Search files" />
      <SettingsToolbar />
    </>
  )
}

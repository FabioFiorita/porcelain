import { useNavigation } from 'expo-router'
import { useLayoutEffect } from 'react'

import { useTabFaces } from '@/lib/tab-faces'

/** SF Symbols used as tab bar identities for the four phone tabs and their alternates. */
export type TabBarSymbol =
  | 'folder.fill'
  | 'magnifyingglass'
  | 'arrow.triangle.branch'
  | 'clock.arrow.circlepath'
  | 'checkmark.seal.fill'
  | 'rectangle.3.group.fill'
  | 'terminal.fill'

/**
 * Push label + SF Symbol onto the parent tab route. Call from the tab group layout so the
 * native bar tracks `useTabFaces` (not the URL — sheets must not reset the face).
 */
export function useTabBarIdentity(label: string, sf: TabBarSymbol): void {
  const navigation = useNavigation()

  useLayoutEffect(() => {
    const parent = navigation.getParent() as
      | { setOptions: (options: Record<string, unknown>) => void }
      | undefined
    parent?.setOptions({
      icon: { sf },
      selectedIcon: undefined,
      title: label,
    })
  }, [label, navigation, sf])
}

export function useFilesTabBarIdentity(): void {
  const face = useTabFaces((state) => state.files)
  useTabBarIdentity(
    face === 'search' ? 'Search' : 'Files',
    face === 'search' ? 'magnifyingglass' : 'folder.fill',
  )
}

export function useReviewTabBarIdentity(): void {
  const face = useTabFaces((state) => state.review)
  useTabBarIdentity(
    face === 'board' ? 'Board' : 'Review',
    face === 'board' ? 'rectangle.3.group.fill' : 'checkmark.seal.fill',
  )
}

export function useChangesTabBarIdentity(): void {
  const face = useTabFaces((state) => state.changes)
  useTabBarIdentity(
    face === 'history' ? 'History' : 'Changes',
    face === 'history' ? 'clock.arrow.circlepath' : 'arrow.triangle.branch',
  )
}

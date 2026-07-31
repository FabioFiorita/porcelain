import type { StackToolbarButtonProps } from 'expo-router'
import { type ImageSourcePropType, Platform } from 'react-native'

/** Every icon the app puts in a native stack toolbar. */
export type ToolbarIconName = 'settings' | 'board' | 'history'

type ToolbarIcon = NonNullable<StackToolbarButtonProps['icon']>

/**
 * `Stack.Toolbar.Button` only accepts an SF Symbol on iOS and only accepts an
 * `ImageSourcePropType` on Android — an SF Symbol name there renders nothing at
 * all (expo-router logs a dev warning and returns `null`), which silently killed
 * the Settings/Board/History header buttons on Android. The bundled monochrome
 * PNGs are drawn through Compose's `Icon`, so they inherit the toolbar tint.
 *
 * Keep the branch here: call sites just name the icon.
 */
const SF_SYMBOLS = {
  settings: 'gearshape',
  board: 'rectangle.3.group',
  history: 'clock.arrow.circlepath',
} as const satisfies Record<ToolbarIconName, ToolbarIcon>

const ANDROID_IMAGES: Record<ToolbarIconName, ImageSourcePropType> = {
  settings: require<ImageSourcePropType>('../../assets/toolbar/settings.png'),
  board: require<ImageSourcePropType>('../../assets/toolbar/board.png'),
  history: require<ImageSourcePropType>('../../assets/toolbar/history.png'),
}

export function toolbarIcon(name: ToolbarIconName): ToolbarIcon {
  return Platform.OS === 'android' ? ANDROID_IMAGES[name] : SF_SYMBOLS[name]
}

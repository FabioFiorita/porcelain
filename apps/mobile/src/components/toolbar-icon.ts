import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons'
import type { StackToolbarButtonProps } from 'expo-router'
import { type ImageSourcePropType, Platform } from 'react-native'

/** Every icon the app puts in a native stack toolbar. */
export type ToolbarIconName = 'settings' | 'board' | 'history'

type ToolbarIcon = NonNullable<StackToolbarButtonProps['icon']>

/**
 * `Stack.Toolbar.Button` only accepts an SF Symbol on iOS and only accepts an
 * `ImageSourcePropType` on Android — an SF Symbol name there renders nothing at
 * all (expo-router logs a dev warning and returns `null`), which silently killed
 * the Settings/Board/History header buttons on Android. Android always defaults
 * `iconRenderingMode` to `'template'` for image icons, so the toolbar re-tints
 * whatever color these are rasterized with — it only has to exist.
 *
 * Keep the branch here: call sites just name the icon.
 */
const SF_SYMBOLS = {
  settings: 'gearshape',
  board: 'rectangle.3.group',
  history: 'clock.arrow.circlepath',
} as const satisfies Record<ToolbarIconName, ToolbarIcon>

const MATERIAL_DESIGN_ICON_NAME = {
  settings: 'cog',
  board: 'view-column',
  history: 'history',
} as const satisfies Record<ToolbarIconName, string>

const ANDROID_IMAGE_SIZE = 24

const ANDROID_IMAGES: Record<ToolbarIconName, ImageSourcePropType> = {
  settings: MaterialDesignIcons.getImageSourceSync(
    MATERIAL_DESIGN_ICON_NAME.settings,
    ANDROID_IMAGE_SIZE,
    'black',
  ),
  board: MaterialDesignIcons.getImageSourceSync(
    MATERIAL_DESIGN_ICON_NAME.board,
    ANDROID_IMAGE_SIZE,
    'black',
  ),
  history: MaterialDesignIcons.getImageSourceSync(
    MATERIAL_DESIGN_ICON_NAME.history,
    ANDROID_IMAGE_SIZE,
    'black',
  ),
}

export function toolbarIcon(name: ToolbarIconName): ToolbarIcon {
  return Platform.OS === 'android' ? ANDROID_IMAGES[name] : SF_SYMBOLS[name]
}

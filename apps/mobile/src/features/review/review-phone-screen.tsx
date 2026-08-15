import { useIsFocused } from 'expo-router'
import { View } from 'react-native'

import { PhoneHeader } from '@/features/shell/phone-header'

import { ReviewCanvas } from './review-canvas'

/**
 * The Review tab root on phone: the header and the canvas, with its own Intent · Process · Execution ·
 * Evidence switch.
 *
 * No pushed routes, unlike Changes and Files. The Review has no per-item detail to open — a
 * file's diff and its slices are read inside the Execution document itself, which is what
 * makes the unit read as one story rather than a list you tap through. The outline the tablet
 * gets as a third column is the canvas' own tab strip here.
 */
export function ReviewPhoneScreen(): React.JSX.Element {
  const focused = useIsFocused()

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-surface-review">
      <PhoneHeader companionSurface="review" title="Review" />
      <ReviewCanvas active={focused} />
    </View>
  )
}

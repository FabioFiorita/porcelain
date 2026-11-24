import { platformApiLevel } from 'expo-device';
import { AccessibilityInfo } from 'react-native';
import { notifier } from './notice';

export const notify = notifier({
  platformShowsCopy: (platformApiLevel ?? 0) >= 33,
  announce: (title) => AccessibilityInfo.announceForAccessibility(title),
});

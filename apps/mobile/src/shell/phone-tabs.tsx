import { NativeTabs } from 'expo-router/native-tabs';
import { tabIcon } from '../shared/icons/tab-icon';

export function PhoneTabs() {
  return (
    <NativeTabs
      screenListeners={
        __DEV__
          ? {
              tabPress: (event) =>
                console.info('Mobile tab press', event.target),
              focus: (event) => console.info('Mobile tab focus', event.target),
              blur: (event) => console.info('Mobile tab blur', event.target),
            }
          : undefined
      }
    >
      <NativeTabs.Trigger name="(review)" accessibilityLabel="Review">
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...tabIcon('review')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(files)" accessibilityLabel="Files">
        <NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...tabIcon('files')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(history)" accessibilityLabel="History">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...tabIcon('history')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)" accessibilityLabel="Settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...tabIcon('settings')} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

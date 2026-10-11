import { NativeTabs } from 'expo-router/native-tabs';
import { tabIcon } from '../shared/icons/tab-icon';

import { destinations } from './destinations';

export function PhoneTabs() {
  return (
    <NativeTabs>
      {destinations.map((destination) => (
        <NativeTabs.Trigger
          key={destination.group}
          name={destination.group}
          accessibilityLabel={destination.title}
        >
          <NativeTabs.Trigger.Label>
            {destination.title}
          </NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon {...tabIcon(destination.icon)} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

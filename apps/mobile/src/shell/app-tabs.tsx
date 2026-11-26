import { NativeTabs } from 'expo-router/native-tabs';
import { tabIcon } from '../shared/icons/tab-icon';
import { appTabs } from './app-tab-list';

export function AppTabs() {
  return (
    <NativeTabs sidebarAdaptable>
      {appTabs.map((tab) => (
        <NativeTabs.Trigger
          key={tab.name}
          name={tab.name}
          accessibilityLabel={tab.title}
        >
          <NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon {...tabIcon(tab.icon)} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

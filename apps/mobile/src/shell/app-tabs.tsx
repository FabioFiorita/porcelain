import { NativeTabs } from 'expo-router/native-tabs';
import { tabIcon } from '../shared/icons/tab-icon';
import type { IconName } from '../shared/icons/icon';

const tabs = [
  { name: '(reviews)', title: 'Reviews', icon: 'reviews' },
  { name: '(worktrees)', title: 'Worktrees', icon: 'worktrees' },
] as const satisfies readonly {
  name: string;
  title: string;
  icon: IconName;
}[];

export function AppTabs() {
  return (
    <NativeTabs sidebarAdaptable>
      {tabs.map((tab) => (
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

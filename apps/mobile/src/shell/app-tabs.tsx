import { useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { SideDrawer } from '../components/ui/side-drawer';
import { useWorktreeDrawer } from '../features/projects';
import { tabIcon } from '../shared/icons/tab-icon';
import { appTabs } from './app-tab-list';
import { SectionRail } from './sidebar-sections';
import { useTabBarColors } from './tab-bar-colors';
import { tabPlacement } from './tab-placement';
import { WorktreeDrawer } from './worktree-drawer';

const tabRoots: ReadonlySet<string> = new Set(appTabs.map((tab) => tab.root));

export function AppTabs() {
  const drawer = useWorktreeDrawer();
  const segments = useSegments();
  return (
    <SideDrawer
      open={drawer.open}
      hidden={drawer.hidden}
      swipe={tabRoots.has(segments.at(-1) ?? '')}
      onOpenChange={drawer.setOpen}
      drawer={
        <WorktreeDrawer sections={drawer.mode === 'pinned' && !drawer.hidden} />
      }
      rail={<SectionRail />}
    >
      <NativeTabs {...tabPlacement(drawer.mode)} {...useTabBarColors()}>
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
    </SideDrawer>
  );
}

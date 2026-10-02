import { Host, Label, List, Section } from '@expo/ui/swift-ui';
import { listStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-screens/experimental';
import { tabIcon } from '../shared/icons/tab-icon';
import { type IconName } from '../shared/icons/icon';

const destinations = [
  { path: '/', title: 'Review', icon: 'review' },
  { path: '/files', title: 'Files', icon: 'files' },
  { path: '/history', title: 'History', icon: 'history' },
  { path: '/settings', title: 'Settings', icon: 'settings' },
] satisfies { path: string; title: string; icon: IconName }[];

export function TabletSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SafeAreaView edges={{ left: true, top: true }} style={{ flex: 1 }}>
      <Host style={{ flex: 1 }}>
        <List
          selection={[pathname]}
          onSelectionChange={(selection) => {
            const path = selection.at(-1);
            if (typeof path === 'string' && path !== pathname)
              router.replace(path);
          }}
          modifiers={[listStyle('sidebar')]}
        >
          <Section title="Porcelain">
            {destinations.map((destination) => (
              <Label
                key={destination.path}
                title={destination.title}
                systemImage={tabIcon(destination.icon).sf}
                modifiers={[tag(destination.path)]}
              />
            ))}
          </Section>
        </List>
      </Host>
    </SafeAreaView>
  );
}

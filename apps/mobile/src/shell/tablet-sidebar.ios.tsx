import { Label, List, NavigationLink, Section } from '@expo/ui/swift-ui';
import { listStyle, navigationTitle, tag } from '@expo/ui/swift-ui/modifiers';
import { usePathname, useRouter } from 'expo-router';
import { tabIcon } from '../shared/icons/tab-icon';
import { type IconName } from '../shared/icons/icon';

const destinations = [
  { path: '/files', title: 'Files', icon: 'files' },
  { path: '/review', title: 'Review', icon: 'review' },
  { path: '/history', title: 'History', icon: 'history' },
  { path: '/settings', title: 'Settings', icon: 'settings' },
] satisfies { path: string; title: string; icon: IconName }[];

export function TabletSidebar({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <List
      selection={[pathname]}
      onSelectionChange={(selection) => {
        const path = selection.at(-1);
        if (typeof path === 'string') {
          if (path !== pathname) router.replace(path);
          onNavigate();
        }
      }}
      modifiers={[listStyle('sidebar'), navigationTitle('Porcelain')]}
    >
      <Section>
        {destinations.map((destination) => (
          <NavigationLink
            key={destination.path}
            value={destination.path}
            modifiers={[tag(destination.path)]}
          >
            <Label
              title={destination.title}
              systemImage={tabIcon(destination.icon).sf}
            />
          </NavigationLink>
        ))}
      </Section>
    </List>
  );
}

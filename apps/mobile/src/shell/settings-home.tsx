import { Stack, useRouter } from 'expo-router';
import { headerIcon } from '../shared/icons/header-icon';
import { useState } from 'react';
import { ListDetail, useListDetailLayout } from '../components/ui/list-detail';
import { EnvironmentsSettings, SettingsScreen } from '../features/access';
import { keyCommandsSupported } from '../features/keyboard';
import { PreferencesScreen, ReviewsGitSettings } from '../features/preferences';

type SettingsPage = 'general' | 'reviews-git' | 'computers';

export function SettingsHome() {
  const router = useRouter();
  const layout = useListDetailLayout();
  const [page, setPage] = useState<SettingsPage>('general');
  const beside = layout.mode === 'beside';
  const open = (next: SettingsPage) => {
    if (beside) setPage(next);
    else router.push(`/${next}`);
  };
  const list = (
    <SettingsScreen
      {...(beside ? { selected: page } : {})}
      onOpenGeneral={() => open('general')}
      onOpenReviewsGit={() => open('reviews-git')}
      onOpenComputers={() => open('computers')}
      onOpenComponentLibrary={() => router.push('/component-library')}
      {...(keyCommandsSupported
        ? { onOpenShortcuts: () => router.push('/keyboard-shortcuts') }
        : {})}
    />
  );
  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={headerIcon('close')}
          accessibilityLabel="Close Settings"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <ListDetail
        layout={layout}
        list={() => list}
        detail={beside ? <SettingsPageView page={page} /> : null}
      />
    </>
  );
}

function SettingsPageView({ page }: { page: SettingsPage }) {
  const router = useRouter();
  switch (page) {
    case 'general':
      return <PreferencesScreen />;
    case 'reviews-git':
      return <ReviewsGitSettings />;
    case 'computers':
      return (
        <EnvironmentsSettings
          onAddComputer={() => router.navigate('/pair-computer')}
          onOpenComputer={(environmentId) =>
            router.push({ pathname: '/computer', params: { environmentId } })
          }
        />
      );
  }
}

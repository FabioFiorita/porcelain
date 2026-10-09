import { useRouter } from 'expo-router';
import { ComponentLibrary } from '../../features/access';

export default function ComponentLibraryRoute() {
  const router = useRouter();
  return (
    <ComponentLibrary
      onOpenText={() => router.push('/component-text')}
      onOpenButton={() => router.push('/component-button')}
      onOpenPrimitive={(name) =>
        router.push({ pathname: '/component-preview', params: { name } })
      }
    />
  );
}

import { useLocalSearchParams } from 'expo-router'

import { UnbuiltSurfaceScreen } from '@/features/hub/unbuilt-surface-screen'

export default function UnbuiltSurfaceRoute(): React.JSX.Element {
  const { surface } = useLocalSearchParams<{ surface: string }>()
  return <UnbuiltSurfaceScreen surface={surface} />
}

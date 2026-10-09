import { useLocalSearchParams } from 'expo-router';
import { PrimitivePreview } from '../../features/access';
export default function ComponentPreviewRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();
  return <PrimitivePreview name={name} />;
}

import { useLocalSearchParams } from 'expo-router';
import { PrimitivePreview } from '../../features/catalog';
export default function ComponentPreviewRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();
  return <PrimitivePreview name={name} />;
}

import { useLocalSearchParams } from 'expo-router'

import { CanvasScreen } from '@/features/canvas'

/** One Canvas, opened from the surface list. */
export default function CanvasDocumentRoute(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <CanvasScreen canvasId={id} />
}

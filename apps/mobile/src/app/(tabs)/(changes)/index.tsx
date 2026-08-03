import { useTabRootFocusRegistration } from '@/components/use-tab-root-focus'
import { ChangesScreen } from '@/features/changes/changes-screen'
import { HistoryScreen } from '@/features/changes/history-screen'
import { useTabFaces } from '@/lib/tab-faces'

/** One tab slot, two faces — re-tap the tab bar to flip; no stack push / back chevron. */
export default function ChangesTabRoot(): React.JSX.Element {
  useTabRootFocusRegistration('changes')
  const face = useTabFaces((state) => state.changes)
  return face === 'history' ? <HistoryScreen /> : <ChangesScreen />
}

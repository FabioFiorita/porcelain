import { useTabRootFocusRegistration } from '@/components/use-tab-root-focus'
import { FilesScreen } from '@/features/files/files-screen'
import { FilesSearchScreen } from '@/features/files/files-search-screen'
import { useTabFaces } from '@/lib/tab-faces'

/** One tab slot, two faces — re-tap flips to Search and raises the keyboard. */
export default function FilesTabRoot(): React.JSX.Element {
  useTabRootFocusRegistration('files')
  const face = useTabFaces((state) => state.files)
  return face === 'search' ? <FilesSearchScreen /> : <FilesScreen />
}

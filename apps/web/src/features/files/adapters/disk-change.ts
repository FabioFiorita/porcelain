import { useAtomMount } from '@effect/atom-react';
import type { FileDraftHandle } from '@porcelain/client/files';
import { diskChangeObservation, diskChangeViewer } from '../store';

export function useDiskChangeNotice(
  draft: FileDraftHandle,
  viewer: string,
  fingerprint: string | undefined,
) {
  useAtomMount(diskChangeViewer({ draft, viewer }));
  useAtomMount(diskChangeObservation({ draft, viewer, fingerprint }));
}

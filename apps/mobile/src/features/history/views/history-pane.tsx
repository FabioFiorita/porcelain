import { useEffect, useState } from 'react';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { WorkspaceGate, type Workspace } from '../../projects';
import { HistoryNavigation } from './history-navigation';

export function HistoryPane() {
  return (
    <WorkspaceGate title="History">
      {(current) => <SelectedHistory key={current.key} current={current} />}
    </WorkspaceGate>
  );
}

function SelectedHistory({ current }: { current: Workspace }) {
  const router = useRouter();
  const pathname = usePathname();
  const { oid, workspace } = useGlobalSearchParams<{
    oid?: string;
    workspace?: string;
  }>();
  const [pending, setPending] = useState<{
    oid: string;
    from: string;
  }>();
  const commitPath = oid ? `/history/commit/${oid}` : undefined;
  const selected =
    workspace === undefined || workspace === current.key ? oid : undefined;
  useEffect(() => {
    if (!pending) return;
    if (!pathname.startsWith('/history/')) {
      setPending(undefined);
      return;
    }
    if (pathname !== pending.from) return;
    setPending(undefined);
    if (pending.oid === oid && selected === oid) return;
    router.replace({
      pathname: '/history/commit/[oid]',
      params: { oid: pending.oid, workspace: current.key },
    });
  }, [current.key, oid, pathname, pending, router, selected]);
  return (
    <HistoryNavigation
      selection={current}
      workspace={current.key}
      selected={selected}
      onOpen={(nextOid, nextWorkspace) => {
        const target = {
          pathname: '/history/commit/[oid]' as const,
          params: { oid: nextOid, workspace: nextWorkspace },
        };
        if (nextOid === selected && pathname === commitPath) return;
        if (pathname === '/history') {
          router.push(target);
        } else if (oid && commitPath && pathname === `${commitPath}/diff`) {
          setPending({ oid: nextOid, from: commitPath });
          router.dismissTo({
            pathname: '/history/commit/[oid]',
            params: { oid, ...(workspace === undefined ? {} : { workspace }) },
          });
        } else {
          router.replace(target);
        }
      }}
    />
  );
}

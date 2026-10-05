import { useQuery } from '@tanstack/react-query';
import { remoteStatusQueryOptions } from '@porcelain/client/access';
import { remoteStatus, type Remote } from '@porcelain/client/access/rules';
import { pairingPlatform } from '../store';

export function useRemoteStatus(remote: Remote) {
  const query = useQuery(remoteStatusQueryOptions(pairingPlatform, remote));
  return remoteStatus(remote, query.data);
}

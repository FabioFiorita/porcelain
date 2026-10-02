import { useQuery } from '@tanstack/react-query';
import { environmentQueryOptions } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { pairingPlatform } from '../store';

export function useEnvironmentStatus(remote: Remote) {
  return useQuery(environmentQueryOptions(pairingPlatform(), remote));
}

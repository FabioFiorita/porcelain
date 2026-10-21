import { useConfirmedRead } from '@/shared/query/confirmed-read';
import { readInventory } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

export function useInventory(connection: Connection) {
  return useConfirmedRead(readInventory(connection)).value;
}

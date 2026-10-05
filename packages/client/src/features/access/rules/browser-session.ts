import type { Principal } from '@porcelain/contracts/access';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

export type BrowserSession = {
  inventory: ReadInventoryResponse;
  principal: Principal;
};
